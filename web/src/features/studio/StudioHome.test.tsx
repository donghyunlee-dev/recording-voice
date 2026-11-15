import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StudioHome } from './StudioHome'
import { storybooks, storyScript } from '../storybook/storybookData'
import type { LocalOutput, LocalRecording } from '../../api/localRuntime'

const voice: LocalRecording = {
  id: 'mom-voice', transcript: '엄마 목소리로 읽는 짧은 대본입니다.', created_at: '2026-11-08T00:00:00Z',
  duration_seconds: 18, sample_rate: 24_000, channels: 1, bytes: 864_044,
}

const output: LocalOutput = {
  id: 'snow-white-audio', created_at: '2026-11-08T01:00:00Z', duration_seconds: 32, sample_rate: 24_000,
  bytes: 768_044, model_id: 'qwen3-tts-0.6b-base', recording_id: voice.id,
  text: storyScript(storybooks[0]), model_load_seconds: 2, generation_seconds: 30, peak_rss_mib: 5_200,
}

const props = {
  recordings: [voice], outputs: [] as LocalOutput[],
  onRegisterVoice: vi.fn(), onManageVoices: vi.fn(), onOpenStory: vi.fn(), onGenerateStory: vi.fn(),
  onOpenOutput: vi.fn(), onComposeText: vi.fn(),
}

describe('StudioHome', () => {
  it('puts recording and generation first without technical setup copy', () => {
    render(<StudioHome {...props} />)
    expect(screen.getByRole('heading', { name: '스튜디오' })).toBeVisible()
    expect(screen.getByRole('heading', { name: /내 목소리/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: /목소리 녹음/ }))
    expect(props.onRegisterVoice).toHaveBeenCalled()
    expect(screen.queryByText(/모델|메모리|RAM|Qwen/i)).not.toBeInTheDocument()
  })
  it('keeps example content accessible as a secondary action', () => {
    render(<StudioHome {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /예시 동화 보기/ }))
    expect(props.onOpenStory).toHaveBeenCalledWith(storybooks[0])
  })
  it('starts a free-text generation', () => {
    render(<StudioHome {...props} />)
    fireEvent.click(screen.getByRole('button', { name: /음성 만들기/ }))
    expect(props.onComposeText).toHaveBeenCalled()
  })
  it('opens a previously generated result', () => {
    render(<StudioHome {...props} outputs={[output]} />)
    fireEvent.click(screen.getByRole('button', { name: /만든 음성/ }))
    expect(props.onOpenOutput).toHaveBeenCalledWith(output)
  })
})
