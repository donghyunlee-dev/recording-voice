import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Recorder } from './Recorder'

describe('Recorder narration prompts', () => {
  it('keeps the script, microphone and record controls in a compact visual workflow', async () => {
    const user = userEvent.setup()
    render(<Recorder token="local-token" onSaved={vi.fn()} />)

    await user.selectOptions(screen.getByRole('combobox', { name: '동화 문장 선택' }), 'snow-white')

    expect(screen.getByLabelText('읽을 대본')).toHaveValue('깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.')
    expect(screen.getByRole('button', { name: '마이크 연결' })).toBeVisible()
    expect(screen.getByRole('button', { name: '녹음 시작' })).toBeVisible()
    expect(screen.queryByText(/자동 전사는 아직 지원하지 않아/)).not.toBeInTheDocument()
    expect(screen.queryByText(/여러 번 녹음해도 괜찮아요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1단계|2단계|3단계/)).not.toBeInTheDocument()
    expect(screen.getByText('오디오 파일 가져오기').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('읽을 대본').compareDocumentPosition(screen.getByRole('button', { name: '마이크 연결' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })
})
