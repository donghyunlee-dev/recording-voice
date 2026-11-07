import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AudioOutputCard } from './AudioOutputCard'

describe('AudioOutputCard', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('puts playback and deletion in the result toolbar and hides technical details until opened', () => {
    const output = {
      id: 'output-1',
      text: '생성된 문장입니다.',
      created_at: '2026-11-05T00:13:39Z',
      duration_seconds: 13.4,
      sample_rate: 24_000,
      bytes: 42_000,
      model_id: 'qwen3-tts-0.6b-base',
      recording_id: 'recording-1',
      generation_seconds: 344.4,
      model_load_seconds: 52.9,
      peak_rss_mib: 3_800,
    }

    render(<AudioOutputCard token="test-token" output={output} onDeleted={() => undefined} />)

    expect(screen.getByRole('button', { name: '생성된 음성 듣기' })).toBeVisible()
    expect(screen.getByRole('button', { name: '결과 삭제' })).toBeVisible()
    expect(screen.getByText('생성된 문장입니다.')).toBeVisible()
    expect(screen.getByRole('time')).toHaveAttribute('dateTime', output.created_at)
    expect(screen.getByText('13.4초')).toBeVisible()

    const details = screen.getByRole('group', { name: '파일 정보' })
    expect(details).not.toHaveAttribute('open')
    expect(screen.getByText('24,000 Hz')).not.toBeVisible()
    expect(screen.getByText('모델 준비 52.9초')).not.toBeVisible()
    details.querySelector('summary')?.click()
    expect(screen.getByText('24,000 Hz')).toBeVisible()
  })

  it('does not delete a result when the user cancels the confirmation', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    vi.stubGlobal('fetch', fetchMock)

    render(<AudioOutputCard token="test-token" output={{
      id: 'output-1', text: '생성된 문장입니다.', created_at: '2026-11-05T00:13:39Z', duration_seconds: 13.4,
      sample_rate: 24_000, bytes: 42_000, model_id: 'qwen3-tts-0.6b-base', recording_id: 'recording-1',
      generation_seconds: 344.4, model_load_seconds: 52.9, peak_rss_mib: 3_800,
    }} onDeleted={() => undefined} />)

    await user.click(screen.getByRole('button', { name: '결과 삭제' }))

    expect(confirm).toHaveBeenCalledWith('이 생성 결과를 삭제할까요?')
    expect(fetchMock).not.toHaveBeenCalled()
    confirm.mockRestore()
  })
})
