import { Button, Card, SettingsPage as WindsoftSettingsPage, Typography } from '@windsoft/ui'
import { useEffect, useRef, useState } from 'react'
import { AppShell, type AppRoute } from './components/AppShell'
import { ConnectionStatus, type ConnectionState } from './components/ConnectionStatus'
import { renameRecording, deleteRecording, getRecordingAudio, getRuntimeHealth, getRuntimeSystem, listOutputs, listRecordings, LocalRuntimeError, pairRuntime, type LocalOutput, type LocalRecording, type RuntimeSystem } from './api/localRuntime'
import { SetupScreen } from './components/Onboarding/SetupScreen'
import { Recorder } from './features/recorder/Recorder'
import { GenerationWorkspace } from './features/generation/GenerationWorkspace'
import { AudioOutputCard } from './features/results/AudioOutputCard'
import { StorybookPage } from './features/storybook/StorybookPage'
import { StudioHome } from './features/studio/StudioHome'
import { storyScript, storybooks, type Storybook } from './features/storybook/storybookData'
import { getVoiceName } from './features/studio/localMetadata'
import { useExclusivePlayback } from './features/audio/useExclusivePlayback'
import { ModelSettings } from './features/settings/ModelSettings'

function PageHeading({ eyebrow, title, description }: { eyebrow?: string; title: string; description?: string }) {
  return (
    <div className="page-heading">
      {eyebrow && <Typography variant="caption" className="section-kicker">{eyebrow}</Typography>}
      <Typography variant="h1">{title}</Typography>
      {description && <Typography variant="body-sm">{description}</Typography>}
    </div>
  )
}

function RecordingPage({ onNavigate, token, recordings, onSaved, onUnsavedChange }: { onUnsavedChange: (unsaved: boolean) => void; onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; onSaved: (recording: LocalRecording) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="목소리 등록" />
      <div className="workspace-grid workspace-grid--recording">
        {token ? <Recorder token={token} onSaved={onSaved} onUnsavedChange={onUnsavedChange} /> : (
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

function VoicesPage({ onNavigate, token, recordings, onDeleted, onRenamed }: { onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; onDeleted: (id: string) => void; onRenamed: (recording: LocalRecording) => void }) {
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
        <VoiceTake key={recording.id} recording={recording} token={token} onDeleted={onDeleted} onRenamed={onRenamed} />
      ))}
    </div>
  )
}

function VoiceTake({ recording, token, onDeleted, onRenamed }: { recording: LocalRecording; token: string; onDeleted: (id: string) => void; onRenamed: (recording: LocalRecording) => void }) {
  const [name, setName] = useState(recording.name || getVoiceName(recording.id, '내 목소리'))
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  async function saveName() {
    setRenaming(true)
    setError('')
    try { onRenamed(await renameRecording(token, recording.id, name.trim())) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '이름을 저장하지 못했습니다.') }
    finally { setRenaming(false) }
  }
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(recording.duration_seconds)
  const playerRef = useRef<HTMLAudioElement>(null)
  useEffect(() => () => { if (audioUrl) URL.revokeObjectURL(audioUrl) }, [audioUrl])

  async function loadAudio() {
    if (loadingAudio) return
    if (audioUrl) {
      const player = playerRef.current
      if (!player) return
      if (player.ended) player.currentTime = 0
      try {
        await player.play()
        setError('')
      } catch {
        setError('재생을 시작하지 못했습니다. 플레이어에서 다시 시도해 주세요.')
      }
      return
    }
    setLoadingAudio(true)
    try {
      const audio = await getRecordingAudio(token, recording.id)
      const url = URL.createObjectURL(audio)
      const player = playerRef.current
      if (!player) throw new Error('재생 플레이어를 찾을 수 없습니다.')
      player.src = url
      setAudioUrl(url)
      setError('')
      try {
        await player.play()
        setPlayingAudio(true)
      } catch {
        setError('재생을 시작하지 못했어요. 다시 눌러 주세요.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '녹음을 불러오지 못했습니다.')
    } finally {
      setLoadingAudio(false)
    }
  }

  function togglePlayback() {
    const player = playerRef.current
    if (playingAudio) {
      player?.pause()
      return
    }
    void loadAudio()
  }

  function seekAudio(value: string) {
    const time = Number(value)
    if (!Number.isFinite(time)) return
    setPlaybackTime(time)
    if (playerRef.current) playerRef.current.currentTime = time
  }

  async function remove() {
    if (deleting || renaming || !window.confirm('이 녹음을 삭제할까요?')) return
    setDeleting(true)
    setError('')
    try {
      await deleteRecording(token, recording.id)
      onDeleted(recording.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '녹음을 삭제하지 못했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="voice-take-card">
      <form className="voice-name-editor" onSubmit={(event) => { event.preventDefault(); void saveName() }}>
        <label>목소리 이름<input aria-label="목소리 이름" maxLength={80} value={name} disabled={renaming || deleting} onChange={(event) => setName(event.target.value)} /></label>
        <Button type="submit" variant="secondary" disabled={renaming || deleting || !name.trim() || name.trim() === recording.name}>{renaming ? '저장 중' : '이름 저장'}</Button>
      </form>
      <div className="voice-take-toolbar">
        <div className="voice-take-meta">
          <span className="voice-take-wave" aria-hidden="true">♡</span>
          <time dateTime={recording.created_at}>{formatRecordingDate(recording.created_at)}</time>
          <span className="voice-take-duration">{Math.round(recording.duration_seconds)}초</span>
        </div>
        <div className="voice-take-actions">
          <Button className={`voice-take-action voice-take-action--play${playingAudio ? ' voice-take-action--playing' : ''}`} variant={playingAudio ? 'primary' : 'secondary'} onClick={togglePlayback} disabled={loadingAudio}>
            <span aria-hidden="true">{loadingAudio ? '◌' : playingAudio ? 'Ⅱ' : '▶'}</span>{loadingAudio ? '불러오는 중' : playingAudio ? '일시정지' : audioUrl ? playbackTime > 0 && playbackTime < audioDuration ? '이어 듣기' : '다시 듣기' : '듣기'}
          </Button>
          <Button className="voice-take-action voice-take-action--delete" variant="secondary" aria-label="녹음 삭제" title="녹음 삭제" disabled={deleting || renaming} aria-busy={deleting} onClick={() => void remove()}>
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            삭제
          </Button>
        </div>
      </div>
      <section className="transcript-reading-page" aria-label="저장한 녹음 대본">
        <p className="storybook-reading-page__text voice-take-transcript">{recording.transcript}</p>
      </section>
      <div className={`voice-take-playback warm-audio-playback${audioUrl ? '' : ' warm-audio-playback--empty'}`}>
        <audio ref={playerRef} className="warm-audio-media" aria-label="저장된 음성 재생" onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || recording.duration_seconds)} onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)} onPlay={() => setPlayingAudio(true)} onPause={() => setPlayingAudio(false)} onEnded={() => setPlayingAudio(false)} />
        {audioUrl && <>
          <input className="warm-audio-seek" type="range" min="0" max={audioDuration || recording.duration_seconds} step="0.1" value={Math.min(playbackTime, audioDuration || recording.duration_seconds)} aria-label="재생 위치" aria-valuetext={`${formatAudioTime(playbackTime)} / ${formatAudioTime(audioDuration || recording.duration_seconds)}`} onChange={(event) => seekAudio(event.currentTarget.value)} />
          <div className="warm-audio-time"><time>{formatAudioTime(playbackTime)}</time><time>{formatAudioTime(audioDuration || recording.duration_seconds)}</time></div>
        </>}
      </div>
      {error && <p role="alert" className="recorder-error">{error}</p>}
    </Card>
  )
}

function formatRecordingDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function GenerationPage({ onNavigate, token, recordings, initialText, initialTitle, onOutputCreated }: { onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; initialText?: string; initialTitle?: string; onOutputCreated: (output: LocalOutput) => void }) {
  return (
    <div className="page-stack">
      <PageHeading title="음성 만들기" />
      {token ? <GenerationWorkspace token={token} recordings={recordings} initialText={initialText} initialTitle={initialTitle} onOutputCreated={onOutputCreated} onNavigate={(route) => onNavigate(route)} /> : <Card title="PC 앱 연결 필요" />}
    </div>
  )
}

function StudioPage({ recordings, outputs, isChildMode, onChangeMode, onNavigate, onOpenStory, onGenerateStory, onOpenOutput, onComposeText }: { recordings: LocalRecording[]; outputs: LocalOutput[]; isChildMode: boolean; onChangeMode: (isChildMode: boolean) => void; onNavigate: (route: AppRoute) => void; onOpenStory: (story: Storybook) => void; onGenerateStory: (story: Storybook) => void; onOpenOutput: (output: LocalOutput) => void; onComposeText: () => void }) {
  return <StudioHome
    recordings={recordings}
    outputs={outputs}
    isChildMode={isChildMode}
    onChangeMode={onChangeMode}
    onRegisterVoice={() => onNavigate('record')}
    onManageVoices={() => onNavigate('voices')}
    onOpenStory={onOpenStory}
    onGenerateStory={onGenerateStory}
    onOpenOutput={onOpenOutput}
    onComposeText={onComposeText}
  />
}

function ResultsPage({ onNavigate, token, outputs, selectedOutputId, onOutputDeleted }: { onNavigate: (route: AppRoute) => void; token: string | null; outputs: LocalOutput[]; selectedOutputId: string | null; onOutputDeleted?: (id: string) => void }) {
  const visibleOutputs = selectedOutputId ? outputs.filter((output) => output.id === selectedOutputId) : outputs
  return (
    <div className="page-stack">
      <PageHeading title="만든 음성" />
      {token && visibleOutputs.length > 0 ? <div className="audio-output-list">{visibleOutputs.map((output) => <AudioOutputCard key={output.id} token={token} output={output} onDeleted={onOutputDeleted} showTechnicalDetails={false} />)}</div> : <Card className="empty-card audio-output-empty">
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
        </div>
        <ModelSettings token={token} />
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

function CurrentPage({ onUnsavedRecordingChange, route, onNavigate, token, recordings, outputs, systemInfo, generationDraft, selectedStoryId, selectedOutputId, isChildMode, onChangeMode, onGenerateText, onStartStoryGeneration, onRecordingSaved, onRecordingDeleted, onRecordingRenamed, onOutputCreated, onOutputDeleted, onOpenStory, onOpenOutput, onComposeText }: {
  onUnsavedRecordingChange: (unsaved: boolean) => void;
  route: AppRoute; onNavigate: (route: AppRoute) => void; token: string | null; recordings: LocalRecording[]; outputs: LocalOutput[]; systemInfo: RuntimeSystem | null;
  isChildMode: boolean; onChangeMode: (isChildMode: boolean) => void;
  generationDraft: { text: string; source: 'recording' | 'storybook' | 'manual'; bookId?: string } | null; selectedStoryId: string | null; selectedOutputId: string | null;
  onGenerateText: (text: string) => void; onStartStoryGeneration: (story: Storybook) => void; onRecordingSaved: (recording: LocalRecording) => void;
  onRecordingRenamed: (recording: LocalRecording) => void;
  onRecordingDeleted: (id: string) => void; onOutputCreated: (output: LocalOutput) => void; onOutputDeleted: (id: string) => void;
  onOpenStory: (story: Storybook) => void; onOpenOutput: (output: LocalOutput) => void; onComposeText: () => void;
}) {
  switch (route) {
    case 'studio':
      return <StudioPage recordings={recordings} outputs={outputs} isChildMode={isChildMode} onChangeMode={onChangeMode} onNavigate={onNavigate} onOpenStory={onOpenStory} onGenerateStory={onStartStoryGeneration} onOpenOutput={onOpenOutput} onComposeText={onComposeText} />
    case 'record':
      return <RecordingPage onNavigate={onNavigate} token={token} recordings={recordings} onSaved={onRecordingSaved} onUnsavedChange={onUnsavedRecordingChange} />
    case 'storybook':
      return <StorybookPage
        initialStory={storybooks.find((story) => story.id === selectedStoryId) ?? null}
        onGenerateSpeech={onGenerateText}
        token={token}
        recordings={recordings}
        outputs={outputs}
        onOutputDeleted={onOutputDeleted}
        onRegisterVoice={() => onNavigate('record')}
        onBack={() => onNavigate('studio')}
        listenOnly={isChildMode}
      />
    case 'voices':
      return <VoicesPage onNavigate={onNavigate} token={token} recordings={recordings} onDeleted={onRecordingDeleted} onRenamed={onRecordingRenamed} />
    case 'generate':
      return <GenerationPage onNavigate={onNavigate} token={token} recordings={recordings} initialText={generationDraft?.text} initialTitle={generationDraft?.bookId ? storybooks.find((story) => story.id === generationDraft.bookId)?.title : undefined} onOutputCreated={onOutputCreated} />
    case 'results':
      return <ResultsPage onNavigate={onNavigate} token={token} outputs={outputs} selectedOutputId={selectedOutputId} onOutputDeleted={isChildMode ? undefined : onOutputDeleted} />
    case 'settings':
      return <SettingsPage systemInfo={systemInfo} token={token} />
  }
}

export function App() {
  useExclusivePlayback()
  const [unsavedRecording, setUnsavedRecording] = useState(false)
  const [activeRoute, setActiveRoute] = useState<AppRoute>('studio')
  const [isChildMode, setIsChildMode] = useState(false)
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected')
  const [runtimeToken, setRuntimeToken] = useState<string | null>(null)
  const [recordings, setRecordings] = useState<LocalRecording[]>([])
  const [outputs, setOutputs] = useState<LocalOutput[]>([])
  const [systemInfo, setSystemInfo] = useState<RuntimeSystem | null>(null)
  const [generationDraft, setGenerationDraft] = useState<{ text: string; source: 'recording' | 'storybook' | 'manual'; bookId?: string } | null>(null)
  const [selectedStoryId, setSelectedStoryId] = useState<string | null>(null)
  const [selectedOutputId, setSelectedOutputId] = useState<string | null>(null)

  function navigate(route: AppRoute) {
    if (route === activeRoute) return
    if (unsavedRecording && !window.confirm('저장하지 않은 녹음이 있습니다. 녹음을 버리고 이동할까요?')) return
    if (route === 'results') setSelectedOutputId(null)
    if (activeRoute === 'generate') setGenerationDraft(null)
    setActiveRoute(route)
  }

  async function connectRuntime(code?: string) {
    const hasExistingSession = runtimeToken !== null
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
      if (!hasExistingSession) setActiveRoute('studio')
      setConnectionState('connected')
    } catch (error) {
      setConnectionState(error instanceof LocalRuntimeError && error.code === 'local_access_blocked' ? 'permission-denied' : 'error')
      throw error
    }
  }

  function handleRecordingSaved(recording: LocalRecording) {
    setRecordings((current) => [recording, ...current.filter((item) => item.id !== recording.id)])
    setGenerationDraft({ text: '', source: 'recording' })
    setActiveRoute('studio')
  }

  function handleStoryGenerate(text: string) {
    setGenerationDraft({ text, source: selectedStoryId ? 'storybook' : 'manual', bookId: selectedStoryId ?? undefined })
    setActiveRoute('generate')
  }

  function startStoryGeneration(story: Storybook) {
    setSelectedStoryId(story.id)
    setGenerationDraft({ text: storyScript(story), source: 'storybook', bookId: story.id })
    setActiveRoute('generate')
  }

  function composeText() {
    setSelectedStoryId(null)
    setGenerationDraft({ text: '', source: 'manual' })
    setActiveRoute('generate')
  }

  function openStory(story: Storybook) {
    setSelectedStoryId(story.id)
    setActiveRoute('storybook')
  }

  function openOutput(output: LocalOutput) {
    setSelectedOutputId(output.id)
    setActiveRoute('results')
  }

  function handleRecordingDeleted(id: string) {
    setRecordings((current) => current.filter((item) => item.id !== id))
  }

  function handleOutputCreated(output: LocalOutput) {
    setOutputs((current) => [output, ...current.filter((item) => item.id !== output.id)])

  }

  function handleOutputDeleted(id: string) {
    setOutputs((current) => current.filter((item) => item.id !== id))
    if (selectedOutputId === id) setSelectedOutputId(null)
  }

  async function reconnectRuntime() {
    try {
      await connectRuntime()
    } catch {
      // connectRuntime publishes the disconnected state for the header indicator.
    }
  }

  useEffect(() => {
    if (!runtimeToken || connectionState === 'checking') return
    let cancelled = false
    const checkConnection = async () => {
      try {
        await getRuntimeHealth()
        if (!cancelled) setConnectionState('connected')
      } catch (error) {
        if (!cancelled) setConnectionState(error instanceof LocalRuntimeError && error.code === 'local_access_blocked' ? 'permission-denied' : 'error')
      }
    }
    const interval = window.setInterval(() => void checkConnection(), 10_000)
    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [connectionState, runtimeToken])

  const setupComplete = runtimeToken !== null

  if (!setupComplete) {
    return <SetupScreen
      onPair={connectRuntime}
    />
  }

  return (
    <AppShell activeRoute={activeRoute} onNavigate={navigate} connectionState={connectionState} onReconnect={reconnectRuntime} isChildMode={isChildMode}>
      <div className="page-stack app-page-stack">
        {connectionState !== 'connected' && !isChildMode && <ConnectionStatus state={connectionState} />}
        <CurrentPage onUnsavedRecordingChange={setUnsavedRecording} route={activeRoute} onNavigate={navigate} token={runtimeToken} recordings={recordings} outputs={outputs} systemInfo={systemInfo} generationDraft={generationDraft} selectedStoryId={selectedStoryId} selectedOutputId={selectedOutputId} isChildMode={isChildMode} onChangeMode={setIsChildMode} onGenerateText={handleStoryGenerate} onStartStoryGeneration={startStoryGeneration} onRecordingSaved={handleRecordingSaved} onRecordingRenamed={(recording) => setRecordings((items) => items.map((item) => item.id === recording.id ? recording : item))} onRecordingDeleted={handleRecordingDeleted} onOutputCreated={handleOutputCreated} onOutputDeleted={handleOutputDeleted} onOpenStory={openStory} onOpenOutput={openOutput} onComposeText={composeText} />
      </div>
    </AppShell>
  )
}
