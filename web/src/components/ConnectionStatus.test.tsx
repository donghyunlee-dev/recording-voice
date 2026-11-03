import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConnectionStatus } from './ConnectionStatus'

describe('ConnectionStatus', () => {
  it('explains when the local runtime is not connected', () => {
    render(<ConnectionStatus state="disconnected" />)

    expect(screen.getByRole('status')).toHaveTextContent('로컬 런타임 연결 대기')
    expect(screen.getByText(/터미널에 표시된 페어링 코드/)).toBeVisible()
  })

  it('shows actionable guidance when the browser blocks local access', () => {
    render(<ConnectionStatus state="permission-denied" />)

    expect(screen.getByRole('status')).toHaveTextContent('브라우저 권한이 필요합니다')
    expect(screen.getByText(/로컬 네트워크\/Loopback 권한/)).toBeVisible()
  })

  it('lets the user explicitly pair with the local runtime', async () => {
    const user = userEvent.setup()
    const onPair = vi.fn().mockResolvedValue(undefined)
    render(<ConnectionStatus state="disconnected" onPair={onPair} />)

    await user.click(screen.getByRole('button', { name: '로컬 앱 연결' }))
    await user.type(screen.getByLabelText('터미널 페어링 코드'), 'test-pair-code')
    await user.click(screen.getByRole('button', { name: '코드 확인 후 연결' }))

    expect(onPair).toHaveBeenCalledWith('test-pair-code')
  })
})
