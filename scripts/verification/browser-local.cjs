// Real browser + local API/storage; Chromium synthetic microphone, no model inference.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright')
const { spawn, spawnSync } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const assert = require('node:assert/strict')
const root = path.resolve(__dirname, '../..')
const children = []
let browser
async function waitReady(url) {
  for (let i = 0; i < 100; i++) {
    if (children.some((child) => child.exitCode !== null)) throw Error('Verification server exited')
    try { if ((await fetch(url)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw Error(`Server unavailable: ${url}`)
}
async function run() {
  const origin = process.env.VOICE_PREVIEW_ORIGIN || 'http://127.0.0.1:5175'
  const remote = Boolean(process.env.VOICE_PREVIEW_ORIGIN)
  if (remote) {
    const target = new URL(origin)
    assert.equal(target.origin, origin)
    assert.equal(target.protocol, 'https:')
    assert.ok(target.hostname.endsWith('.vercel.app'))
    assert.ok(process.env.VERCEL_OIDC_TOKEN, 'Preview authentication required')
    assert.equal(process.platform, 'win32', 'Deployed frontend requires a native Windows runtime')
  }
  const runtimePython = process.env.VOICE_PYTHON || path.join(root, '.venv/bin/python')
  const isolateExistingRuntime = remote && process.env.VOICE_SKIP_EXISTING_RUNTIME === '1'
  for (const port of (isolateExistingRuntime ? [8765] : [5175, 8765, 8766])) {
    try { await fetch(`http://127.0.0.1:${port}`); throw Error(`Port ${port} is already occupied`) }
    catch (error) { if (error.message.includes('occupied')) throw error }
  }
  const data = await fs.mkdtemp(path.join(os.tmpdir(), 'voice-browser-data-'))
  const env = { ...process.env, LOCAL_VOICE_PORT: '8765', LOCAL_VOICE_AUTO_PAIR: '1', LOCAL_VOICE_DATA_DIR: data, LOCAL_VOICE_ALLOWED_ORIGINS: origin }
  children.push(spawn(runtimePython, ['-m', 'local_runtime.app'], { cwd: root, env, stdio: 'ignore' }))
  if (!remote) children.push(spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5175', '--strictPort'], { cwd: path.join(root, 'web'), stdio: 'ignore' }))
  await waitReady('http://127.0.0.1:8765/api/v1/health')
  if (!remote) await waitReady(origin)
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, headless: true, args: ['--use-fake-device-for-media-stream'] })
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, permissions: ['microphone'] })
  if (isolateExistingRuntime) await context.route('http://127.0.0.1:8766/**', (route) => route.abort())
  if (remote) {
    await context.grantPermissions(['local-network-access'], { origin })
    await context.route(`${origin}/**`, (route) => route.continue({ headers: {
      ...route.request().headers(), 'x-vercel-trusted-oidc-idp-token': process.env.VERCEL_OIDC_TOKEN,
    } }))
  }
  const page = await context.newPage()
  const errors = []
  const networkFailures = []
  page.on('requestfailed', (request) => {
    const url = new URL(request.url())
    networkFailures.push({ url: url.origin + url.pathname, error: request.failure()?.errorText })
  })
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(origin)
  try {
    await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  } catch (error) {
    await page.screenshot({ path: path.join(data, 'connection-failure.png'), fullPage: true })
    await fs.writeFile(path.join(data, 'connection-failure.json'), JSON.stringify({ title: await page.title(), text: await page.locator('body').innerText(), networkFailures, errors }, null, 2))
    console.error(`Connection evidence: ${data}`)
    throw error
  }
  const nav = page.getByRole('navigation', { name: '주 메뉴' })
  await page.keyboard.press('Tab')
  assert.equal(await page.getByRole('button', { name: '스튜디오 홈', exact: true }).evaluate((el) => el === document.activeElement), true)
  await page.keyboard.press('Tab')
  assert.equal(await nav.getByRole('button', { name: '스튜디오', exact: true }).evaluate((el) => el === document.activeElement), true)
  await page.keyboard.press('Tab')
  const keyboardRecord = nav.getByRole('button', { name: '녹음', exact: true })
  assert.equal(await keyboardRecord.evaluate((el) => el === document.activeElement), true)
  const focusStyle = await keyboardRecord.evaluate((el) => {
    const style = getComputedStyle(el)
    return { width: parseFloat(style.outlineWidth), style: style.outlineStyle }
  })
  assert.ok(focusStyle.width >= 2 && focusStyle.style !== 'none', 'Keyboard focus must be visible')
  await page.keyboard.press('Enter')
  await page.getByRole('button', { name: '마이크 연결', exact: true }).waitFor()
  await nav.getByRole('button', { name: '녹음', exact: true }).click()
  const permissions = await context.newCDPSession(page)
  const { targetInfo } = await permissions.send('Target.getTargetInfo')
  await permissions.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId, permission: { name: 'microphone' }, setting: 'denied', origin })
  await page.getByRole('button', { name: '마이크 연결', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '마이크 권한이 거부되었습니다.' }).waitFor({ timeout: 5000 })
  assert.equal(await page.getByRole('button', { name: '녹음 시작', exact: true }).isDisabled(), true)
  await permissions.send('Browser.setPermission', { browserContextId: targetInfo.browserContextId, permission: { name: 'microphone' }, setting: 'granted', origin })
  await page.getByRole('button', { name: '마이크 연결', exact: true }).click()
  await page.getByRole('meter', { name: '마이크 입력 레벨' }).waitFor()
  await page.getByRole('button', { name: '녹음 시작', exact: true }).click()
  await page.getByRole('timer', { name: /녹음 시간/ }).waitFor()
  await page.waitForTimeout(1800)
  await page.getByRole('button', { name: '일시정지', exact: true }).click()
  const pausedNavigation = page.waitForEvent('dialog').then(async (dialog) => {
    assert.equal(dialog.type(), 'confirm')
    assert.match(dialog.message(), /저장하지 않은 녹음/)
    await dialog.dismiss()
  })
  await nav.getByRole('button', { name: '스튜디오', exact: true }).click()
  await pausedNavigation
  await page.getByRole('button', { name: '이어 녹음', exact: true }).click()
  await page.waitForTimeout(1200)
  await page.getByRole('button', { name: '중지', exact: true }).click()
  await page.getByRole('button', { name: '녹음 미리 듣기', exact: true }).waitFor()
  const readyNavigation = page.waitForEvent('dialog').then((dialog) => dialog.dismiss())
  await nav.getByRole('button', { name: '내 목소리', exact: true }).click()
  await readyNavigation
  assert.equal(await page.getByRole('button', { name: '목소리 저장', exact: true }).count(), 1)
  await page.getByLabel('목소리 이름', { exact: true }).fill('검증 목소리')
  await page.getByRole('button', { name: '목소리 저장', exact: true }).click()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '내 목소리', exact: true }).click()
  await page.getByLabel('목소리 이름', { exact: true }).fill('보존한 목소리')
  await page.getByRole('button', { name: '이름 저장', exact: true }).click()
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some((b) => b.textContent === '이름 저장' && b.disabled))
  await page.getByRole('button', { name: '듣기', exact: true }).click()
  await page.waitForFunction(() => { const audio = document.querySelector('audio'); return audio && audio.currentTime > 0 })
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await page.getByLabel('제목', { exact: true }).fill('실제 API 작업')
  await page.getByRole('textbox', { name: '읽을 텍스트' }).fill('다시 열어도 보존되는 대본입니다.')
  const expressionChecks = Boolean(process.env.LOCAL_VOICE_EXPRESSION_MODEL_DIR)
  if (expressionChecks) {
    await page.getByRole('combobox', { name: '음성 엔진' }).selectOption('chatterbox-multilingual-v2')
    const slider = page.getByRole('slider', { name: '표현 강도' })
    await slider.focus()
    await page.keyboard.press('ArrowRight')
    assert.equal(await slider.inputValue(), '0.55')
  }
  await page.getByRole('button', { name: '작업 저장', exact: true }).click()
  await page.getByText('저장됨', { exact: true }).waitFor()
  await page.reload()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await page.getByRole('option', { name: '실제 API 작업' }).waitFor({ state: 'attached' })
  assert.equal(await page.getByRole('textbox', { name: '읽을 텍스트' }).inputValue(), '다시 열어도 보존되는 대본입니다.')
  assert.notEqual(await page.getByRole('combobox', { name: '저장한 작업' }).inputValue(), '')
  if (expressionChecks) {
    assert.equal(await page.getByRole('combobox', { name: '음성 엔진' }).inputValue(), 'chatterbox-multilingual-v2')
    assert.equal(await page.getByRole('slider', { name: '표현 강도' }).inputValue(), '0.55')
  }
  const manifests = await fs.readdir(path.join(data, 'recordings'))
  const voice = JSON.parse(await fs.readFile(path.join(data, 'recordings', manifests.find((f) => f.endsWith('.json')))))
  assert.equal(voice.name, '보존한 목소리')
  assert.ok(voice.duration_seconds > 0)
  const workFiles = await fs.readdir(path.join(data, 'workspaces'))
  assert.equal(workFiles.filter((file) => file.endsWith('.json')).length, 1)
  // Seed two result fixtures from the captured WAV. This verifies result management,
  // not synthesis: all subsequent reads, selection and deletion use the running API.
  const workPath = path.join(data, 'workspaces', workFiles.find((file) => file.endsWith('.json')))
  const work = JSON.parse(await fs.readFile(workPath))
  const seeded = spawnSync(runtimePython, ['-c', `
import sys
from pathlib import Path
from local_runtime.app.storage import LocalOutputStore
root = Path(sys.argv[1])
audio = (root / 'recordings' / (sys.argv[2] + '.wav')).read_bytes()
store = LocalOutputStore(root)
for version in range(2):
    store.save(audio, {'workspace_id': sys.argv[3], 'recording_id': sys.argv[2], 'text': '결과 비교 ' + str(version + 1), 'model_id': 'qwen3-tts-0.6b-base', 'generation_seconds': 0, 'model_load_seconds': 0, 'peak_rss_mib': 0})
`, data, voice.id, work.id], { cwd: root, encoding: 'utf8' })
  assert.equal(seeded.status, 0, seeded.stderr)
  await page.reload()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  const history = page.getByRole('region', { name: '생성 이력' })
  await history.getByRole('button', { name: '최종 결과로 선택', exact: true }).first().click()
  await history.getByRole('button', { name: '최종 결과', exact: true, pressed: true }).waitFor()
  await history.getByRole('button', { name: '듣기', exact: true }).first().click()
  await page.waitForFunction(() => [...document.querySelectorAll('.generation-history audio')].some((audio) => !audio.paused && audio.currentTime > 0))
  await history.getByRole('button', { name: '듣기', exact: true }).click()
  await page.waitForFunction(() => {
    const audio = [...document.querySelectorAll('.generation-history audio')]
    return audio.length === 2 && audio[0].paused && !audio[1].paused && audio[1].currentTime > 0
  })
  await history.getByRole('button', { name: '일시정지', exact: true }).click()
  // Reload so export is still tested before any playback in the fresh screen.
  await page.reload()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await history.getByRole('button', { name: '최종 결과', exact: true, pressed: true }).waitFor()
  const selected = JSON.parse(await fs.readFile(workPath)).selected_output_id
  assert.ok(selected)
  const downloadPromise = page.waitForEvent('download')
  await history.getByRole('button', { name: 'WAV 다운로드', exact: true }).first().click()
  const download = await downloadPromise
  assert.equal(download.suggestedFilename(), `voice-${selected}.wav`)
  const downloaded = await fs.readFile(await download.path())
  assert.deepEqual(downloaded, await fs.readFile(path.join(data, 'recordings', `${voice.id}.wav`)))
  assert.equal(await history.locator('audio').first().evaluate((audio) => audio.paused), true)
  await page.reload()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await history.getByRole('button', { name: '최종 결과', exact: true, pressed: true }).waitFor()
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.screenshot({ path: path.join(data, `results-${width}.png`), fullPage: true })
    const dimensions = await page.evaluate(() => ({ width: window.innerWidth, documentWidth: document.documentElement.scrollWidth }))
    assert.ok(dimensions.documentWidth <= dimensions.width, `Horizontal overflow at ${width}px: ${JSON.stringify(dimensions)}`)
  }
  await page.setViewportSize({ width: 1440, height: 1000 })
  await nav.getByRole('button', { name: '만든 음성', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '결과 삭제', exact: true }).first().click()
  await page.waitForFunction(() => document.querySelectorAll('.audio-output-card').length === 1)
  assert.equal(JSON.parse(await fs.readFile(workPath)).selected_output_id, null)
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await history.getByRole('button', { name: '최종 결과로 선택', exact: true }).waitFor()
  assert.equal(await history.getByRole('button', { name: '최종 결과', exact: true }).count(), 0)
  const interrupted = spawnSync(runtimePython, ['-c', `
import sys
from pathlib import Path
from local_runtime.app.jobs import JobStore
store = JobStore(Path(sys.argv[1]))
job = store.create('generation', workspace_id=sys.argv[2], recording_id=sys.argv[3], model_id='qwen3-tts-0.6b-base', text='다시 열어도 보존되는 대본입니다.')
store.update(job['id'], status='generating')
print(job['id'])
`, data, work.id, voice.id], { cwd: root, encoding: 'utf8' })
  assert.equal(interrupted.status, 0, interrupted.stderr)
  const stopped = new Promise((resolve) => children[0].once('exit', resolve))
  children[0].kill('SIGTERM')
  await stopped
  children[0] = spawn(runtimePython, ['-m', 'local_runtime.app'], { cwd: root, env, stdio: 'ignore' })
  await waitReady('http://127.0.0.1:8765/api/v1/health')
  await page.reload()
  await page.getByRole('heading', { name: '스튜디오', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: 'PC 앱이 재시작되어 생성이 중단되었습니다.' }).waitFor()
  assert.equal(await page.getByRole('textbox', { name: '읽을 텍스트' }).inputValue(), work.text)
  await page.getByRole('button', { name: '다시 생성', exact: true }).waitFor()
  const recovered = JSON.parse(await fs.readFile(path.join(data, 'jobs', `${interrupted.stdout.trim()}.json`)))
  assert.equal(recovered.status, 'failed')
  assert.equal(recovered.error_code, 'runtime_restarted')
  await nav.getByRole('button', { name: '내 목소리', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: '녹음 삭제', exact: true }).click()
  await page.getByRole('button', { name: '첫 음성 녹음하기', exact: true }).waitFor()
  await nav.getByRole('button', { name: '음성 만들기', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '등록한 목소리를 찾을 수 없습니다.' }).waitFor()
  assert.equal(await page.getByRole('button', { name: '다시 생성', exact: true }).isDisabled(), true)
  assert.equal(await page.getByRole('textbox', { name: '읽을 텍스트' }).inputValue(), work.text)
  assert.equal(await history.locator('.audio-output-card').count(), 1)
  assert.deepEqual(errors, [])
  const evidence = { status: 'passed', expressionSettingsKeyboardAndReload: expressionChecks, origin, deployedFrontend: remote, existingRuntimeIsolated: isolateExistingRuntime, dataDirectory: data, recordingDuration: voice.duration_seconds, checks: ['keyboard Tab order, visible focus and Enter navigation', 'browser microphone denial then permission grant and reconnect', 'synthetic microphone capture/pause/resume/WAV save', 'cancelled navigation retains paused and unsaved recording', 'voice rename persisted', 'first saved audio playback', 'workspace saved via real API', 'reload restores draft and workspace identity', 'no duplicate workspace', 'two fixture results and persisted final selection', 'starting result B pauses result A', 'download before playback matches stored WAV bytes', 'selected result deletion clears selection on reopen', 'populated generation screen has no document overflow at 1440 and 390px', 'runtime restart exposes interrupted job and preserves script', 'deleted source voice blocks generation without removing script or outputs', 'no browser page errors'], excluded: ['physical microphone', 'Windows installer', 'model inference', 'voice likeness', 'emotion quality'] }
  await fs.writeFile(path.join(data, 'evidence.json'), JSON.stringify(evidence, null, 2))
  console.log(JSON.stringify(evidence, null, 2))
}
run().catch((error) => { console.error(error); process.exitCode = 1 }).finally(async () => { await browser?.close(); for (const child of children) child.kill('SIGTERM') })
