// Protected deployment smoke check; does not install or modify the user's runtime.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { createHash } = require('node:crypto')
async function run() {
  const target = new URL(process.argv[2])
  assert.equal(target.protocol, 'https:')
  assert.ok(target.hostname.endsWith('.vercel.app'))
  assert.ok(process.env.VERCEL_OIDC_TOKEN, 'Development OIDC token required')
  const output = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-preview-browser-'))
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  let page
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    // Never attach the deployment credential to local-runtime or third-party requests.
    await context.route(`${target.origin}/**`, (route) => route.continue({ headers: {
      ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    } }))
    page = await context.newPage()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    const response = await page.goto(target.origin)
    assert.equal(response.status(), 200, `Deployment returned HTTP ${response.status()}`)
    assert.equal(new URL(page.url()).origin, target.origin, 'Deployment authentication redirected away from the application')
    await page.getByRole('button', { name: '설치 안내', exact: true }).waitFor({ timeout: 30000 })
    await page.getByRole('button', { name: '설치 안내', exact: true }).click()
    const downloadLink = page.getByRole('link', { name: 'Windows 설치 프로그램 다운로드' })
    await downloadLink.waitFor()
    assert.equal(await downloadLink.getAttribute('href'), '/install/windows/VoiceStudioSetup.exe')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      await page.screenshot({ path: path.join(output, `install-${width}.png`), fullPage: true })
    }
    // Native download navigation does not preserve the injected OIDC header.
    // Verify the linked artifact with an explicitly authenticated same-origin request.
    const artifact = await context.request.get(`${target.origin}/install/windows/VoiceStudioSetup.exe`, {
      headers: { 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN }, maxRedirects: 0,
    })
    assert.equal(artifact.status(), 200)
    const hash = createHash('sha256').update(await artifact.body()).digest('hex')
    assert.equal(hash, '083c1459321eb11a2c66daa62ae6892141d4e79313e0538514218143dae143f5')
    assert.deepEqual(errors, [])
    const evidence = { status: 'passed', origin: target.origin, output, installerSha256: hash,
      checks: ['protected HTML and assets rendered', 'runtime unavailable leads to installation guide', 'desktop/mobile no overflow', 'authenticated installer response checksum'],
      excluded: ['native download click through deployment protection', 'installer execution', 'physical microphone', 'connected runtime workflow', 'voice quality'] }
    await fs.writeFile(path.join(output, 'evidence.json'), JSON.stringify(evidence, null, 2))
    console.log(JSON.stringify(evidence, null, 2))
  } catch (error) {
    if (page) {
      await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true })
      console.error(JSON.stringify({ output, title: await page.title(), pageOrigin: new URL(page.url()).origin }))
    }
    throw error
  } finally { await browser.close() }
}
run().catch((error) => { console.error(error.message); process.exitCode = 1 })
