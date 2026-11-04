import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Recorder } from './Recorder'

describe('Recorder narration prompts', () => {
  it('offers short fairy-tale scripts that fill the saved transcript', async () => {
    const user = userEvent.setup()
    render(<Recorder token="local-token" onSaved={vi.fn()} />)

    await user.selectOptions(screen.getByLabelText('1단계 · 읽을 동화 대본'), 'snow-white')

    expect(screen.getByLabelText('녹음할 문장')).toHaveValue('깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.')
    expect(screen.getByText(/여러 번 녹음해도 괜찮아요/)).toBeVisible()
    expect(screen.getByText('기존 오디오 파일이 있나요?').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('1단계 · 읽을 동화 대본').compareDocumentPosition(screen.getByLabelText('녹음할 문장')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
