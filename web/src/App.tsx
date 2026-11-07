import { Button, Card, SettingsPage as WindsoftSettingsPage, Typography } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { AppShell, type AppRoute } from './components/AppShell'
import { ConnectionStatus, type ConnectionState } from './components/ConnectionStatus'
import { deleteRecording, getRecordingAudio, getRuntimeHealth, getRuntimeSystem, listOutputs, listRecordings, LocalRuntimeError, pairRuntime, type LocalOutput, type LocalRecording, type RuntimeSystem } from './api/localRuntime'
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
      <div className="voice-take-meta">
        <span className="voice-take-wave" aria-hidden="true">〰</span>
        <time dateTime={recording.created_at}>{formatRecordingDate(recording.created_at)}</time>
        <span className="voice-take-duration">{Math.round(recording.duration_seconds)}초</span>
      </div>
      <p className="voice-take-transcript">{recording.transcript}</p>
      <div className="voice-take-actions">
        {!audioUrl ? <Button variant="primary" onClick={() => void loadAudio()}><span aria-hidden="true">▶</span> 듣기</Button> : <audio controls src={audioUrl} aria-label="저장된 내 음성 재생" />}
        <Button className="voice-delete-button" variant="ghost" aria-label="녹음 삭제" title="녹음 삭제" onClick={() => void remove()}>
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </Button>
      </div>
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

function SettingsPage({ systemInfo }: { systemInfo: RuntimeSystem | null }) {
  const sections = [
    {
      id: 'install', label: '설치 및 연결', icon: '↓', content: <Card title="Windows 설치 안내" description="설치 프로그램이 이 PC에 로컬 앱을 준비하고 실행합니다. 음성 모델은 이 화면에서 별도로 내려받습니다.">
        <div className="privacy-detail"><span aria-hidden="true">01</span><p>설치 프로그램을 실행한 뒤 이 페이지에서 로컬 앱 연결과 모델 다운로드를 완료합니다.</p></div>
        <div className="install-links">
          <a href="/install/windows/VoiceStudioSetup.exe" download>Windows 설치 프로그램 다운로드</a>
          <a href="/install/windows-wsl.md" target="_blank" rel="noreferrer">Windows 설치 안내</a>
        </div>
      </Card>,
    },
    {
      id: 'computer', label: 'PC 환경', icon: '⌘', content: <div className="settings-section-content">
        <Card title="PC 로컬 앱" description="모델을 실행하고 녹음 파일을 보관하는 작은 프로그램입니다.">
          <div className="setting-row"><span className="setting-icon">01</span><div><strong>내 PC 앱</strong><p>음성 녹음과 생성을 담당하는 PC 앱입니다. 이 브라우저와 연결해 사용합니다.</p></div><span className="setting-state">{systemInfo ? '연결됨' : '연결 필요'}</span></div>
          <div className="setting-row"><span className="setting-icon">02</span><div><strong>로컬 연결 권한</strong><p>웹페이지가 내 PC의 로컬 앱에 접근할 때 브라우저 권한을 요청합니다.</p></div><span className="setting-state">{systemInfo ? '허용됨' : '연결 후 확인'}</span></div>
          <div className="setting-row"><span className="setting-icon">03</span><div><strong>음성 모델</strong><p>Qwen3-TTS 0.6B Base는 음성 생성 화면에서 확인하고 설치할 수 있습니다.</p></div><span className="setting-state">모델 페이지에서 확인</span></div>
        </Card>
        {systemInfo && <Card title="이 PC에서 확인한 실행 자원" description="로컬 런타임이 보고한 정보이며 별도 서버로 보내지 않습니다.">
          <div className="resource-grid">
            <div><span>운영체제</span><strong>{systemInfo.os} · {systemInfo.architecture}</strong></div>
            <div><span>CPU 코어 수</span><strong>{systemInfo.cpu_logical_count ?? '확인 불가'} 코어</strong></div>
            <div><span>총 메모리</span><strong>{systemInfo.memory_total_gib?.toFixed(1) ?? '확인 불가'} GiB</strong></div>
            <div><span>현재 가용 메모리</span><strong>{systemInfo.memory_available_gib?.toFixed(1) ?? '확인 불가'} GiB</strong></div>
            <div><span>모델 캐시 여유</span><strong>{systemInfo.model_cache_disk_free_gib.toFixed(1)} GiB</strong></div>
          </div>
        </Card>}
      </div>,
    },
    {
      id: 'privacy', label: '개인정보와 저장', icon: '⌑', content: <Card title="내 PC에 저장" description="녹음, 대본, 생성 결과는 내 PC 안에 보관합니다.">
        <div className="privacy-detail"><span aria-hidden="true">⌑</span><p>Vercel은 화면만 제공합니다. 녹음 파일, 대본, 생성 음성은 로컬 앱이 관리하고 외부 추론 API로 보내지 않습니다.</p></div>
        <div className="storage-detail"><span>저장 위치</span><strong>로컬 앱 연결 후 표시</strong></div>
      </Card>,
    },
  ]

  return (
    <div className="settings-page page-stack">
      <PageHeading eyebrow="내 PC 환경" title="설정 및 설치" description="PC 앱 연결, 모델 준비 상태, 녹음 파일 저장 위치를 확인합니다." />
      <WindsoftSettingsPage title="설정 항목" sections={sections} defaultSection="install" className="settings-template" />
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
      return <SettingsPage systemInfo={systemInfo} />
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
