import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { Recorder } from './Recorder'

describe('Recorder narration prompts', () => {
  it('keeps the script, microphone and record controls in a compact visual workflow', async () => {
    const user = userEvent.setup()
    render(<Recorder token="local-token" onSaved={vi.fn()} />)

    await user.click(screen.getByRole('radio', { name: /백설공주/ }))

    expect(screen.getByLabelText('읽을 대본')).toHaveValue('깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.')
    expect(screen.getByRole('button', { name: '마이크 연결' })).toBeVisible()
    expect(screen.getByRole('button', { name: '녹음 시작' })).toBeVisible()
    expect(screen.queryByText(/자동 전사는 아직 지원하지 않아/)).not.toBeInTheDocument()
    expect(screen.queryByText(/여러 번 녹음해도 괜찮아요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/1단계|2단계|3단계/)).not.toBeInTheDocument()
    expect(screen.getByText('오디오 파일 가져오기').closest('details')).not.toHaveAttribute('open')
    expect(screen.getByLabelText('읽을 대본').compareDocumentPosition(screen.getByRole('button', { name: '마이크 연결' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('selects a microphone card and locks both choice groups while recording', async () => {
    const user = userEvent.setup()
    const track = { getSettings: () => ({ deviceId: 'test-mic', sampleRate: 48_000, channelCount: 1 }), stop: vi.fn() }
    const stream = { getTracks: () => [track], getAudioTracks: () => [track] }
    const mediaDevices = {
      getUserMedia: vi.fn().mockResolvedValue(stream),
      enumerateDevices: vi.fn().mockResolvedValue([{ kind: 'audioinput', deviceId: 'test-mic', label: 'USB 마이크' }]),
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
      render(<Recorder token="local-token" onSaved={vi.fn()} />)
      await user.click(screen.getByRole('button', { name: '마이크 연결' }))
      await waitFor(() => expect(screen.getByRole('radio', { name: /USB 마이크/ })).toBeVisible())
      await user.click(screen.getByRole('radio', { name: /기본 마이크/ }))
      await waitFor(() => expect(screen.getByRole('radio', { name: /USB 마이크/ })).toBeChecked())
      expect(mediaDevices.getUserMedia).toHaveBeenCalledTimes(2)

      await user.click(screen.getByRole('radio', { name: /빨간 모자/ }))
      await user.click(screen.getByRole('button', { name: '녹음 시작' }))
      await waitFor(() => expect(screen.getByText('녹음 중')).toBeVisible(), { timeout: 6_000 })
      expect(screen.getByRole('radio', { name: /기본 마이크/ })).toBeDisabled()
      expect(screen.getByRole('radio', { name: /백설공주/ })).toBeDisabled()
    } finally {
      vi.unstubAllGlobals()
    }
  }, 10_000)
})
