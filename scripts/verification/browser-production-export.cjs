const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { createHash } = require('node:crypto')
const fs = require('node:fs/promises')
const path = require('node:path')
const assert = require('node:assert/strict')
async function run() {
  assert.equal(process.platform, 'win32')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true })
    await context.grantPermissions(['local-network-access'], { origin: 'https://recording-voice-web.vercel.app' })
    const page = await context.newPage()
    await page.goto('https://recording-voice-web.vercel.app')
    await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
    await page.getByRole('navigation', { name: '주 메뉴' }).getByRole('button', { name: '음성 만들기', exact: true }).click()
    await page.getByRole('combobox', { name: '저장한 작업' }).selectOption({ label: '표현 음성 샘플' })
    const history = page.getByRole('region', { name: '생성 이력' })
    await history.getByText('표현 음성 · 강도 80%').waitFor()
    const downloadPromise = page.waitForEvent('download')
    await history.getByRole('button', { name: 'WAV 다운로드' }).click()
    const download = await downloadPromise
    const outputId = '9c10a0e7-9598-46ee-a8ce-831eecbbe453'
    assert.equal(download.suggestedFilename(), `voice-${outputId}.wav`)
    const stored = path.join(process.env.LOCALAPPDATA, 'VoiceStudio', 'data', 'outputs', `${outputId}.wav`)
    const actual = await fs.readFile(await download.path())
    const expected = await fs.readFile(stored)
    assert.deepEqual(actual, expected)
    console.log(JSON.stringify({ status: 'passed', work: '표현 음성 샘플', outputId, bytes: actual.length, sha256: createHash('sha256').update(actual).digest('hex'), persistedAfterReopen: true, downloadMatchesStoredWav: true }))
  } finally { await browser.close() }
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
