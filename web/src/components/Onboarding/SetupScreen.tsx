import { Button, Card } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { cancelJob, getJob, installModel, listModels, type LocalModel, type RuntimeJob } from '../../api/localRuntime'
import { ConnectionStatus, type ConnectionState } from '../ConnectionStatus'

const baselineModelId = 'qwen3-tts-0.6b-base'

interface SetupScreenProps {
  connectionState: ConnectionState
  token: string | null
  model: LocalModel | null
  onPair: (code: string) => Promise<void>
  onModelsUpdated: (models: LocalModel[]) => void
}

export function SetupScreen({ connectionState, token, model, onPair, onModelsUpdated }: SetupScreenProps) {
  const modelStep = token !== null

  return (
    <main className="setup-screen">
      <header className="setup-screen__brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 18v-4m5 9V9m5 15V7m5 17v-9m5 5v-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <div><strong>보이스 스튜디오</strong><span>첫 사용 설정</span></div>
      </header>

      <div className="setup-screen__content">
        <div className="setup-screen__intro">
          <span className="section-kicker">먼저 한 번만 설정해요</span>
          <h1>녹음 전에 PC를 준비해요</h1>
          <p>PC 앱과 음성 모델을 준비하고 엄마 목소리를 저장해, 그림·대본·목소리가 함께 나오는 동화를 만들어요.</p>
        </div>

        <ol className="setup-progress" aria-label="동화 만들기 진행 단계">
          <li className={modelStep ? 'setup-progress__step setup-progress__step--done' : 'setup-progress__step setup-progress__step--active'}>
            <span>{modelStep ? '✓' : '1'}</span><div><strong>PC 앱 연결</strong><small>{modelStep ? '완료' : '현재 단계'}</small></div>
          </li>
          <li className={modelStep ? 'setup-progress__step setup-progress__step--active' : 'setup-progress__step'}>
            <span>2</span><div><strong>음성 모델 준비</strong><small>{modelStep ? '현재 단계' : '다음 단계'}</small></div>
          </li>
          <li className="setup-progress__step"><span>3</span><div><strong>내 목소리 녹음</strong><small>설정 후 시작</small></div></li>
          <li className="setup-progress__step"><span>4</span><div><strong>동화로 완성</strong><small>그림·대본·엄마 목소리</small></div></li>
        </ol>

        {!token ? <RuntimeSetupStep connectionState={connectionState} onPair={onPair} /> : (
          <ModelSetupStep token={token} model={model} onModelsUpdated={onModelsUpdated} />
        )}

        <p className="setup-screen__privacy">녹음, 대본, 생성 결과는 내 PC에 저장됩니다.</p>
      </div>
    </main>
  )
}

function RuntimeSetupStep({ connectionState, onPair }: Pick<SetupScreenProps, 'connectionState' | 'onPair'>) {
  return (
    <section className="setup-current" aria-labelledby="runtime-setup-title">
      <Card className="setup-current__card">
        <span className="section-kicker">1단계 · PC 연결</span>
        <h2 id="runtime-setup-title">PC 로컬 앱을 켜고 연결해요</h2>
        <p>웹 화면만으로는 마이크 파일을 저장하거나 음성을 생성할 수 없습니다. PC에서 로컬 앱을 실행한 뒤 터미널의 1회용 코드를 입력하세요.</p>
        <div className="setup-command"><span>Linux</span><code>./scripts/start-local-runtime-linux.sh</code></div>
        <div className="setup-downloads">
          <a href="/install/windows-wsl.md" target="_blank" rel="noreferrer">Windows + WSL2 설치 가이드</a>
          <a href="/install/windows/install-local-voice.ps1" download>PowerShell 설치 스크립트</a>
          <a href="/install/windows/start-local-voice.ps1" download>PowerShell 실행 스크립트</a>
        </div>
      </Card>
      <ConnectionStatus state={connectionState} onPair={onPair} pairingOpenByDefault />
    </section>
  )
}

function ModelSetupStep({ token, model, onModelsUpdated }: Pick<SetupScreenProps, 'token' | 'model' | 'onModelsUpdated'> & { token: string }) {
  const [acceptLicense, setAcceptLicense] = useState(false)
  const [job, setJob] = useState<RuntimeJob | null>(null)
  const [error, setError] = useState('')
  const running = job !== null && !['completed', 'failed', 'cancelled'].includes(job.status)

  useEffect(() => {
    if (!job || ['completed', 'failed', 'cancelled'].includes(job.status)) return
    let active = true
    const timer = window.setInterval(() => {
      void getJob(token, job.id).then(async (next) => {
        if (!active) return
        setJob(next)
        if (next.status === 'completed') onModelsUpdated(await listModels(token))
        if (next.status === 'failed') setError('모델 설치에 실패했습니다. 로컬 앱 터미널의 오류를 확인한 뒤 다시 시도해 주세요.')
      }).catch((reason) => {
        if (active) setError(reason instanceof Error ? reason.message : '설치 상태를 확인하지 못했습니다.')
      })
    }, 1500)
    return () => { active = false; window.clearInterval(timer) }
  }, [job?.id, job?.status, token, onModelsUpdated])

  async function startInstallation() {
    setError('')
    try {
      setJob(await installModel(token, baselineModelId, acceptLicense))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '모델 다운로드를 시작하지 못했습니다.')
    }
  }

  async function cancelInstallation() {
    if (!job) return
    try {
      await cancelJob(token, job.id)
      setJob((current) => current ? { ...current, status: 'cancelled' } : current)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '다운로드를 취소하지 못했습니다.')
    }
  }

  return (
    <section className="setup-current" aria-labelledby="model-setup-title">
      <Card className="setup-current__card">
        <span className="section-kicker">2단계 · 음성 모델</span>
        <h2 id="model-setup-title">Qwen 음성 모델을 준비해요</h2>
        {!model ? <p>지원 모델 상태를 확인할 수 없습니다. 로컬 앱을 다시 연결해 주세요.</p> : <>
          <p>음성 생성에 필요한 모델입니다. 약 2.52 GB를 이 PC에 내려받습니다.</p>
          <div className="model-setup-meta">
            <span><strong>Qwen3-TTS 0.6B Base</strong><small>한국어 · CPU 실행 · Apache-2.0</small></span>
            <span><strong>{model.disk_free_gib.toFixed(1)} GiB</strong><small>모델 저장 공간</small></span>
          </div>
          {model.status === 'installing' && !job ? <p className="setup-model-running" role="status">모델 다운로드가 이미 진행 중입니다. 완료되면 녹음 화면으로 이동합니다.</p> : null}
          {model.status === 'not_installed' && <>
            <a className="model-setup-license" href="https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base" target="_blank" rel="noreferrer">모델 저장소와 Apache-2.0 라이선스 확인</a>
            <label className="model-setup-consent"><input type="checkbox" checked={acceptLicense} onChange={(event) => setAcceptLicense(event.target.checked)} /> 라이선스와 다운로드 출처를 확인했습니다.</label>
            <Button variant="primary" size="lg" onClick={() => void startInstallation()} disabled={!acceptLicense || model.disk_free_gib < 8 || running}>
              {running ? '모델 설치 중…' : '이 PC에 모델 설치'}
            </Button>
            {model.disk_free_gib < 8 && <p role="alert" className="recorder-error">모델 캐시에 8 GiB 이상 여유 공간을 확보해 주세요.</p>}
          </>}
          {running && <div className="model-download-progress" role="status">
            <span>{job.progress_percent == null ? '다운로드 중' : `${job.progress_percent}%`}</span>
            <progress max="100" value={job.progress_percent ?? undefined} />
            <Button variant="secondary" onClick={() => void cancelInstallation()}>다운로드 취소</Button>
          </div>}
          {model.status === 'installed' && <p className="setup-model-running" role="status">모델 확인 완료. 녹음 화면을 여는 중입니다.</p>}
        </>}
        {error && <p role="alert" className="recorder-error">{error}</p>}
      </Card>
    </section>
  )
}
