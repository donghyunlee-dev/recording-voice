import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SetupScreen } from './SetupScreen'

describe('SetupScreen', () => {
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('uses one detected-state heading when the Windows app is running', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', version: '0.1.0', api_version: 'v1', os: 'Windows' }),
    }))

    render(<SetupScreen onPair={vi.fn().mockResolvedValue(undefined)} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'PC 앱을 찾았어요' })).toBeVisible()
    expect(screen.queryByRole('heading', { level: 2, name: 'PC 앱을 찾았어요' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '이 PC에 연결' })).toBeVisible()
    expect(screen.getByLabelText('PC 앱 실행 중')).toBeVisible()
    expect(screen.queryByText('이 PC의 로컬 앱이 실행 중입니다.')).not.toBeInTheDocument()
    expect(screen.queryByText('PC 앱 연결')).not.toBeInTheDocument()
  })

  it('uses an unavailable-state heading and keeps retry and install actions', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))

    render(<SetupScreen onPair={vi.fn().mockResolvedValue(undefined)} />)

    expect(await screen.findByRole('heading', { level: 1, name: 'PC 앱을 찾지 못했어요' })).toBeVisible()
    expect(screen.getByRole('button', { name: '연결 다시 확인' })).toBeVisible()
    expect(screen.getByRole('button', { name: '설치 안내' })).toBeVisible()
    expect(screen.getByLabelText('PC 앱을 찾지 못함')).toBeVisible()
  })

  it('changes the page title to connecting while pairing is in progress', async () => {
    const user = userEvent.setup()
    let rejectPairing!: (reason: Error) => void
    const onPair = vi.fn(() => new Promise<void>((_, reject) => { rejectPairing = reject }))
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', version: '0.1.0', api_version: 'v1', os: 'Windows' }),
    }))

    render(<SetupScreen onPair={onPair} />)
    await user.click(await screen.findByRole('button', { name: '이 PC에 연결' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'PC 앱을 연결하고 있어요' })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: 'PC 앱 연결 중' })).toBeVisible()
    rejectPairing(new Error('연결에 실패했습니다.'))
    expect(await screen.findByRole('alert')).toHaveTextContent('연결에 실패했습니다.')
  })

  it('shows only installation actions after the user opens install guidance', async () => {
    const user = userEvent.setup()
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')))

    render(<SetupScreen onPair={vi.fn().mockResolvedValue(undefined)} />)
    await user.click(await screen.findByRole('button', { name: '설치 안내' }))

    expect(screen.getByRole('heading', { name: '내 PC 앱 설치' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Windows 설치 프로그램 다운로드' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Windows 설치 안내' })).toBeVisible()
    expect(screen.queryByText(/설치 파일을 내려받아 열고 안내에 따라/)).not.toBeInTheDocument()
  })
})
