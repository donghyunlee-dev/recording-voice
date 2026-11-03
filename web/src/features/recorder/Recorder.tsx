import { Button, Card, FormField, Textarea } from '@windsoft/ui'
import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { saveRecording, type LocalRecording } from '../../api/localRuntime'
import { convertRecordingToWav, importAudioFile } from './wav'

interface RecorderProps {
  token: string
  onSaved: (recording: LocalRecording) => void
}

type RecordState = 'idle' | 'recording' | 'paused' | 'converting' | 'ready' | 'saving' | 'saved'

const narrationPrompts = [
  { id: 'snow-white', title: '백설공주 · 숲속의 새 친구들', text: '깊은 숲에서 길을 잃은 백설공주는 작은 오두막을 발견했어요. 오두막에는 일곱 난쟁이가 살고 있었고, 백설공주는 새 친구들을 만났지요.' },
  { id: 'three-pigs', title: '아기 돼지 삼형제 · 튼튼한 벽돌집', text: '셋째 돼지는 벽돌을 하나씩 쌓아 튼튼한 집을 만들었어요. 늑대가 아무리 바람을 불어도 집은 끄떡없었답니다.' },
  { id: 'red-riding-hood', title: '빨간 모자 · 숲길을 걸으며', text: '빨간 모자는 할머니께 드릴 바구니를 들고 숲길을 걸었어요. 나뭇잎 사이로 따뜻한 햇살이 반짝였지요.' },
]

export function Recorder({ token, onSaved }: RecorderProps) {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDevice, setSelectedDevice] = useState('')
  const [trackSettings, setTrackSettings] = useState<MediaTrackSettings | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [countdown, setCountdown] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [level, setLevel] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [selectedPrompt, setSelectedPrompt] = useState('')
  const [wav, setWav] = useState<Blob | null>(null)
  const [previewUrl, setPreviewUrl] = useState('')
  const [error, setError] = useState('')
  const [savedMessage, setSavedMessage] = useState('')
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const analyserRef = useRef<AnalyserNode | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const countdownRef = useRef<number | null>(null)
  const startTimeRef = useRef(0)
  const pausedAtRef = useRef(0)

  useEffect(() => {
    if (!stream) return
    return () => stream.getTracks().forEach((track) => track.stop())
  }, [stream])

  useEffect(() => () => {
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
      let sum = 0
      for (const sample of samples) {
        const normalized = (sample - 128) / 128
        sum += normalized * normalized
      }
      setLevel(Math.min(1, Math.sqrt(sum / samples.length) * 3.5))
      animationFrame = requestAnimationFrame(update)
    }
    update()
    return () => cancelAnimationFrame(animationFrame)
  }, [stream])

  async function connectMicrophone(deviceId = selectedDevice) {
    setError('')
    setSavedMessage('')
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: deviceId ? { deviceId: { exact: deviceId }, channelCount: 1 } : { channelCount: 1 },
      })
      stream?.getTracks().forEach((track) => track.stop())
      const track = nextStream.getAudioTracks()[0]
      setTrackSettings(track.getSettings())
      const audioDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(audioDevices.filter((device) => device.kind === 'audioinput'))
      if (track.getSettings().deviceId) setSelectedDevice(track.getSettings().deviceId ?? '')
      const context = new AudioContext()
      audioContextRef.current?.close()
      audioContextRef.current = context
      const source = context.createMediaStreamSource(nextStream)
      const analyser = context.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser
      setStream(nextStream)
      setRecordState('idle')
    } catch (reason) {
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
    setWav(null)
    setSavedMessage('')
    setRecordState('idle')
    setPreviewUrl((oldUrl) => {
      if (oldUrl) URL.revokeObjectURL(oldUrl)
      return ''
    })
  }

  async function saveTake() {
    if (!wav || !transcript.trim()) return
    setRecordState('saving')
    setError('')
    try {
      const recording = await saveRecording(token, wav, transcript)
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

  return (
    <Card className="recorder-card" title="새 녹음" description="마이크로 녹음하거나 오디오 파일을 가져와 이 PC에만 저장합니다.">
      <div className="professional-recorder">
        <div className="audio-import-control">
          <label htmlFor="audio-file-import">오디오 파일 가져오기</label>
          <input id="audio-file-import" type="file" accept=".wav,.webm,.ogg,audio/wav,audio/webm,audio/ogg" onChange={(event) => void importTake(event)} disabled={recording || countdown !== null || recordState === 'converting' || recordState === 'saving'} />
          <small>WAV, WebM, OGG · 최대 5분 · 파일은 이 브라우저에서 24 kHz mono WAV로 변환합니다.</small>
        </div>
        <FormField label="동화 연습 대본" hint="녹음 전에 짧은 문장을 골라 읽어보세요.">
          <select className="generation-select" value={selectedPrompt} onChange={(event) => {
            const prompt = narrationPrompts.find((item) => item.id === event.target.value)
            setSelectedPrompt(event.target.value)
            if (prompt) setTranscript(prompt.text)
          }} disabled={recording || recordState === 'saving'}>
            <option value="">짧은 동화 문장 선택</option>
            {narrationPrompts.map((prompt) => <option value={prompt.id} key={prompt.id}>{prompt.title}</option>)}
          </select>
        </FormField>
        {selectedPrompt && <div className="recording-script-preview" aria-label="읽을 동화 대본">{transcript}</div>}
        <div className="recorder-controls-row">
          <div className="recorder-device-control">
            <label htmlFor="recording-device">입력 장치</label>
            <select
              id="recording-device"
              value={selectedDevice}
              onChange={(event) => { setSelectedDevice(event.target.value); if (stream) void connectMicrophone(event.target.value) }}
              disabled={recording || countdown !== null || recordState === 'converting' || recordState === 'saving'}
            >
              <option value="">기본 마이크</option>
              {devices.map((device, index) => <option key={device.deviceId || index} value={device.deviceId}>{device.label || `마이크 ${index + 1}`}</option>)}
            </select>
          </div>
          <Button variant={stream ? 'secondary' : 'primary'} onClick={() => void connectMicrophone()} disabled={recording || countdown !== null || recordState === 'converting' || recordState === 'saving'}>
            {stream ? '마이크 다시 연결' : '마이크 연결 및 확인'}
          </Button>
        </div>

        {trackSettings && <p className="device-info">{trackSettings.sampleRate ? `${trackSettings.sampleRate.toLocaleString()} Hz` : '샘플레이트 확인 불가'} · {trackSettings.channelCount ?? 1}채널</p>}
        <div className={`input-meter${level > 0.88 ? ' input-meter--hot' : ''}`} role="meter" aria-label="마이크 입력 레벨" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(level * 100)}>
          <span style={{ width: `${Math.round(level * 100)}%` }} />
        </div>
        <div className="recorder-live-state" aria-live="polite">
          <span className={`recording-indicator${recording ? ' recording-indicator--active' : ''}`} />
          {countdown !== null ? `${countdown}초 뒤 녹음 시작` : recordState === 'recording' ? '녹음 중' : recordState === 'paused' ? '일시정지' : recordState === 'converting' ? 'WAV 파일 준비 중' : recordState === 'saving' ? '로컬 저장 중' : recordState === 'saved' ? '저장 완료' : '준비됨'}
          <strong className="recorder-time">{formatTime(elapsedSeconds)}</strong>
          <small>최대 05:00</small>
        </div>

        <div className="recorder-action-row">
          <Button variant="primary" size="lg" onClick={startCapture} disabled={!stream || recording || countdown !== null || recordState === 'converting' || recordState === 'saving'}>
            녹음 시작
          </Button>
          <Button variant="secondary" onClick={pauseCapture} disabled={!recording}>{recordState === 'paused' ? '녹음 이어가기' : '일시정지'}</Button>
          <Button variant="secondary" onClick={stopCapture} disabled={!recording && countdown === null}>중지</Button>
        </div>

        {previewUrl && <audio className="recording-preview" controls src={previewUrl} aria-label="녹음 미리듣기" />}
        <FormField label="녹음 대본" hint="선택한 문장을 그대로 읽어 주세요. 자동 전사 기능은 아직 없으므로 직접 읽을 문장과 일치하는지 확인해 주세요.">
          <Textarea rows={4} maxLength={5_000} value={transcript} onChange={(event) => setTranscript(event.target.value)} placeholder="안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다." />
        </FormField>
        <p className="recorder-take-guidance">목소리를 여러 번 녹음해도 좋아요. 녹음마다 별도 take로 저장하고, 음성 생성 때 한 개씩 선택해 비교합니다.</p>
        {error && <p className="recorder-error" role="alert">{error}</p>}
        {savedMessage && <p className="recorder-saved" role="status">{savedMessage}</p>}
        <div className="recorder-action-row recorder-action-row--secondary">
          <Button variant="secondary" onClick={discardTake} disabled={!wav || recordState === 'saving'}>다시 녹음</Button>
          {previewUrl && <a className="download-take" href={previewUrl} download="voice-take.wav">WAV 다운로드</a>}
          <Button variant="primary" onClick={() => void saveTake()} disabled={!wav || !transcript.trim() || recordState === 'saving'}>이 PC에 저장</Button>
        </div>
      </div>
    </Card>
  )
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remainder = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remainder}`
}
