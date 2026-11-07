import { Button, Card, FormField, Textarea } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { cancelJob, createGeneration, getJob, installModel, listModels, type LocalModel, type LocalOutput, type LocalRecording, type RuntimeJob } from '../../api/localRuntime'
import { AudioOutputCard } from '../results/AudioOutputCard'

const baselineModel = 'qwen3-tts-0.6b-base'

interface GenerationWorkspaceProps {
  token: string
  recordings: LocalRecording[]
  initialText?: string
  draftSource?: 'recording' | 'storybook'
  onOutputCreated: (output: LocalOutput) => void
  onNavigate: (route: 'record') => void
}

export function GenerationWorkspace({ token, recordings, initialText, draftSource, onOutputCreated, onNavigate }: GenerationWorkspaceProps) {
  const [models, setModels] = useState<LocalModel[]>([])
  const [recordingId, setRecordingId] = useState(recordings[0]?.id ?? '')
  const [modelId, setModelId] = useState(baselineModel)
  const [text, setText] = useState(initialText ?? '안녕하세요. 오늘은 제가 좋아하는 책을 읽어보겠습니다.')
  const [job, setJob] = useState<RuntimeJob | null>(null)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)
  const [acceptLicense, setAcceptLicense] = useState(false)

  useEffect(() => {
    if (!recordingId && recordings[0]) setRecordingId(recordings[0].id)
  }, [recordings, recordingId])

  useEffect(() => {
    let active = true
    void listModels(token).then((items) => { if (active) setModels(items) }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : '모델 상태를 불러오지 못했습니다.')
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return
    let active = true
    const poll = window.setInterval(() => {
      void getJob(token, job.id).then((next) => {
        if (!active) return
        setJob(next)
        if (next.status === 'completed' && next.output) onOutputCreated(next.output)
        if (next.status === 'completed' && next.kind === 'model_install') {
          void listModels(token).then(setModels)
        }
        if (next.status === 'failed') setError(jobError(next.error_code))
      }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : '작업 상태를 확인하지 못했습니다.') })
    }, 1500)
    return () => { active = false; window.clearInterval(poll) }
  }, [job, token, onOutputCreated])

  const modelReady = models.find((model) => model.id === modelId)?.status === 'installed'
  const running = job !== null && !['completed', 'failed', 'cancelled'].includes(job.status)
  const model = models.find((item) => item.id === modelId)
  const installing = job?.kind === 'model_install' && job.status === 'downloading'

  async function installBaselineModel() {
    setError('')
    try {
      setJob(await installModel(token, modelId, acceptLicense))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '모델 다운로드를 시작하지 못했습니다.')
    }
  }

  async function cancelInstallation() {
    if (!job) return
    try {
      await cancelJob(token, job.id)
      setError('다운로드 취소를 요청했습니다. 이미 받은 모델 파일은 다음 시도에서 이어받을 수 있습니다.')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '다운로드를 취소하지 못했습니다.')
    }
  }

  async function generate() {
    setError('')
    try {
      const next = await createGeneration(token, recordingId, text.trim(), modelId)
      setJob(next)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '음성 생성 작업을 시작하지 못했습니다.')
    }
  }

  return (
    <div className="generation-workspace">
      <Card className="generation-card">
        <div className="generation-form">
          <div className="generation-form__voice">
          <FormField label="읽을 목소리">
            <select className="generation-select" value={recordingId} onChange={(event) => setRecordingId(event.target.value)}>
              {recordings.length === 0 && <option value="">먼저 목소리를 녹음하고 저장해 주세요</option>}
              {recordings.map((recording) => <option key={recording.id} value={recording.id}>{new Date(recording.created_at).toLocaleString('ko-KR')} · {recording.duration_seconds.toFixed(0)}초</option>)}
            </select>
          </FormField>
          </div>
          <div className="generation-form__text">
            <FormField label="읽을 문장">
              <Textarea rows={4} maxLength={1_000} value={text} onChange={(event) => setText(event.target.value)} />
            </FormField>
          </div>
          <div className="generation-form__submit">
          <Button variant="primary" size="lg" onClick={() => void generate()} disabled={!modelReady || !recordingId || !text.trim() || checking || running}>
            {running ? '생성 중…' : draftSource === 'recording' ? '저장된 텍스트로 음성 만들기' : draftSource === 'storybook' ? '이 동화 대본으로 음성 만들기' : '내 목소리로 생성'}
          </Button>
          </div>
          <div className="generation-form__model">
            <div className="generation-model-field">
              <FormField label="음성 모델">
              <select className="generation-select" value={modelId} onChange={(event) => setModelId(event.target.value)} disabled={checking}>
                {models.map((model) => <option key={model.id} value={model.id}>{model.id === baselineModel ? 'Qwen3-TTS 0.6B Base' : model.id}</option>)}
              </select>
              </FormField>
              {!checking && model && <span className={`generation-model-status generation-model-status--${model.status}`} role="status" aria-label={model.status === 'installed' ? '모델 설치됨' : model.status === 'installing' ? '모델 설치 중' : '모델 설치 필요'}>
                <span aria-hidden="true">{model.status === 'installed' ? '✓' : model.status === 'installing' ? '◌' : '!'}</span>
                <span className="sr-only">{model.status === 'installed' ? '모델 설치됨' : model.status === 'installing' ? '모델 설치 중' : '모델 설치 필요'}</span>
              </span>}
            </div>
          {model?.status === 'installed' && <div className="generation-memory" role="meter" aria-label="메모리 상태" aria-valuemin={0} aria-valuemax={Math.max(model.memory_available_gib ?? 0, model.memory_recommended_free_gib)} aria-valuenow={model.memory_available_gib ?? 0} aria-valuetext={`${model.memory_available_gib?.toFixed(1) ?? '확인 불가'} GiB 사용 가능, 권장 ${model.memory_recommended_free_gib.toFixed(1)} GiB`}>
            <span className="generation-memory__icon" aria-hidden="true">▤</span>
            <span className="generation-memory__bar"><span style={{ width: `${Math.min(100, ((model.memory_available_gib ?? 0) / model.memory_recommended_free_gib) * 100)}%` }} /></span>
            <output>{model.memory_available_gib?.toFixed(1) ?? '—'} / {model.memory_recommended_free_gib.toFixed(1)} GiB</output>
          </div>}
          </div>
          {recordings.length > 0 && <Button variant="secondary" onClick={() => onNavigate('record')} disabled={running}>다른 대본으로 한 번 더 녹음하기</Button>}
          {recordings.length === 0 && <div className="generation-needs-recording"><p>대본은 준비됐어요. 내 목소리를 먼저 저장하면 이 화면으로 돌아와 바로 생성할 수 있습니다.</p><Button variant="secondary" onClick={() => onNavigate('record')}>내 목소리 녹음하기</Button></div>}
          {!checking && model?.status === 'not_installed' && (
            <details className="model-install-disclosure">
              <summary>모델 설치가 필요해요</summary>
            <section className="model-install-card" aria-label="Qwen 모델 설치">
              <strong>Qwen3-TTS 0.6B Base 설치</strong>
              <p>공개 저장소에서 약 2.52 GB를 내려받습니다. 이 PC 모델 캐시에 {model.disk_free_gib.toFixed(1)} GiB 여유가 있습니다. 설치 파일은 Hugging Face 캐시에 보관됩니다.</p>
              <a href="https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base" target="_blank" rel="noreferrer">모델 저장소와 Apache-2.0 라이선스 확인</a>
              <label><input type="checkbox" checked={acceptLicense} onChange={(event) => setAcceptLicense(event.target.checked)} /> 라이선스와 다운로드 출처를 확인했습니다.</label>
              <Button variant="secondary" onClick={() => void installBaselineModel()} disabled={!acceptLicense || model.disk_free_gib < 8 || running}>이 PC에 모델 설치</Button>
              {model.disk_free_gib < 8 && <p className="recorder-error">설치 전에 모델 캐시 디스크에 8 GiB 이상 여유 공간을 확보해 주세요.</p>}
            </section>
            </details>
          )}
          {model?.status === 'installing' && <p role="status" className="generation-installing">◌ 모델 다운로드 중</p>}
          {installing && <div className="model-download-progress"><span>{job.progress_percent === null || job.progress_percent === undefined ? '다운로드 중' : `${job.progress_percent}%`}</span><progress max="100" value={job.progress_percent ?? undefined} /><Button variant="secondary" onClick={() => void cancelInstallation()}>다운로드 취소</Button></div>}
          {error && <p role="alert" className="recorder-error">{error}</p>}
          {job && <div className="generation-job" role="status" aria-live="polite"><strong>{jobStatus(job.status)}</strong>{job.status === 'failed' && job.error_type && <span>오류 유형: {job.error_type}</span>}</div>}
        </div>
      </Card>
      {job?.status === 'completed' && job.output && <AudioOutputCard token={token} output={job.output} />}
    </div>
  )
}

function jobStatus(status: RuntimeJob['status']): string {
  switch (status) {
    case 'queued': return '생성 대기 중'
    case 'loading_model': return 'CPU 모델을 불러오는 중 · 첫 실행은 시간이 더 걸릴 수 있습니다.'
    case 'downloading': return '공개 모델 저장소에서 파일을 다운로드하고 있습니다.'
    case 'generating': return '한국어 음성을 생성하는 중입니다.'
    case 'completed': return '음성 생성 완료'
    case 'failed': return '음성 생성에 실패했습니다.'
    case 'cancelled': return '다운로드를 취소했습니다. 받은 파일은 재시도할 때 다시 사용할 수 있습니다.'
  }
}

function jobError(code?: string): string {
  switch (code) {
    case 'memory_insufficient': return '메모리가 부족해 생성하지 못했습니다. 다른 앱을 종료하고 짧은 문장으로 다시 시도해 주세요.'
    case 'model_not_installed': return 'Qwen 모델을 설치하지 못했습니다. 설정에서 모델을 준비해 주세요.'
    default: return '모델 실행이 실패했습니다. 로컬 앱 터미널의 오류 유형을 확인해 주세요.'
  }
}
