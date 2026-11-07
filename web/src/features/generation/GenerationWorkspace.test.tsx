import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerationWorkspace } from './GenerationWorkspace'
import { listModels } from '../../api/localRuntime'

vi.mock('../../api/localRuntime', () => ({
  cancelJob: vi.fn(),
  createGeneration: vi.fn(),
  getJob: vi.fn(),
  installModel: vi.fn(),
  listModels: vi.fn(),
}))

const recordings = [
  { id: 'voice-mom', transcript: '엄마 목소리', created_at: '2026-11-08T00:00:00Z', duration_seconds: 24, sample_rate: 48_000, channels: 1, bytes: 100_000 },
  { id: 'voice-dad', transcript: '아빠 목소리', created_at: '2026-11-07T00:00:00Z', duration_seconds: 18, sample_rate: 48_000, channels: 1, bytes: 80_000 },
]

const installedModel = {
  id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', status: 'installed' as const,
  language: 'Korean', license: 'Apache-2.0', revision: 'fixed-revision', download_size_bytes: 2_520_000_000,
  disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
}

function renderWorkspace() {
  return render(<GenerationWorkspace
    token="test-token"
    recordings={recordings}
    initialText="엄마와 아이가 함께 읽는 동화 대본입니다."
    draftSource="storybook"
    onOutputCreated={() => undefined}
    onNavigate={() => undefined}
  />)
}

describe('GenerationWorkspace', () => {
  beforeEach(() => vi.mocked(listModels).mockResolvedValue([installedModel]))

  it('selects a saved voice from a card', async () => {
    renderWorkspace()

    const savedVoice = await screen.findByRole('radio', { name: /11월 7일.*18초/ })
    fireEvent.click(savedVoice)

    expect(savedVoice).toBeChecked()
    expect(screen.getByRole('radio', { name: /11월 8일.*24초/ })).not.toBeChecked()
  })

  it('shows installed model state on the selected model card', async () => {
    renderWorkspace()

    const modelCard = await screen.findByRole('radio', { name: /Qwen3-TTS 0\.6B Base/ })
    await waitFor(() => expect(modelCard).toBeChecked())
    expect(screen.getByText('설치됨')).toBeVisible()
    expect(screen.queryAllByRole('combobox')).toHaveLength(0)
    expect(screen.getByRole('textbox', { name: '동화 대본' })).toHaveValue('엄마와 아이가 함께 읽는 동화 대본입니다.')
  })
})
