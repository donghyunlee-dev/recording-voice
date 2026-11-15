// Read-only acceptance against the installed Windows runtime and production web.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { createHash } = require('node:crypto')
async function hashes(directory, prefix = '') {
  const result = {}
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const name = path.join(prefix, entry.name)
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) Object.assign(result, await hashes(file, name))
    else result[name] = createHash('sha256').update(await fs.readFile(file)).digest('hex')
  }
  return result
}
async function run() {
  assert.equal(process.platform, 'win32')
  const data = path.join(process.env.LOCALAPPDATA, 'VoiceStudio', 'data')
  const before = await hashes(data)
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-installed-browser-'))
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  let page
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    await context.grantPermissions(['local-network-access'], { origin: 'https://recording-voice-web.vercel.app' })
    page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    // Guard this verifier against accidentally triggering a data mutation.
    await context.route('http://127.0.0.1:8766/**', (route) => {
      const request = route.request()
      const pairing = new URL(request.url()).pathname === '/api/v1/pair'
      if (request.method() === 'GET' || request.method() === 'OPTIONS' || (pairing && request.method() === 'POST')) return route.continue()
      errors.push('Unexpected mutation blocked')
      return route.abort()
    })
    await page.goto('https://recording-voice-web.vercel.app')
    assert.equal(new URL(page.url()).origin, 'https://recording-voice-web.vercel.app', 'Production redirected to authentication')
    await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor({ timeout: 30000 })
    const nav = page.getByRole('navigation', { name: '주 메뉴' })
    await nav.getByRole('button', { name: '내 목소리', exact: true }).click()
    const recordings = await page.locator('.voice-take-card').count()
    assert.ok(recordings > 0)
    await page.getByRole('button', { name: '듣기', exact: true }).first().click()
    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some((audio) => !audio.paused && audio.currentTime > 0))
    await nav.getByRole('button', { name: '만든 음성', exact: true }).click()
    const outputs = await page.locator('.audio-output-card').count()
    assert.ok(outputs > 0)
    await page.getByRole('button', { name: '듣기', exact: true }).first().click()
    await page.waitForFunction(() => [...document.querySelectorAll('audio')].some((audio) => !audio.paused && audio.currentTime > 0))
    await page.screenshot({ path: path.join(output, 'production-results.png'), fullPage: true })
    await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
    const engine = page.getByRole('combobox', { name: '음성 엔진' })
    await engine.waitFor()
    assert.ok((await engine.locator('option').allTextContents()).some((name) => name.includes('표현 음성')))
    await engine.selectOption('chatterbox-multilingual-v2')
    await page.getByRole('slider', { name: '표현 강도' }).waitFor()
    await page.screenshot({ path: path.join(output, 'production-expression.png'), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    await page.screenshot({ path: path.join(output, 'production-expression-mobile.png'), fullPage: true })
    const viewport = await page.evaluate(() => ({ inner: window.innerWidth, document: document.documentElement.scrollWidth }))
    assert.ok(viewport.document <= viewport.inner, `Mobile horizontal overflow: ${JSON.stringify(viewport)}`)
    assert.deepEqual(errors, [])
    assert.deepEqual(await hashes(data), before, 'User data changed during read-only acceptance')
    const evidence = { status: 'passed', recordings, outputs, dataFilesUnchanged: Object.keys(before).length,
      output, origin: 'https://recording-voice-web.vercel.app', checks: ['production auto pairing with installed runtime', 'existing voice playback advances', 'existing result playback advances', 'expression engine available in production UI', 'mobile expression screen has no horizontal overflow', 'no user data changes'],
      excluded: ['physical recording', 'auditory quality', 'new inference', 'manual local-network permission dialog'] }
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify(evidence, null, 2))
  } catch (error) {
    if (page) await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
    console.error(`Evidence directory: ${output}`)
    throw error
  } finally { await browser.close() }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1 })
