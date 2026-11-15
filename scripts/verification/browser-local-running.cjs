const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const assert = require('node:assert/strict')
async function run() {
  assert.equal(process.platform, 'win32')
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true })
  try {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } })
    const page = await context.newPage()
    await page.goto('http://127.0.0.1:5173/')
    await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor({ timeout: 15000 })
    const nav = page.getByRole('navigation', { name: '주 메뉴' })
    await nav.getByRole('button', { name: '내 목소리', exact: true }).click()
    assert.equal(await page.locator('.voice-take-card').count(), 2)
    await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
    const engine = page.getByRole('combobox', { name: '음성 엔진' })
    await engine.waitFor()
    assert.ok((await engine.locator('option').allTextContents()).some((name) => name.includes('표현 음성')))
    await page.getByRole('combobox', { name: '저장한 작업' }).selectOption({ label: '표현 음성 샘플' })
    await page.getByText('표현 음성 · 강도 80%').waitFor()
    console.log(JSON.stringify({ status: 'passed', url: 'http://127.0.0.1:5173/', recordings: 2, engine: '표현 음성', sampleWork: '표현 음성 샘플' }))
  } finally { await browser.close() }
}
run().catch((error) => { console.error(error); process.exitCode = 1 })
