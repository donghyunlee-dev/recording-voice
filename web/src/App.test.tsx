import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App first-run flow', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('shows only setup guidance until the PC runtime and voice model are ready', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: '녹음 전에 PC를 준비해요' })).toBeVisible()
    expect(screen.getByText('동화로 완성')).toBeVisible()
    expect(screen.getByText('그림·대본·엄마 목소리')).toBeVisible()
    expect(screen.getByRole('heading', { name: 'PC 로컬 앱을 켜고 연결해요' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: '녹음 스튜디오' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Windows + WSL2 설치 가이드' })).toHaveAttribute('href', '/install/windows-wsl.md')
  })

  it('opens the recording studio as soon as pairing finds the installed model', async () => {
    const user = userEvent.setup()
    const fetchMock = stubReadyRuntime('installed')
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'terminal-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))

    expect(await screen.findByRole('heading', { name: '먼저 내 목소리를 녹음해요' })).toBeVisible()
    expect(screen.getByRole('navigation', { name: '주요 메뉴' })).toBeVisible()
    expect(screen.getByRole('button', { name: '마이크 연결 및 확인' })).toBeVisible()
    expect(fetchMock).toHaveBeenCalledTimes(6)
    expect(new Headers(fetchMock.mock.calls[2][1].headers).get('Authorization')).toBe('Bearer memory-token')
  })

  it('keeps navigation and recording hidden when the local model still needs setup', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', stubReadyRuntime('not_installed'))
    render(<App />)

    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'terminal-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))

    expect(await screen.findByRole('heading', { name: 'Qwen 음성 모델을 준비해요' })).toBeVisible()
    expect(screen.getByRole('button', { name: '이 PC에 모델 설치' })).toBeDisabled()
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '마이크 연결 및 확인' })).not.toBeInTheDocument()
  })

  it('shows the settings guide from the ready recording workspace', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', stubReadyRuntime('installed'))
    render(<App />)

    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'terminal-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))
    await screen.findByRole('heading', { name: '먼저 내 목소리를 녹음해요' })
    await user.click(screen.getByRole('link', { name: '설정 및 설치' }))

    expect(screen.getByRole('link', { name: 'Windows + WSL2 설치 가이드' })).toHaveAttribute('href', '/install/windows-wsl.md')
    expect(screen.getByRole('link', { name: 'PowerShell 설치 스크립트' })).toHaveAttribute('href', '/install/windows/install-local-voice.ps1')
    expect(screen.getByRole('link', { name: 'PowerShell 실행 스크립트' })).toHaveAttribute('href', '/install/windows/start-local-voice.ps1')
  })

  it('guides a saved voice take to the text-to-speech screen', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', stubReadyRuntime('installed', [{
      id: 'saved-take', transcript: '안녕하세요. 이것은 녹음 대본입니다.', created_at: '2026-11-03T00:00:00Z',
      duration_seconds: 4, sample_rate: 24_000, channels: 1, bytes: 192_044,
    }]))
    render(<App />)

    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'terminal-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))
    await screen.findByRole('button', { name: '동화 문장 읽어보기' })
    await user.click(screen.getByRole('button', { name: '동화 문장 읽어보기' }))

    expect(await screen.findByRole('heading', { name: '동화 문장을 엄마 목소리로 읽어봐요' })).toBeVisible()
    expect(screen.getByLabelText('읽을 문장')).toBeVisible()
  })

  it('opens a preset story and preloads its script into voice generation', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', stubReadyRuntime('installed'))
    render(<App />)

    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'terminal-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))
    await screen.findByRole('heading', { name: '먼저 내 목소리를 녹음해요' })
    await user.click(screen.getByRole('link', { name: '동화책' }))
    await user.click(screen.getByRole('button', { name: /빨간 모자/ }))
    await user.click(screen.getByRole('button', { name: '이 이야기로 음성 만들기' }))

    expect(await screen.findByRole('heading', { name: '동화 대본으로 엄마 목소리를 만들어요' })).toBeVisible()
    const scriptField = screen.getByLabelText('읽을 문장')
    expect((scriptField as HTMLTextAreaElement).value).toContain('빨간 모자는 아픈 할머니께 드릴 바구니를 들고 숲길을 걸었어요.')
    expect(screen.getByRole('button', { name: '이 동화 대본으로 음성 만들기' })).toBeVisible()
  })
})

function stubReadyRuntime(modelStatus: 'installed' | 'not_installed', recordings: unknown[] = []) {
  return vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', version: '0.1.0', api_version: 'v1' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'memory-token', expires_in: 43200, token_type: 'Bearer' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ os: 'Linux', architecture: 'x86_64', cpu_logical_count: 12, memory_total_gib: 7.5, memory_available_gib: 5.8, model_cache_disk_free_gib: 20 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: recordings }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{
      id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', revision: 'fixed-revision',
      status: modelStatus, language: 'Korean', license: 'Apache-2.0', download_size_bytes: 2_520_000_000,
      disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
    }] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [{
      id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', revision: 'fixed-revision',
      status: modelStatus, language: 'Korean', license: 'Apache-2.0', download_size_bytes: 2_520_000_000,
      disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
    }] }) })
}
