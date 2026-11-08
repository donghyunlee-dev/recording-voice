import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { App } from './App'

vi.mock('./features/recorder/Recorder', () => ({
  Recorder: ({ onSaved }: { onSaved: (recording: { id: string; transcript: string; created_at: string; duration_seconds: number; sample_rate: number; channels: number; bytes: number }) => void }) => <button type="button" onClick={() => onSaved({
    id: 'new-recording', transcript: '엄마 목소리로 다시 읽을 저장 대본입니다.', created_at: '2026-11-03T00:00:00Z', duration_seconds: 8, sample_rate: 24_000, channels: 1, bytes: 384_044,
  })}>테스트 녹음 저장</button>,
}))

describe('recording save handoff', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('opens voice generation with the just-saved transcript already filled in', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', readyRuntimeFetch())
    render(<App />)

    await user.click(await screen.findByRole('button', { name: '이 PC에 연결' }))
    await screen.findByRole('heading', { name: '먼저 내 목소리를 녹음해요' })
    await user.click(screen.getByRole('button', { name: '테스트 녹음 저장' }))

    expect(await screen.findByRole('heading', { name: '음성 생성' })).toBeVisible()
    expect(screen.getByLabelText('동화 대본')).toHaveValue('엄마 목소리로 다시 읽을 저장 대본입니다.')
    expect(screen.getByRole('button', { name: '저장된 텍스트로 음성 만들기' })).toBeVisible()
  })
})

function readyRuntimeFetch() {
  const model = { id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', revision: 'fixed-revision', status: 'installed', language: 'Korean', license: 'Apache-2.0', download_size_bytes: 2_520_000_000, disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7 }
  return vi.fn()
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', version: '0.1.0', api_version: 'v1', os: 'Windows' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', version: '0.1.0', api_version: 'v1', os: 'Windows' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'memory-token', expires_in: 43200, token_type: 'Bearer' }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ os: 'Windows', architecture: 'AMD64', cpu_logical_count: 12, memory_total_gib: 16, memory_available_gib: 8, model_cache_disk_free_gib: 20 }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [model] }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ items: [model] }) })
}
