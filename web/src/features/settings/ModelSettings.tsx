import { Button, Card } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { cancelJob, getJob, installModel, listModels, type LocalModel, type RuntimeJob } from '../../api/localRuntime'

const modelId = 'qwen3-tts-0.6b-base'

export function ModelSettings({ token }: { token: string | null }) {
  const [model, setModel] = useState<LocalModel | null>(null)
  const [job, setJob] = useState<RuntimeJob | null>(null)
  const [acceptLicense, setAcceptLicense] = useState(false)
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    if (!token) {
      setModel(null)
      setChecking(false)
      return () => { active = false }
    }
    setChecking(true)
    void listModels(token).then((models) => {
      if (active) setModel(models.find((item) => item.id === modelId) ?? null)
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : '설정을 불러오지 못했습니다.')
    }).finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [token])

  useEffect(() => {
    if (!token || !job || ['completed', 'failed', 'cancelled'].includes(job.status)) return
    let active = true
    const poll = window.setInterval(() => {
      void getJob(token, job.id).then((next) => {
        if (!active) return
        setJob(next)
        if (next.status === 'completed') {
          void listModels(token).then((models) => {
            if (active) setModel(models.find((item) => item.id === modelId) ?? null)
          })
        }
        if (next.status === 'failed') setError('설정을 적용하지 못했습니다.')
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '진행 상태를 확인하지 못했습니다.')
      })
    }, 1500)
    return () => { active = false; window.clearInterval(poll) }
  }, [job, token])

  const running = job !== null && !['completed', 'failed', 'cancelled'].includes(job.status)

  async function install() {
    if (!token) return
    setError('')
    try {
      setJob(await installModel(token, modelId, acceptLicense))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '설치를 시작하지 못했습니다.')
    }
  }

  async function cancel() {
    if (!token || !job) return
    try {
      await cancelJob(token, job.id)
      setJob((current) => current ? { ...current, status: 'cancelled' } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '취소하지 못했습니다.')
    }
  }

  return <Card className="settings-model-card" title="음성 변환 준비">
    {checking ? <p role="status">확인 중</p> : !token ? <p>PC 앱을 연결해 주세요.</p> : model?.status === 'installed' ? <p>준비됨</p> : model ? <>
      <p>Qwen3-TTS 0.6B Base · 다운로드 {formatBytes(model.download_size_bytes)} · 저장 공간 {model.disk_free_gib.toFixed(1)} GiB</p>
      <a href="https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base" target="_blank" rel="noreferrer">모델 저장소와 Apache-2.0 라이선스 확인</a>
      <label><input type="checkbox" checked={acceptLicense} onChange={(event) => setAcceptLicense(event.target.checked)} /> 라이선스와 다운로드 출처를 확인했습니다.</label>
      <Button variant="secondary" onClick={() => void install()} disabled={!acceptLicense || model.disk_free_gib < 8 || running}>이 PC에 모델 설치</Button>
      {model.disk_free_gib < 8 && <p role="alert">설치 전에 저장 공간을 8 GiB 이상 확보해 주세요.</p>}
    </> : <p>준비 상태를 확인할 수 없습니다.</p>}
    {running && <div className="model-download-progress"><span>{job.progress_percent == null ? '설치 중' : `${job.progress_percent}%`}</span><progress max="100" value={job.progress_percent ?? undefined} /><Button variant="secondary" onClick={() => void cancel()}>취소</Button></div>}
    {job?.status === 'completed' && <p role="status">준비됨</p>}
    {job?.status === 'cancelled' && <p role="status">취소됨</p>}
    {error && <p role="alert" className="recorder-error">{error}</p>}
  </Card>
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1_000_000_000).toFixed(2)} GB`
}
