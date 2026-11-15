import { Button, Card, Textarea } from '@windsoft/ui'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ChoiceCardGroup } from '../../components/ChoiceCardGroup'
import { saveRecording, type LocalRecording } from '../../api/localRuntime'
import { saveVoiceName } from '../studio/localMetadata'
import { measureInput } from './inputSignal'
import { convertRecordingToWav, importAudioFile } from './wav'

interface RecorderProps {
  token: string
  onUnsavedChange?: (unsaved: boolean) => void
  onSaved: (recording: LocalRecording) => void
}

type RecordState = 'idle' | 'recording' | 'paused' | 'converting' | 'ready' | 'saving' | 'saved'

const narrationPrompts = [
  { id: 'snow-white', title: '백설공주', detail: '숲속의 새 친구들', image: '/storybook/snow-white-01-kawaii.webp', text: '깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.' },
  { id: 'three-pigs', title: '아기 돼지 삼형제', detail: '튼튼한 벽돌집', image: '/storybook/three-pigs-03-kawaii.webp', text: '셋째 돼지는 벽돌을 하나씩 쌓아 튼튼한 집을 만들었어요. 늑대가 아무리 바람을 불어도 집은 끄떡없었답니다.' },
  { id: 'red-riding-hood', title: '빨간 모자', detail: '숲길을 걸으며', image: '/storybook/red-riding-hood-01-kawaii.webp', text: '빨간 모자는 할머니께 드릴 바구니를 들고 숲길을 걸었어요. 나뭇잎 사이로 따뜻한 햇살이 반짝였지요.' },
]

export function Recorder({ token, onSaved, onUnsavedChange }: RecorderProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [signal, setSignal] = useState<ReturnType<typeof measureInput>>({ level: 0, db: null, status: '입력 없음' })
  const level = signal.level
  const connectionRequest = useRef(0)
  const [transcript, setTranscript] = useState(narrationPrompts[0].text)
  const [voiceName, setVoiceName] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState(narrationPrompts[0].id)
  const [wav, setWav] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewPlaying, setPreviewPlaying] = useState(false)
  const [previewTime, setPreviewTime] = useState(0)
  const [previewDuration, setPreviewDuration] = useState(0)
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const previewAudioRef = useRef<HTMLAudioElement>(null)
  const countdownRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const pausedAtRef = useRef(0)

  const hasUnsavedTake = countdown !== null || (wav !== null && recordState !== 'saved') || ['recording', 'paused', 'converting', 'ready', 'saving'].includes(recordState)

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedTake)
    return () => onUnsavedChange?.(false)
  }, [hasUnsavedTake, onUnsavedChange])

  useEffect(() => {
    if (!hasUnsavedTake) return
    const protectTake = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', protectTake)
    return () => window.removeEventListener('beforeunload', protectTake)
  }, [hasUnsavedTake])

  useEffect(() => {
    if (!stream) return
    return () => stream.getTracks().forEach((track) => track.stop())
  }, [stream])

  useEffect(() => {
    if (!stream) return
    const track = stream.getAudioTracks()[0]
    const disconnected = () => {
      stopCapture()
      setStream(null)
      setSignal({ level: 0, db: null, status: '입력 없음' })
      setError('마이크 연결이 끊겼습니다. 다시 연결해 주세요.')
    }
    track?.addEventListener?.('ended', disconnected)
    return () => track?.removeEventListener?.('ended', disconnected)
  }, [stream])

  useEffect(() => () => {
    connectionRequest.current += 1
    if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
    audioContextRef.current?.close()
    recorderRef.current?.stream.getTracks().forEach((track) => track.stop())
  }, [])

  useEffect(() => {
    if (!previewUrl) return
    return () => URL.revokeObjectURL(previewUrl)
  }, [previewUrl])

  useEffect(() => {
    if (recordState !== 'recording') return
    const timer = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setElapsedSeconds(elapsed)
      if (elapsed >= 300) stopCapture()
    }, 200)
    return () => window.clearInterval(timer)
  }, [recordState])

  useEffect(() => {
    if (!stream) return
    let animationFrame = 0
    const analyser = analyserRef.current
    if (!analyser) return
    const samples = new Uint8Array(analyser.fftSize)
    const update = () => {
      analyser.getByteTimeDomainData(samples)
      setSignal(measureInput(samples))
      animationFrame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(animationFrame)
  }, [stream])

  async function connectMicrophone(deviceId = selectedDevice) {
    setError('')
    setSavedMessage('')
    const request = ++connectionRequest.current
    let acquired: MediaStream | null = null
    let context: AudioContext | null = null
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId }, channelCount: 1 } : { channelCount: 1 },
      })
      acquired = nextStream
      if (request !== connectionRequest.current) { nextStream.getTracks().forEach((track) => track.stop()); return }
      const track = nextStream.getAudioTracks()[0]
      setTrackSettings(track.getSettings())
      const audioDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(audioDevices.filter((device) => device.kind === 'audioinput'))
      if (track.getSettings().deviceId) setSelectedDevice(track.getSettings().deviceId ?? '')
      context = new AudioContext()
      if (context.state === 'suspended') await context.resume()
      if (request !== connectionRequest.current) { nextStream.getTracks().forEach((track) => track.stop()); await context.close(); return }
      const source = context.createMediaStreamSource(nextStream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      stream?.getTracks().forEach((track) => track.stop())
      audioContextRef.current?.close()
      audioContextRef.current = context
      analyserRef.current = analyser
      setStream(nextStream)
      setRecordState('idle')
    } catch (reason) {
      acquired?.getTracks().forEach((track) => track.stop())
      void context?.close()
      if (request !== connectionRequest.current) return
      const name = reason instanceof DOMException ? reason.name : ''
      setError(name === 'NotAllowedError'
        ? '마이크 권한이 거부되었습니다. 브라우저 사이트 설정에서 마이크를 허용해 주세요.'
        : name === 'NotFoundError'
          ? '사용 가능한 마이크를 찾지 못했습니다.'
          : reason instanceof Error ? reason.message : '마이크를 열지 못했습니다.')
    }
  }

  function startCapture() {
    if (!stream || recordState === 'recording' || recordState === 'paused') return
    setError('')
    setSavedMessage('')
    previewAudioRef.current?.pause()
    setPreviewUrl('')
    setPreviewPlaying(false)
    setPreviewTime(0)
    setPreviewDuration(0)
    setWav(null)
    setElapsedSeconds(0)
    chunksRef.current = []
    let remaining = 3
    setCountdown(remaining)
    countdownRef.current = window.setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
        countdownRef.current = null
        setCountdown(null)
        beginCapture()
      } else {
        setCountdown(remaining)
      }
    }, 1000)
  }

  function beginCapture() {
    try {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus'].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = mimeType ? new MediaRecorder(stream!, { mimeType }) : new MediaRecorder(stream!)
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => { if (event.data.size > 0) chunksRef.current.push(event.data) }
      recorder.onerror = () => setError('브라우저 녹음 중 오류가 발생했습니다. 다시 녹음해 주세요.')
      recorder.onstop = async () => {
        setRecordState('converting')
        try {
          const recorded = new Blob(chunksRef.current, { type: recorder.mimeType })
          const result = await convertRecordingToWav(recorded)
          setWav(result)
          const url = URL.createObjectURL(result)
          setPreviewUrl((oldUrl) => {
            if (oldUrl) URL.revokeObjectURL(oldUrl)
            return url
          })
          setRecordState('ready')
        } catch (reason) {
          setRecordState('idle')
          setError(reason instanceof Error ? `녹음 오디오를 WAV로 변환하지 못했습니다: ${reason.message}` : '녹음 오디오를 WAV로 변환하지 못했습니다.')
        }
      }
      recorder.start(250)
      startTimeRef.current = Date.now()
      setRecordState('recording')
    } catch (reason) {
      setRecordState('idle')
      setError(reason instanceof Error ? reason.message : '브라우저가 녹음을 시작하지 못했습니다.')
    }
  }

  function pauseCapture() {
    const recorder = recorderRef.current
    if (!recorder) return
    if (recorder.state === 'recording') {
      recorder.pause()
      pausedAtRef.current = Date.now()
      setRecordState('paused')
    } else if (recorder.state === 'paused') {
      recorder.resume()
      startTimeRef.current += Date.now() - pausedAtRef.current
      setRecordState('recording')
    }
  }

  function stopCapture() {
    if (countdownRef.current !== null) window.clearInterval(countdownRef.current)
    countdownRef.current = null
    setCountdown(null)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop()
  }

  function discardTake() {
    previewAudioRef.current?.pause()
    setWav(null)
    setPreviewPlaying(false)
    setPreviewTime(0)
    setPreviewDuration(0)
    setSavedMessage('')
    setRecordState('idle')
    setPreviewUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      return ''
    })
  }

  async function togglePreview() {
    const player = previewAudioRef.current
    if (!player) return
    if (!player.paused) {
      player.pause()
      return
    }
    if (player.ended) player.currentTime = 0
    try {
      await player.play()
    } catch {
      setError('미리 듣기를 시작하지 못했습니다. 다시 눌러 주세요.')
    }
  }

  function seekPreview(value: string) {
    const player = previewAudioRef.current
    if (!player) return
    player.currentTime = Number(value)
    setPreviewTime(player.currentTime)
  }

  async function saveTake() {
    if (!wav || !transcript.trim()) return
    setRecordState('saving')
    setError('')
    try {
      const recording = await saveRecording(token, wav, transcript, voiceName)
      saveVoiceName(recording.id, voiceName)
      onSaved(recording)
      setRecordState('saved')
      setSavedMessage('녹음과 대본을 이 PC에 저장했습니다.')
    } catch (reason) {
      setRecordState('ready')
      setError(reason instanceof Error ? reason.message : '녹음을 저장하지 못했습니다.')
    }
  }

  async function importTake(event: ChangeEvent<HTMLInputElement>) {
    const file = event.currentTarget.files?.[0]
    event.currentTarget.value = ''
    if (!file) return
    setError('')
    setSavedMessage('')
    setWav(null)
    setPreviewUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      return ''
    })
    setRecordState('converting')
    try {
      const converted = await importAudioFile(file)
      const header = new DataView(await converted.slice(0, 44).arrayBuffer())
      const duration = header.getUint32(40, true) / (24_000 * 2)
      setWav(converted)
      setElapsedSeconds(Math.floor(duration))
      const url = URL.createObjectURL(converted)
      setPreviewUrl(url)
      setRecordState('ready')
    } catch (reason) {
      setRecordState('idle')
      setError(reason instanceof Error ? `오디오 파일을 가져오지 못했습니다: ${reason.message}` : '오디오 파일을 가져오지 못했습니다.')
    }
  }

  const recording = recordState === 'recording' || recordState === 'paused'
  const promptChoicesLocked = recording || recordState === 'saving' || recordState === 'converting' || countdown !== null
  const deviceChoicesLocked = promptChoicesLocked
  const microphoneDevices = [...new Map(devices
    .filter((device) => device.deviceId && device.deviceId !== 'default' && device.deviceId !== 'communications')
    .map((device) => [device.deviceId, device] as const)).values()]
  const deviceOptions = [
    { value: '', title: '기본 마이크' },
    ...microphoneDevices.map((device, index) => ({
      value: device.deviceId,
      title: device.label || `마이크 ${index + 1}`,
    })),
  ]

  return (
    <Card className="recorder-card">
      <div className="recorder-story-workspace">
        <section className="recorder-story-selection" aria-label="예시 대본 선택">
          <div className="recorder-panel-heading"><span aria-hidden="true">▧</span><h2>예시 대본</h2></div>
          <ChoiceCardGroup
            name="story-prompt"
            legend="예시 대본 선택"
            options={narrationPrompts.map((prompt) => ({
              value: prompt.id,
              title: prompt.title,
              detail: prompt.detail,
              disabled: promptChoicesLocked,
            }))}
            value={selectedPrompt}
            onChange={(promptId) => {
              const prompt = narrationPrompts.find((item) => item.id === promptId)
              setSelectedPrompt(promptId)
              if (prompt) setTranscript(prompt.text)
            }}
          />
        </section>

        <section className="recorder-script-panel" aria-label="녹음 대본">
          <div className="recorder-panel-heading"><span aria-hidden="true">▤</span><h2>녹음할 대본</h2></div>
          {/* Keep the textarea label available to assistive technology while the heading carries the visual hierarchy. */}
          <label className="visually-hidden" htmlFor="recording-transcript">녹음할 대본</label>
          <Textarea id="recording-transcript" className="story-script-editor" aria-label="녹음할 대본" rows={5} maxLength={5_000} value={transcript} disabled={promptChoicesLocked} onChange={(event) => setTranscript(event.target.value)} />
        </section>
      </div>

      <section className="recorder-console" aria-label="녹음 툴바">
        <div className="recorder-microphone-settings" role="group" aria-label="마이크 입력">
          <Button
            className={`recorder-microphone-connect${stream ? ' recorder-microphone-connect--connected' : ''}`}
            variant="secondary"
            aria-label={stream ? '마이크 다시 연결' : '마이크 연결'}
            title={stream ? '마이크 다시 연결' : '마이크 연결'}
            onClick={() => void connectMicrophone()}
            disabled={recording || countdown !== null || recordState === 'converting' || recordState === 'saving'}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><rect x="9" y="3" width="6" height="12" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M6 11a6 6 0 0 0 12 0m-6 6v4m-3 0h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />{!stream && <path d="m5 5 14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg><span>{stream ? '마이크 연결됨' : '마이크 연결'}</span>
          </Button>
          {stream && (
            <select
              className="recorder-microphone-select"
              aria-label="마이크 선택"
              value={selectedDevice}
              disabled={deviceChoicesLocked}
              onChange={(event) => { setSelectedDevice(event.target.value); if (stream) void connectMicrophone(event.target.value) }}
            >
              {deviceOptions.map((option) => <option key={option.value} value={option.value}>{option.title}</option>)}
            </select>
          )}
          {stream && <div className="recorder-input-feedback" title={trackSettings ? `${trackSettings.sampleRate?.toLocaleString() ?? '샘플레이트 확인 불가'} Hz · ${trackSettings.channelCount ?? 1}채널` : '마이크 입력 레벨'}>
            <div className="input-signal-label"><span>{signal.status}</span><span>{signal.db === null ? '−∞' : signal.db} dBFS</span></div>
            <div className={`input-meter${signal.status === '입력 과다' ? ' input-meter--hot' : ''}`} role="meter" aria-label="마이크 입력 레벨" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
              <span style={{ width: `${Math.round(level * 100)}%` }} />
            </div>
          </div>}
        </div>

        {(countdown !== null || recording || ['converting', 'ready', 'saving', 'saved'].includes(recordState)) && (
          <output className={`recorder-toolbar__timer${recording ? ' recorder-toolbar__timer--recording' : ''}`} role="timer" aria-label={countdown !== null ? `${countdown}초 뒤 녹음 시작` : `녹음 시간 ${formatTime(elapsedSeconds)}`}>
            {countdown !== null ? `00:0${countdown}` : formatTime(elapsedSeconds)}
          </output>
        )}

        <div className="recorder-toolbar__actions" role="group" aria-label="녹음 조작">
          <Button className="recorder-control-button recorder-control-button--record" variant="primary" onClick={startCapture} disabled={!stream || recording || countdown !== null || recordState === 'converting' || recordState === 'saving'}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><circle cx="8" cy="8" r="4.5" fill="currentColor" /></svg> 녹음 시작
          </Button>
          <Button className="recorder-control-button" variant="secondary" onClick={pauseCapture} disabled={!recording}>
            {recordState === 'paused'
              ? <><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 3.5 12 8l-7 4.5v-9Z" fill="currentColor" /></svg> 이어 녹음</>
              : <><svg aria-hidden="true" viewBox="0 0 16 16"><path d="M5 3.5v9M11 3.5v9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg> 일시정지</>}
          </Button>
          <Button className="recorder-control-button" variant="secondary" onClick={stopCapture} disabled={!recording && countdown === null}>
            <svg aria-hidden="true" viewBox="0 0 16 16"><rect x="4" y="4" width="8" height="8" rx="1" fill="currentColor" /></svg> 중지
          </Button>
        </div>
      </section>

      {previewUrl && <div className="warm-audio-playback recorder-preview-playback">
        <audio ref={previewAudioRef} className="warm-audio-media" src={previewUrl} aria-label="녹음 미리듣기" onLoadedMetadata={(event) => { setPreviewDuration(event.currentTarget.duration || elapsedSeconds); setPreviewTime(0) }} onTimeUpdate={(event) => setPreviewTime(event.currentTarget.currentTime)} onPlay={() => setPreviewPlaying(true)} onPause={() => setPreviewPlaying(false)} onEnded={() => setPreviewPlaying(false)} />
        <button className="recorder-preview-play" type="button" onClick={() => void togglePreview()} aria-label={previewPlaying ? '미리 듣기 일시정지' : '녹음 미리 듣기'}>{previewPlaying ? 'Ⅱ' : '▶'}<span>{previewPlaying ? '일시정지' : '미리 듣기'}</span></button>
        <div className="recorder-preview-timeline">
          <input className="warm-audio-seek" type="range" min="0" max={previewDuration || elapsedSeconds} step="0.1" value={Math.min(previewTime, previewDuration || elapsedSeconds)} aria-label="미리 듣기 위치" aria-valuetext={`${formatTime(previewTime)} / ${formatTime(previewDuration || elapsedSeconds)}`} onChange={(event) => seekPreview(event.currentTarget.value)} disabled={!previewDuration} />
          <div className="warm-audio-time"><time>{formatTime(previewTime)}</time><time>{formatTime(previewDuration || elapsedSeconds)}</time></div>
        </div>
      </div>}
      {error && <p className="recorder-error" role="alert">{error}</p>}
      {savedMessage && <p className="recorder-saved" role="status">{savedMessage}</p>}
      {wav && <div className="recorder-action-row recorder-action-row--secondary">
        <label className="recorder-voice-name"><span>목소리 이름</span><input value={voiceName} onChange={(event) => setVoiceName(event.target.value)} placeholder="예: 이야기 목소리" maxLength={24} /></label>
        <Button variant="secondary" onClick={discardTake} disabled={recordState === 'saving'}>다시 녹음</Button>
        {previewUrl && <a className="download-take" href={previewUrl} download="voice-take.wav">WAV 다운로드</a>}
        <Button variant="primary" onClick={() => void saveTake()} disabled={!transcript.trim() || !voiceName.trim() || recordState === 'saving'}>목소리 저장</Button>
      </div>}
      <details className="audio-import-details">
        <summary>오디오 파일 가져오기</summary>
        <div className="audio-import-control">
          <label htmlFor="audio-file-import">녹음 파일</label>
          <input id="audio-file-import" type="file" accept=".wav,.webm,.ogg,audio/wav,audio/webm,audio/ogg" onChange={(event) => void importTake(event)} disabled={recording || countdown !== null || recordState === 'converting' || recordState === 'saving'} />
        </div>
      </details>
    </Card>
  )
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
