import { Button, Card, Textarea } from '@windsoft/ui'
import { useEffect, useRef, useState } from 'react'
import { listJobs, createWorkspace, saveWorkspace, listWorkspaces, selectWorkspaceOutput, type LocalWorkspace, createGeneration, getJob, getRecordingAudio, listOutputs, listModels, type LocalModel, type LocalOutput, type LocalRecording, type RuntimeJob } from '../../api/localRuntime'
import { ChoiceCardGroup } from '../../components/ChoiceCardGroup'
import { getVoiceName, saveOutputTitle } from '../studio/localMetadata'

import { AudioOutputCard } from '../results/AudioOutputCard'

function readDraft(): { text?: string; title?: string; recordingId?: string; workId?: string; modelId?: string; intensity?: number } {
  try {
    const value: unknown = JSON.parse(sessionStorage.getItem('voice-studio.generation-draft') ?? '{}')
    if (!value || typeof value !== 'object') return {}
    const draft = value as Record<string, unknown>
    return { modelId: typeof draft.modelId === 'string' ? draft.modelId : undefined, intensity: typeof draft.intensity === 'number' && Number.isFinite(draft.intensity) && draft.intensity >= 0 && draft.intensity <= 1 ? draft.intensity : undefined, text: typeof draft.text === 'string' ? draft.text : undefined, title: typeof draft.title === 'string' ? draft.title : undefined, recordingId: typeof draft.recordingId === 'string' ? draft.recordingId : undefined, workId: typeof draft.workId === 'string' ? draft.workId : undefined }
  } catch { return {} }
}

const baselineModel = 'qwen3-tts-0.6b-base'

interface GenerationWorkspaceProps {
  token: string
  recordings: LocalRecording[]
  initialText?: string
  initialTitle?: string
  onOutputCreated: (output: LocalOutput) => void
  onNavigate: (route: 'record' | 'settings') => void
}

export function GenerationWorkspace({ token, recordings, initialText, initialTitle, onOutputCreated, onNavigate }: GenerationWorkspaceProps) {
  const draft = useRef(initialText !== undefined ? {} : readDraft())
  const restoredWorkId = useRef(draft.current.workId)
  const [works, setWorks] = useState<LocalWorkspace[]>([])
  const [work, setWork] = useState<LocalWorkspace | null>(null)
  const [jobsLoaded, setJobsLoaded] = useState(false)
  const [recentJobs, setRecentJobs] = useState<RuntimeJob[]>([])
  const [worksLoaded, setWorksLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [workStatus, setWorkStatus] = useState('')
  const [models, setModels] = useState<LocalModel[]>([])
  const [recordingId, setRecordingId] = useState(() => draft.current.recordingId ?? recordings[0]?.id ?? '')
  const [modelId, setModelId] = useState(() => draft.current.modelId ?? baselineModel)
  const [intensity, setIntensity] = useState(() => draft.current.intensity ?? 0.5)
  const expressionEnabled = modelId === 'chatterbox-multilingual-v2' || models.find((item) => item.id === modelId)?.supports_expression === true
  const [text, setText] = useState(() => initialText ?? draft.current.text ?? '')
  const [title, setTitle] = useState(() => initialTitle ?? draft.current.title ?? '')
  const [job, setJob] = useState<RuntimeJob | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [history, setHistory] = useState<LocalOutput[]>([])
  const [previewUrl, setPreviewUrl] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (!worksLoaded) return
    try { sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ text, title, recordingId, modelId, intensity, workId: work?.id ?? restoredWorkId.current })) }
    catch { setError('초안을 보관하지 못했습니다. 화면을 이동하기 전에 텍스트를 복사해 주세요.') }
  }, [text, title, recordingId, modelId, intensity, work, worksLoaded])
  const submitLock = useRef(false)
  const previewRequest = useRef(0)

  useEffect(() => {
    let active = true
    void listOutputs(token).then((items) => { if (active) setHistory(items) }).catch(() => { if (active) setError('생성 이력을 불러오지 못했습니다.') })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    previewRequest.current += 1
    setPreviewUrl('')
    setPreviewLoading(false)
  }, [recordingId])

  useEffect(() => () => { previewRequest.current += 1 }, [])
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }, [previewUrl])

  useEffect(() => {
    let active = true
    void listWorkspaces(token).then((items) => {
      if (!active) return
      const restored = items.find((item) => item.id === restoredWorkId.current) ?? null
      setWorks(items)
      setWork(restored)
      if (restored) {
        if (draft.current.modelId === undefined) setModelId(restored.generation_settings?.model_id ?? baselineModel)
        if (draft.current.intensity === undefined) setIntensity(restored.generation_settings?.expression_intensity ?? 0.5)
        if (draft.current.text === undefined) setText(restored.text)
        if (draft.current.title === undefined) setTitle(restored.title)
        if (draft.current.recordingId === undefined) setRecordingId(restored.recording_id ?? '')
      }
      setWorksLoaded(true)
    }).catch(() => { if (active) setError('작업 목록을 불러오지 못했습니다. PC 앱 버전과 연결을 확인해 주세요.') })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    let active = true
    void listJobs(token).then((items) => {
      if (!active) return
      const pending = items.find((item) => item.kind === 'generation' && !['completed', 'failed', 'cancelled'].includes(item.status))
      setRecentJobs(items)
      const latest = restoredWorkId.current ? items.find((item) => item.kind === 'generation' && item.workspace_id === restoredWorkId.current) : undefined
      const restored = pending ?? (latest?.status === 'failed' ? latest : undefined)
      if (restored) {
        setJob(restored)
        if (restored.status === 'failed') setError(jobError(restored.error_code))
      }
      setJobsLoaded(true)
    }).catch(() => { if (active) setError('진행 중인 작업을 확인하지 못했습니다. 연결을 확인한 뒤 다시 열어 주세요.') })
    return () => { active = false }
  }, [token])

  function rememberWork(saved: LocalWorkspace) {
    restoredWorkId.current = saved.id
    setWork(saved)
    setWorks((items) => [saved, ...items.filter((item) => item.id !== saved.id)])
  }

  async function persistWork() {
    const current = work ?? await createWorkspace(token, title.trim() || '제목 없는 작업')
    // Retain the created identity even if the following save fails.
    if (!work) rememberWork(current)
    const saved = await saveWorkspace(token, current.id, title.trim() || '제목 없는 작업', text, recordingId || null, { model_id: modelId, ...(expressionEnabled ? { expression_intensity: intensity } : {}) })
    rememberWork(saved)
    setWorkStatus('저장됨')
    return saved
  }

  async function saveWork() {
    setSaving(true)
    setError('')
    try { await persistWork() }
    catch (reason) { setError(reason instanceof Error ? reason.message : '작업을 저장하지 못했습니다.') }
    finally { setSaving(false) }
  }

  function openWork(id: string) {
    const dirty = work ? text !== work.text || title !== work.title || recordingId !== (work.recording_id ?? '') || modelId !== (work.generation_settings?.model_id ?? baselineModel) || (expressionEnabled && intensity !== (work.generation_settings?.expression_intensity ?? 0.5)) : Boolean(text || title)
    if (dirty && !window.confirm('저장하지 않은 변경 사항을 버리고 작업을 전환할까요?')) return
    const next = works.find((item) => item.id === id) ?? null
    restoredWorkId.current = next?.id
    setWork(next)
    setModelId(next?.generation_settings?.model_id ?? baselineModel)
    setIntensity(next?.generation_settings?.expression_intensity ?? 0.5)
    setText(next?.text ?? '')
    setTitle(next?.title ?? '')
    setRecordingId(next ? next.recording_id ?? '' : recordings[0]?.id ?? '')
    const latest = next ? recentJobs.find((item) => item.kind === 'generation' && item.workspace_id === next.id) : undefined
    setJob(latest?.status === 'failed' ? latest : null)
    setError(latest?.status === 'failed' ? jobError(latest.error_code) : '')
    setWorkStatus(next ? '저장된 작업' : '새 작업')
  }

  async function selectFinal(outputId: string) {
    if (!work) return
    setSaving(true)
    try { rememberWork(await selectWorkspaceOutput(token, work.id, outputId)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : '최종 결과를 선택하지 못했습니다.') }
    finally { setSaving(false) }
  }

  async function previewVoice() {
    const request = ++previewRequest.current
    setPreviewLoading(true)
    try {
      const audio = await getRecordingAudio(token, recordingId)
      if (request === previewRequest.current) setPreviewUrl(URL.createObjectURL(audio))
    } catch (reason) {
      if (request === previewRequest.current) setError(reason instanceof Error ? reason.message : '목소리를 불러오지 못했습니다.')
    } finally {
      if (request === previewRequest.current) setPreviewLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    void listModels(token).then((items) => { if (active) setModels(items) }).catch(() => {
      if (active) setError('음성을 만들 준비를 못했어요. 설정을 확인해 주세요.')
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return
    let active = true
    let inFlight = false
    const poll = window.setInterval(() => {
      if (inFlight) return
      inFlight = true
      void getJob(token, job.id).then((next) => {
        if (!active) return
        setJob(next)
        setRecentJobs((items) => [next, ...items.filter((item) => item.id !== next.id)])
        if (next.status === 'completed' && next.output) {
          const outputTitle = works.find((item) => item.id === next.workspace_id)?.title || initialTitle || title.trim() || '만든 음성'
          saveOutputTitle(next.output.id, outputTitle)
          setHistory((items) => [next.output!, ...items.filter((item) => item.id !== next.output!.id)])
          onOutputCreated(next.output)
        }
        if (next.status === 'failed') setError(jobError(next.error_code))
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '작업 상태를 확인하지 못했습니다.') }).finally(() => { inFlight = false })
    }, 1500)
    return () => { active = false; window.clearInterval(poll) }
  }, [job, token, onOutputCreated, title, initialTitle, works])

  const selectedRecording = recordings.find((recording) => recording.id === recordingId)
  const missingRecording = Boolean(recordingId && !selectedRecording)
  const modelReady = models.find((model) => model.id === modelId)?.status === 'installed'
  const running = job !== null && !['completed', 'failed', 'cancelled'].includes(job.status)
  const visibleHistory = history.filter((item) => work ? item.workspace_id === work.id : !item.workspace_id)
  const recordingOptions = recordings.map((recording, index) => ({
    value: recording.id,
    title: recording.name || getVoiceName(recording.id, `저장한 목소리 ${index + 1}`),
    detail: `${formatRecordingDate(recording.created_at)} · ${recording.duration_seconds.toFixed(0)}초 녹음`,
    disabled: running || submitting,
    icon: <span aria-hidden="true">♫</span>,
  }))
  async function generate() {
    if (submitLock.current || !worksLoaded || !jobsLoaded || !selectedRecording) return
    submitLock.current = true
    setSubmitting(true)
    setError('')
    try {
      const saved = await persistWork()
      const next = expressionEnabled
        ? await createGeneration(token, recordingId, text.trim(), modelId, saved.id, intensity)
        : await createGeneration(token, recordingId, text.trim(), modelId, saved.id)
      setJob(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '음성 생성 작업을 시작하지 못했습니다.')
    } finally {
      submitLock.current = false
      setSubmitting(false)
    }
  }

  return (
    <div className="generation-workspace">
      <div className="workspace-toolbar">
        <label>작업<select aria-label="저장한 작업" value={work?.id ?? ''} onChange={(event) => openWork(event.target.value)} disabled={running || submitting || saving || !worksLoaded}><option value="">새 작업</option>{works.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <Button variant="secondary" onClick={() => void saveWork()} disabled={saving || submitting || running || !worksLoaded || !jobsLoaded}>{saving ? '저장 중' : '작업 저장'}</Button>
        <span role="status">{workStatus}</span>
      </div>
      <Card className="generation-card">
        <div className="generation-layout">
          <section className="generation-section generation-script-section" aria-labelledby="generation-script-title">
            <h2 id="generation-script-title" className="generation-section__title">읽을 텍스트</h2>
            {<label className="generation-title-field"><span>제목</span><input value={title} disabled={running || submitting || saving || !worksLoaded} onChange={(event) => setTitle(event.target.value)} placeholder="제목 입력" maxLength={48} /></label>}
            <Textarea className="generation-script-page" aria-label="읽을 텍스트" rows={8} maxLength={1_000} value={text} disabled={running || submitting || saving || !worksLoaded} onChange={(event) => setText(event.target.value)} />
            <span className="studio-character-count">{text.length.toLocaleString()} / 1,000</span>
            <div className="generation-actions" role="group" aria-label="생성 동작">
              <Button variant="primary" size="lg" onClick={() => void generate()} disabled={!modelReady || !selectedRecording || !text.trim() || checking || running || submitting || saving || !worksLoaded || !jobsLoaded}>
                {running ? '음성을 만들고 있어요…' : job?.status === 'failed' ? '다시 생성' : '음성 만들기'}
              </Button>
              {recordings.length > 0
                ? !checking && !modelReady && <Button className="generation-actions__secondary" variant="secondary" onClick={() => onNavigate('settings')} disabled={running}>음성 만들기 준비</Button>
                : <Button className="generation-actions__secondary" variant="secondary" onClick={() => onNavigate('record')} disabled={running}>목소리 등록</Button>}
            </div>
          </section>

          <div className="generation-options-column">
            {(models.length > 1 || modelId !== baselineModel) && <section className="generation-section generation-engine-section" aria-labelledby="generation-engine-title">
              <h2 id="generation-engine-title" className="generation-section__title">생성 설정</h2>
              <label className="generation-engine-field">음성 엔진<select aria-label="음성 엔진" value={modelId} disabled={running || submitting || saving || !worksLoaded || checking} onChange={(event) => setModelId(event.target.value)}>
                {!models.some((item) => item.id === modelId) && <option value={modelId}>사용할 수 없는 엔진</option>}
                {models.map((item) => <option key={item.id} value={item.id}>{item.supports_expression ? '표현 음성' : '기본 음성'}{item.status !== 'installed' ? ' · 설치 필요' : ''}</option>)}
              </select></label>
              {expressionEnabled && <label className="generation-expression-field"><span>표현 강도 <output>{Math.round(intensity * 100)}%</output></span><input type="range" aria-label="표현 강도" aria-valuetext={`${Math.round(intensity * 100)}%`} min="0" max="1" step="0.05" value={intensity} disabled={running || submitting || saving || !worksLoaded} onChange={(event) => setIntensity(Number(event.target.value))} /></label>}
            </section>}

            <section className="generation-section generation-voice-section" aria-labelledby="generation-voice-title">
              <h2 id="generation-voice-title" className="generation-section__title">목소리 선택</h2>
              {recordings.length > 0
                ? <ChoiceCardGroup name="generation-voice" legend="사용할 녹음 선택" options={recordingOptions} value={recordingId} onChange={setRecordingId} />
                : <p className="generation-no-voice">목소리 없음</p>}
              {missingRecording && <p role="alert" className="recorder-error">등록한 목소리를 찾을 수 없습니다. 다시 선택해 주세요.</p>}
              {selectedRecording && <div className="voice-preview-controls"><Button variant="secondary" onClick={() => void previewVoice()} disabled={previewLoading}>{previewLoading ? '불러오는 중' : '선택한 목소리 듣기'}</Button>{previewUrl && <audio controls src={previewUrl} aria-label="선택한 목소리 미리 듣기" />}</div>}
            </section>
          </div>
        </div>
        {(error || job) && <div className="generation-feedback">
          {error && <p role="alert" className="recorder-error">{error}</p>}
          {job && <div className="generation-job"><strong role="status" aria-live="polite">{jobStatus(job.status)}</strong>{running && <JobElapsed key={job.id} createdAt={job.created_at} />}{job.status === 'failed' && job.error_type && <span>오류 유형: {job.error_type}</span>}</div>}
        </div>}
      </Card>
      <section className="generation-history" aria-label="생성 이력"><h2>생성 이력 <span>{visibleHistory.length}</span></h2>
        {visibleHistory.map((output) => <article key={output.id} className="generation-version">
          {work && <Button variant={work.selected_output_id === output.id ? 'primary' : 'secondary'} disabled={saving} aria-pressed={work.selected_output_id === output.id} onClick={() => void selectFinal(output.id)}>{work.selected_output_id === output.id ? '최종 결과' : '최종 결과로 선택'}</Button>}
          {output.expression_intensity !== undefined && <span className="generation-version-settings">표현 음성 · 강도 {Math.round(output.expression_intensity * 100)}%</span>}
          <AudioOutputCard token={token} output={output} showTechnicalDetails={false} />
        </article>)}
        {visibleHistory.length === 0 && <p>생성된 음성 없음</p>}
      </section>
    </div>
  )
}

function formatRecordingDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function jobStatus(status: RuntimeJob['status']): string {
  switch (status) {
    case 'queued': return '음성을 만들 준비를 하고 있어요.'
    case 'loading_model': return '처음 음성을 만들 준비를 하고 있어요.'
    case 'downloading': return '음성을 만들 준비를 하고 있어요.'
    case 'generating': return '음성을 만들고 있어요.'
    case 'completed': return '음성을 만들었어요.'
    case 'failed': return '음성을 만들지 못했어요.'
    case 'cancelled': return '작업을 취소했어요.'
  }
}

function jobError(code?: string): string {
  switch (code) {
    case 'runtime_restarted': return 'PC 앱이 재시작되어 생성이 중단되었습니다. 저장된 대본으로 다시 생성할 수 있습니다.'
    case 'memory_insufficient': return '음성을 만들지 못했어요. 설정을 확인해 주세요.'
    case 'model_not_installed': return '음성 만들기 준비가 필요해요. 설정을 확인해 주세요.'
    default: return '음성을 만들지 못했어요.'
  }
}

function JobElapsed({ createdAt }: { createdAt?: string }) {
  const [now, setNow] = useState(Date.now)
  const started = Date.parse(createdAt ?? '')
  useEffect(() => {
    if (!Number.isFinite(started)) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [started])
  if (!Number.isFinite(started)) return null
  const elapsed = Math.max(0, Math.floor((now - started) / 1000))
  return <time aria-label="생성 경과 시간">경과 {String(Math.floor(elapsed / 60)).padStart(2, '0')}:{String(elapsed % 60).padStart(2, '0')}</time>
}
