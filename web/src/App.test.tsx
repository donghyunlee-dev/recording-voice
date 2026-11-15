import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

describe('App storybook voice studio', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens on a book list with voices secondary and no LNB', async () => {
    vi.stubGlobal('fetch', readyRuntimeFetch('installed', [{
      id: 'saved-take', transcript: '엄마 목소리', created_at: '2026-11-03T00:00:00Z',
      duration_seconds: 4, sample_rate: 24_000, channels: 1, bytes: 192_044,
    }]))
    render(<App />)

    expect(await screen.findByRole('heading', { name: '스튜디오' })).toBeVisible()
    expect(screen.getByRole('heading', { name: /내 목소리/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /예시 동화 보기/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /목소리 녹음/ })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument()
    expect(screen.queryByText(/모델|메모리|RAM|Qwen/i)).not.toBeInTheDocument()
  })

  it('opens a book before conversion and leaves listening unavailable', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', readyRuntimeFetch('installed'))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /예시 동화 보기/ }))

    expect(screen.getByText('백설공주')).toBeVisible()
    expect(screen.getByRole('region', { name: '동화 본문' })).toBeVisible()
    expect(screen.getByRole('button', { name: '듣기' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '목소리 등록' })).toBeVisible()
  })

  it('keeps a voice after deletion fails and permits retry without duplicate requests', async () => {
    const user = userEvent.setup()
    const fetchMock = readyRuntimeFetch('installed', [{ id: 'saved-take', transcript: '보존할 대본', created_at: '2026-11-03T00:00:00Z', duration_seconds: 4, sample_rate: 24000, channels: 1, bytes: 192044 }])
    vi.stubGlobal('fetch', fetchMock)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    try {
      render(<App />)
      await user.click(await screen.findByRole('button', { name: '내 목소리' }))
      let finish!: (response: Response) => void
      fetchMock.mockReset().mockImplementation(() => new Promise<Response>((resolve) => { finish = resolve }))
      const remove = screen.getByRole('button', { name: '녹음 삭제' })
      await user.click(remove)
      expect(remove).toBeDisabled()
      await user.click(remove)
      expect(fetchMock).toHaveBeenCalledTimes(1)
      finish({ ok: false, status: 503, json: async () => ({ detail: { code: 'runtime_unavailable' } }) } as Response)
      expect(await screen.findByRole('alert')).toHaveTextContent('로컬 앱')
      expect(screen.getByText('보존할 대본')).toBeVisible()
      expect(remove).toBeEnabled()
      fetchMock.mockResolvedValue({ ok: true, status: 204 } as Response)
      await user.click(remove)
      await waitFor(() => expect(screen.queryByText('보존할 대본')).not.toBeInTheDocument())
    } finally { confirm.mockRestore() }
  })

  it('keeps saved voice playback and deletion available from voice management', async () => {
    const user = userEvent.setup()
    const transcript = '엄마와 아이가 함께 읽는 이야기입니다.\n마지막 문장도 그대로 남아요.'
    const fetchMock = readyRuntimeFetch('installed', [{
      id: 'saved-take', transcript, created_at: '2026-11-03T00:00:00Z',
      duration_seconds: 4, sample_rate: 24_000, channels: 1, bytes: 192_044,
    }])
    vi.stubGlobal('fetch', fetchMock)
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '내 목소리' }))
    expect(screen.getByRole('region', { name: '저장한 녹음 대본' }).querySelector('p')?.textContent).toBe(transcript)
    expect(screen.getByRole('button', { name: '듣기' })).toBeVisible()
    expect(screen.getByRole('button', { name: '녹음 삭제' })).toBeVisible()

    const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    const originalCreateObjectURL = URL.createObjectURL
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:saved-take') })
    fetchMock.mockReset().mockResolvedValue({ ok: true, blob: async () => new Blob(['wav']) } as Response)
    try {
      await user.click(screen.getByRole('button', { name: '듣기' }))
      await waitFor(() => expect(play).toHaveBeenCalledTimes(1))
      const player = screen.getByLabelText('저장된 음성 재생')
      fireEvent.play(player)
      expect(screen.getByRole('button', { name: '일시정지' })).toBeEnabled()
      fireEvent.ended(player)
      await user.click(screen.getByRole('button', { name: '다시 듣기' }))
      await waitFor(() => expect(play).toHaveBeenCalledTimes(2))
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      play.mockRestore()
      if (originalCreateObjectURL) Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: originalCreateObjectURL })
      else Reflect.deleteProperty(URL, 'createObjectURL')
    }
  })

  it('keeps the installer screen when the PC app is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('runtime unavailable')))
    render(<App />)

    expect(await screen.findByRole('heading', { name: 'PC 앱을 찾지 못했어요' })).toBeVisible()
    expect(screen.getByRole('button', { name: '연결 다시 확인' })).toBeVisible()
    expect(screen.queryByRole('navigation', { name: '주요 메뉴' })).not.toBeInTheDocument()
  })

  it('opens settings from the studio header and shows technical setup there', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', readyRuntimeFetch('installed'))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '설정' }))

    expect(screen.getByRole('heading', { name: '설정' })).toBeVisible()
    expect(screen.getByText('OS')).toBeVisible()
    expect(await screen.findByText('음성 변환 준비')).toBeVisible()
    expect(await screen.findByText('준비됨')).toBeVisible()
    expect(screen.getByText('RAM')).toBeVisible()
  })

  it('routes a saved voice into book conversion with a per-book voice choice', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', readyRuntimeFetch('installed', [{
      id: 'saved-take', transcript: '엄마 목소리', created_at: '2026-11-03T00:00:00Z',
      duration_seconds: 4, sample_rate: 24_000, channels: 1, bytes: 192_044,
    }]))
    render(<App />)

    await user.click(await screen.findByRole('button', { name: /예시 동화 보기/ }))
    await user.click(screen.getAllByRole('button', { name: '음성 만들기' }).at(-1)!)

    expect(await screen.findByRole('heading', { name: '음성 만들기' })).toBeVisible()
    expect((screen.getByRole('textbox', { name: '읽을 텍스트' }) as HTMLTextAreaElement).value).toContain('백설공주')
    expect(screen.getByRole('radio', { name: /저장한 목소리 1/ })).toBeChecked()
    expect(screen.queryByText(/Qwen|모델|메모리|RAM/i)).not.toBeInTheDocument()
  })
})

function readyRuntimeFetch(modelStatus: 'installed' | 'not_installed', recordings: unknown[] = []) {
  const model = {
    id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', revision: 'fixed-revision',
    status: modelStatus, language: 'Korean', license: 'Apache-2.0', download_size_bytes: 2_520_000_000,
    disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
  }
  return vi.fn(async (input: string) => {
    const path = new URL(input).pathname.split('/').pop()
    const data: Record<string, unknown> = {
      health: { status: 'ok', version: '0.1.0', api_version: 'v1', capabilities: ['workspaces', 'voice_names', 'job_history'], os: 'Windows' },
      pair: { access_token: 'memory-token', expires_in: 43200, token_type: 'Bearer' },
      system: { os: 'Windows', architecture: 'AMD64', cpu_logical_count: 12, memory_total_gib: 16, memory_available_gib: 8, model_cache_disk_free_gib: 20 },
      recordings: { items: recordings }, outputs: { items: [] }, workspaces: { items: [] }, jobs: { items: [] }, models: { items: [model] },
    }
    return { ok: true, json: async () => data[path!] } as Response
  })
}
