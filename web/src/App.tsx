import { Button, Card, SettingsPage as WindsoftSettingsPage, Typography } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { AppShell, type AppRoute } from './components/AppShell'
import { ConnectionStatus, type ConnectionState } from './components/ConnectionStatus'
import { deleteRecording, getRecordingAudio, getRuntimeHealth, getRuntimeSystem, listModels, listOutputs, listRecordings, LocalRuntimeError, pairRuntime, type LocalOutput, type LocalRecording, type RuntimeSystem } from './api/localRuntime'
import { SetupScreen } from './components/Onboarding/SetupScreen'
import { Recorder } from './features/recorder/Recorder'
import { GenerationWorkspace } from './features/generation/GenerationWorkspace'
import { AudioOutputCard } from './features/results/AudioOutputCard'
import { StorybookPage } from './features/storybook/StorybookPage'

function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="page-heading">
      {eyebrow && <Typography variant="caption" className="section-kicker">{eyebrow}</Typography>}
      <Typography variant="h1">{title}</Typography>
      {description && <Typography variant="body-sm">{description}</Typography>}
    </div>
  )
}

function RecordingPage({ onNavigate, token, recordings, onSaved }: { onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; onSaved: (recording: LocalRecording) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="먼저 내 목소리를 녹음해요" />
      <div className="workspace-grid workspace-grid--recording">
        {token ? <Recorder token={token} onSaved={onSaved} /> : (
          <Card className="recorder-card" title="새 녹음">
            <div className="empty-state"><p>위쪽의 로컬 앱 연결을 완료하면 마이크 권한 요청과 녹음 컨트롤이 활성화됩니다.</p></div>
          </Card>
        )}
      </div>
      {recordings.length > 0 && <div className="recording-next-step">
        <Button variant="secondary" onClick={() => onNavigate('generate')}>저장한 목소리로 음성 만들기 <span aria-hidden="true">→</span></Button>
      </div>}
    </div>
  )
}

function VoicesPage({ onNavigate, token, recordings, onDeleted }: { onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; onDeleted: (id: string) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="저장한 녹음" />
      {!token || recordings.length === 0 ? (
        <Card className="empty-card"><div className="empty-state">
          <span className="empty-state__icon voice-empty-wave" aria-hidden="true">〰</span>
          <h2>{token ? '아직 저장된 음성이 없습니다' : '로컬 앱 연결이 필요합니다'}</h2>
          {token && <Button variant="primary" onClick={() => onNavigate('record')}>첫 음성 녹음하기</Button>}
        </div></Card>
      ) : recordings.map((recording) => (
        <VoiceTake key={recording.id} recording={recording} token={token} onDeleted={onDeleted} />
      ))}
    </div>
  )
}

function VoiceTake({ recording, token, onDeleted }: { recording: LocalRecording; token: string; onDeleted: (id: string) => void }) {
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  async function loadAudio() {
    try {
      const audio = await getRecordingAudio(token, recording.id)
      setAudioUrl(URL.createObjectURL(audio))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '녹음을 불러오지 못했습니다.')
    }
  }

  async function remove() {
    if (!window.confirm('이 녹음을 삭제할까요?')) return
    await deleteRecording(token, recording.id)
    onDeleted(recording.id)
  }

  return (
    <Card className="voice-take-card">
      <div className="voice-take-toolbar">
        <div className="voice-take-meta">
          <span className="voice-take-wave" aria-hidden="true">〰</span>
          <time dateTime={recording.created_at}>{formatRecordingDate(recording.created_at)}</time>
          <span className="voice-take-duration">{Math.round(recording.duration_seconds)}초</span>
        </div>
        <div className="voice-take-actions">
          {!audioUrl && <Button variant="primary" onClick={() => void loadAudio()}><span aria-hidden="true">▶</span> 듣기</Button>}
          <Button className="voice-delete-button" variant="ghost" aria-label="녹음 삭제" title="녹음 삭제" onClick={() => void remove()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </Button>
        </div>
      </div>
      {audioUrl && <audio className="voice-take-player" controls src={audioUrl} aria-label="저장된 내 음성 재생" />}
      <section className="transcript-reading-page" aria-label="저장한 녹음 대본">
        <p className="storybook-reading-page__text voice-take-transcript">{recording.transcript}</p>
      </section>
      {error && <p role="alert" className="recorder-error">{error}</p>}
    </Card>
  )
}

function formatRecordingDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function GenerationPage({ onNavigate, token, recordings, initialText, draftSource, onOutputCreated }: { onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; initialText?: string; draftSource?: 'recording' | 'storybook'; onOutputCreated: (output: LocalOutput) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="음성 생성" />
      {token ? <GenerationWorkspace token={token} recordings={recordings} initialText={initialText} draftSource={draftSource} onOutputCreated={onOutputCreated} onNavigate={() => onNavigate('record')} /> : <Card title="로컬 앱 연결 필요" description="위쪽에서 PC 로컬 앱을 연결하면 설치된 모델과 참조 녹음이 표시됩니다." />}
    </div>
  )
}

function ResultsPage({ onNavigate, token, outputs, onOutputDeleted }: { onNavigate: (route: AppRoute) => void; token: string | null; outputs: LocalOutput[]; onOutputDeleted: (id: string) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="생성 결과" />
      {token && outputs.length > 0 ? <div className="audio-output-list">{outputs.map((output) => <AudioOutputCard key={output.id} token={token} output={output} onDeleted={onOutputDeleted} />)}</div> : <Card className="empty-card audio-output-empty">
        <div className="empty-state">
          <span className="empty-state__icon audio-output-empty-wave" aria-hidden="true">〰</span>
          <h2>아직 생성된 오디오가 없습니다</h2>
          <Button variant="primary" onClick={() => onNavigate('generate')}>음성 생성</Button>
        </div>
      </Card>}
    </div>
  )
}

function SettingsPage({ systemInfo, token }: { systemInfo: RuntimeSystem | null; token: string | null }) {
  const [modelState, setModelState] = useState<'checking' | 'installed' | 'not_installed' | 'installing' | 'unknown'>('checking')

  useEffect(() => {
    let active = true
    if (!token) {
      setModelState('unknown')
      return () => { active = false }
    }
    void listModels(token).then((models) => {
      if (!active) return
      const model = models.find((item) => item.id === 'qwen3-tts-0.6b-base')
      setModelState(model?.status ?? 'not_installed')
    }).catch(() => { if (active) setModelState('unknown') })
    return () => { active = false }
  }, [token])

  const modelStatus = {
    checking: { icon: '◌', label: '음성 모델 확인 중', className: 'settings-status--checking' },
    installed: { icon: '✓', label: '음성 모델 설치됨', className: 'settings-status--success' },
    installing: { icon: '↓', label: '음성 모델 설치 중', className: 'settings-status--checking' },
    not_installed: { icon: '↓', label: '음성 모델 설치 필요', className: 'settings-status--warning' },
    unknown: { icon: '!', label: '음성 모델 확인 필요', className: 'settings-status--warning' },
  }[modelState]

  const sections = [
    {
      id: 'install', label: '설치 및 연결', icon: '↓', content: <Card className="settings-install-card">
        <div className="install-flow" aria-hidden="true">
          <span>1</span><i /><span>2</span><i /><span>✓</span>
        </div>
        <div className="install-links">
          <a href="/install/windows/VoiceStudioSetup.exe" download>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>VoiceStudioSetup.exe</span>
          </a>
          <a href="/install/windows-wsl.md" target="_blank" rel="noreferrer">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6zM14 3v5h5M9 13h6m-6 4h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            <span>설치 가이드</span>
          </a>
        </div>
      </Card>,
    },
    {
      id: 'computer', label: 'PC 환경', icon: '⌘', content: <div className="settings-section-content">
        <div className="settings-status-grid">
          <div className="settings-status-tile"><strong>PC 앱</strong><span className={`settings-status-icon ${systemInfo ? 'settings-status--success' : 'settings-status--warning'}`} role="img" aria-label={systemInfo ? 'PC 앱 연결됨' : 'PC 앱 연결 필요'}>{systemInfo ? '✓' : '!'}</span></div>
          <div className="settings-status-tile"><strong>로컬 권한</strong><span className={`settings-status-icon ${systemInfo ? 'settings-status--success' : 'settings-status--warning'}`} role="img" aria-label={systemInfo ? '로컬 권한 허용됨' : '로컬 권한 확인 필요'}>{systemInfo ? '✓' : '!'}</span></div>
          <div className="settings-status-tile"><strong>Qwen3-TTS</strong><span className={`settings-status-icon ${modelStatus.className}`} role="img" aria-label={modelStatus.label}>{modelStatus.icon}</span></div>
        </div>
        {systemInfo && <div className="settings-resource-grid" aria-label="이 PC 실행 자원">
          <div className="settings-resource-tile"><span>OS</span><strong>{systemInfo.os} · {systemInfo.architecture}</strong></div>
          <div className="settings-resource-tile"><span>CPU</span><strong>{systemInfo.cpu_logical_count ?? '—'} 코어</strong></div>
          <div className="settings-resource-tile settings-resource-tile--memory">
            <div><span>RAM</span><strong>{systemInfo.memory_available_gib?.toFixed(1) ?? '—'} / {systemInfo.memory_total_gib?.toFixed(1) ?? '—'} GiB</strong></div>
            {systemInfo.memory_available_gib !== null && systemInfo.memory_total_gib !== null && <progress aria-label="가용 메모리" value={systemInfo.memory_available_gib} max={systemInfo.memory_total_gib || 1} />}
          </div>
          <div className="settings-resource-tile"><span>모델 캐시</span><strong>{systemInfo.model_cache_disk_free_gib.toFixed(1)} GiB</strong></div>
        </div>}
      </div>,
    },
    {
      id: 'privacy', label: '개인정보와 저장', icon: '⌑', content: <Card title="내 PC에 저장">
        <div className="local-processing-visual" role="img" aria-label="브라우저에서 PC 앱을 거쳐 이 PC에 음성 파일 저장">
          <div><span className="local-processing-visual__node">▣</span><small>브라우저</small></div><i />
          <div><span className="local-processing-visual__node local-processing-visual__wave">〰</span><small>PC 앱</small></div><i />
          <div><span className="local-processing-visual__node">⌂</span><small>이 PC</small></div>
        </div>
      </Card>,
    },
  ]

  return (
    <div className="settings-page">
      <WindsoftSettingsPage title="설정" sections={sections} defaultSection={systemInfo ? 'computer' : 'install'} className="settings-template" />
    </div>
  )
}

function CurrentPage({ route, onNavigate, token, recordings, outputs, systemInfo, generationDraft, onGenerateStory, onRecordingSaved, onRecordingDeleted, onOutputCreated, onOutputDeleted }: { route: AppRoute; onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; outputs: LocalOutput[]; systemInfo: RuntimeSystem | null; generationDraft: { text: string; source: 'recording' | 'storybook' } | null; onGenerateStory: (text: string) => void; onRecordingSaved: (recording: LocalRecording) => void; onRecordingDeleted: (id: string) => void; onOutputCreated: (output: LocalOutput) => void; onOutputDeleted: (id: string) => void }) {
  switch (route) {
    case 'record':
      return <RecordingPage onNavigate={onNavigate} token={token} recordings={recordings} onSaved={onRecordingSaved} />
    case 'storybook':
      return <StorybookPage onGenerateSpeech={onGenerateStory} />
    case 'voices':
      return <VoicesPage onNavigate={onNavigate} token={token} recordings={recordings} onDeleted={onRecordingDeleted} />
    case 'generate':
      return <GenerationPage onNavigate={onNavigate} token={token} recordings={recordings} initialText={generationDraft?.text} draftSource={generationDraft?.source} onOutputCreated={onOutputCreated} />
    case 'results':
      return <ResultsPage onNavigate={onNavigate} token={token} outputs={outputs} onOutputDeleted={onOutputDeleted} />
    case 'settings':
      return <SettingsPage systemInfo={systemInfo} token={token} />
  }
}

export function App() {
  const [activeRoute, setActiveRoute] = useState<AppRoute>('record')
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [runtimeToken, setRuntimeToken] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<LocalRecording[]>([])
  const [outputs, setOutputs] = useState<LocalOutput[]>([])
  const [systemInfo, setSystemInfo] = useState<RuntimeSystem | null>(null)
  const [generationDraft, setGenerationDraft] = useState<{ text: string; source: 'recording' | 'storybook' } | null>(null)

  async function connectRuntime(code?: string) {
    setConnectionState('checking')
    try {
      await getRuntimeHealth()
      const session = await pairRuntime(code)
      const system = await getRuntimeSystem(session.access_token)
      const savedRecordings = await listRecordings(session.access_token)
      const savedOutputs = await listOutputs(session.access_token)
      setRecordings(savedRecordings)
      setOutputs(savedOutputs)
      setSystemInfo(system)
      setRuntimeToken(session.access_token)
      setActiveRoute('record')
      setConnectionState('connected')
    } catch (error) {
      setConnectionState(error instanceof LocalRuntimeError && error.code === 'local_access_blocked' ? 'permission-denied' : 'error')
      throw error
    }
  }

  function handleRecordingSaved(recording: LocalRecording) {
    setRecordings((current) => [recording, ...current.filter((item) => item.id !== recording.id)])
    setGenerationDraft({ text: recording.transcript, source: 'recording' })
    setActiveRoute('generate')
  }

  function handleStoryGenerate(text: string) {
    setGenerationDraft({ text, source: 'storybook' })
    setActiveRoute('generate')
  }

  function handleRecordingDeleted(id: string) {
    setRecordings((current) => current.filter((item) => item.id !== id))
  }

  function handleOutputCreated(output: LocalOutput) {
    setOutputs((current) => [output, ...current.filter((item) => item.id !== output.id)])
  }

  function handleOutputDeleted(id: string) {
    setOutputs((current) => current.filter((item) => item.id !== id))
  }

  function reconnectRuntime() {
    setRuntimeToken(null)
    setConnectionState('disconnected')
    setRecordings([])
    setOutputs([])
    setSystemInfo(null)
    setActiveRoute('record')
  }

  const setupComplete = runtimeToken !== null && connectionState === 'connected'

  if (!setupComplete) {
    return <SetupScreen
      onPair={connectRuntime}
    />
  }

  return (
    <AppShell activeRoute={activeRoute} onNavigate={setActiveRoute} connectionState={connectionState} onReconnect={reconnectRuntime}>
      <div className="page-stack app-page-stack">
        {connectionState !== 'connected' && <ConnectionStatus state={connectionState} onPair={connectRuntime} onReconnect={runtimeToken ? reconnectRuntime : undefined} />}
        <CurrentPage route={activeRoute} onNavigate={setActiveRoute} token={runtimeToken} recordings={recordings} outputs={outputs} systemInfo={systemInfo} generationDraft={generationDraft} onGenerateStory={handleStoryGenerate} onRecordingSaved={handleRecordingSaved} onRecordingDeleted={handleRecordingDeleted} onOutputCreated={handleOutputCreated} onOutputDeleted={handleOutputDeleted} />
      </div>
    </AppShell>
  )
}
