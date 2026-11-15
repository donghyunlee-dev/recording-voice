import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Recorder } from './Recorder'

describe('Recorder narration prompts', () => {
  it('keeps the script, microphone and record controls in a compact visual workflow', async () => {
    const user = userEvent.setup()
    render(<Recorder token="local-token" onSaved={vi.fn()} />)

    expect(screen.getByRole('radio', { name: /백설공주/ })).toBeChecked()
    expect(screen.getByLabelText('녹음할 대본')).toHaveValue('깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.')
    await user.click(screen.getByRole('radio', { name: /백설공주/ }))

    expect(screen.getByLabelText('녹음할 대본')).toHaveValue('깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.')
    expect(screen.getByLabelText('녹음할 대본')).not.toHaveAttribute('placeholder')
    expect(screen.queryByText('내 목소리 녹음')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '마이크 연결' })).toBeVisible()
    expect(screen.queryByText('마이크')).not.toBeInTheDocument()
    expect(screen.queryByText('연결 전')).not.toBeInTheDocument()
    expect(screen.queryByText('녹음 준비 전')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '녹음 시작' })).toBeVisible()
    expect(screen.getByRole('button', { name: '녹음 시작' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '일시정지' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '중지' }).querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByText(/자동 전사는 아직 지원하지 않아/)).not.toBeInTheDocument()
    expect(screen.queryByText(/여러 번 녹음해도 괜찮아요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1단계|2단계|3단계/)).not.toBeInTheDocument()
    expect(screen.getByText('오디오 파일 가져오기').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('녹음할 대본').compareDocumentPosition(screen.getByRole('button', { name: '마이크 연결' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('selects a microphone from the compact menu and locks choices while recording', async () => {
    const user = userEvent.setup()
    const track = { getSettings: () => ({ deviceId: 'test-mic', sampleRate: 48_000, channelCount: 1 }), stop: vi.fn() }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      enumerateDevices: vi.fn().mockResolvedValue([
        { kind: 'audioinput', deviceId: 'test-mic', label: 'USB 마이크' },
        { kind: 'audioinput', deviceId: 'built-in-mic', label: '내장 마이크' },
      ]),
    }
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: mediaDevices })
    vi.stubGlobal('AudioContext', class {
      close = vi.fn().mockResolvedValue(undefined)
      createMediaStreamSource = () => ({ connect: vi.fn() })
      createAnalyser = () => ({ fftSize: 512, getByteTimeDomainData: (data: Uint8Array) => data.fill(128) })
    })
    vi.stubGlobal('MediaRecorder', class {
      static isTypeSupported = () => true
      state = 'inactive'
      mimeType = 'audio/webm'
      ondataavailable?: (event: { data: Blob }) => void
      onerror?: () => void
      onstop?: () => void
      constructor(public stream: MediaStream) {}
      start() { this.state = 'recording' }
      pause() { this.state = 'paused' }
      resume() { this.state = 'recording' }
      stop() { this.state = 'inactive'; this.onstop?.() }
    })

    try {
      const onUnsavedChange = vi.fn()
      const { unmount } = render(<Recorder token="local-token" onSaved={vi.fn()} onUnsavedChange={onUnsavedChange} />)
      expect(onUnsavedChange).toHaveBeenLastCalledWith(false)
      await user.click(screen.getByRole('button', { name: '마이크 연결' }))
      expect(screen.queryByText('연결됨')).not.toBeInTheDocument()
      expect(await screen.findByRole('meter', { name: '마이크 입력 레벨' })).toBeVisible()
      const microphoneSelect = await screen.findByRole('combobox', { name: '마이크 선택' })
      await user.selectOptions(microphoneSelect, 'test-mic')
      expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)

      await user.click(screen.getByRole('radio', { name: /빨간 모자/ }))
      await user.click(screen.getByRole('button', { name: '녹음 시작' }))
      await waitFor(() => expect(screen.getByRole('timer', { name: /녹음 시간/ })).toBeVisible(), { timeout: 6_000 })
      expect(onUnsavedChange).toHaveBeenLastCalledWith(true)
      const leaving = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(leaving)
      expect(leaving.defaultPrevented).toBe(true)
      expect(microphoneSelect).toBeDisabled()
      expect(screen.getByLabelText('녹음할 대본')).toBeDisabled()
      expect(screen.getByRole('radio', { name: /백설공주/ })).toBeDisabled()
      unmount()
      expect(onUnsavedChange).toHaveBeenLastCalledWith(false)
      const afterLeaving = new Event('beforeunload', { cancelable: true })
      window.dispatchEvent(afterLeaving)
      expect(afterLeaving.defaultPrevented).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
  }, 10_000)
  it('releases an acquired microphone when device initialization fails', async () => {
    const stop = vi.fn()
    const track = { stop, getSettings: () => ({}) }
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: {
      getUserMedia: vi.fn().mockResolvedValue({ getTracks: () => [track], getAudioTracks: () => [track] }),
      enumerateDevices: vi.fn().mockRejectedValue(new Error('장치 조회 실패')),
    } })
    render(<Recorder token="local-token" onSaved={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: '마이크 연결' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('장치 조회 실패')
    expect(stop).toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '녹음 시작' })).toBeDisabled()
  })

})
