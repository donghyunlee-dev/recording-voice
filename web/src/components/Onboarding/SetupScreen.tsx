import { Button, Card, Typography, WizardForm } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { cancelJob, getJob, getRuntimeHealth, installModel, listModels, LocalRuntimeError, type LocalModel, type RuntimeJob } from '../../api/localRuntime'

const baselineModelId = 'qwen3-tts-0.6b-base'

interface SetupScreenProps {
  token: string | null
  model: LocalModel | null
  onPair: (code?: string) => Promise<void>
  onModelsUpdated: (models: LocalModel[]) => void
}

export function SetupScreen({ token, model, onPair, onModelsUpdated }: SetupScreenProps) {
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
          <Typography variant="caption" className="section-kicker">{modelStep ? '다음 단계' : '첫 번째 단계'}</Typography>
          <Typography variant="h1">{modelStep ? '음성 모델을 준비해요' : 'PC 앱을 설치해요'}</Typography>
          <Typography variant="body-sm">{modelStep ? 'PC 앱 연결이 끝났어요. 이제 음성 생성 모델을 준비합니다.' : 'Windows 10/11 PC에서 설치를 마친 뒤 이 배포 페이지로 돌아와 연결합니다.'}</Typography>
        </div>

        {!token ? <RuntimeSetupStep onPair={onPair} /> : (
          <ModelSetupStep token={token} model={model} onModelsUpdated={onModelsUpdated} />
        )}

        <p className="setup-screen__privacy">녹음, 대본, 생성 결과는 내 PC에 저장됩니다.</p>
      </div>
    </main>
  )
}

function RuntimeSetupStep({ onPair }: Pick<SetupScreenProps, 'onPair'>) {
  const [stage, setStage] = useState<'start' | 'install' | 'detect'>('start')
  const [runtimeDetected, setRuntimeDetected] = useState(false)
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (stage !== 'detect' || runtimeDetected) return
    let active = true
    let requestInFlight = false
    const checkRuntime = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const health = await getRuntimeHealth()
        if (active && health.status === 'ok') {
          setRuntimeDetected(true)
          setError('')
        }
      } catch (reason) {
        if (active && reason instanceof LocalRuntimeError && reason.code === 'local_access_blocked') {
          setError('브라우저에서 이 사이트의 로컬 네트워크 권한을 허용해 주세요.')
        }
      } finally {
        requestInFlight = false
      }
    }
    const timer = window.setInterval(() => void checkRuntime(), 1500)
    return () => { active = false; window.clearInterval(timer) }
  }, [runtimeDetected, stage])

  function findRuntime() {
    setStage('detect')
    setRuntimeDetected(false)
    setError('')
    // Start the first localhost request directly from the user's click so browsers
    // can associate their local-network permission prompt with a user gesture.
    void getRuntimeHealth().then((health) => {
      if (health.status === 'ok') setRuntimeDetected(true)
    }).catch((reason: unknown) => {
      if (reason instanceof LocalRuntimeError && reason.code === 'local_access_blocked') {
        setError('브라우저에서 이 사이트의 로컬 네트워크 권한을 허용해 주세요.')
      }
    })
  }

  if (stage === 'start') {
    return (
      <section className="setup-current setup-current--action" aria-label="PC 앱 설치">
          <Button variant="primary" size="lg" onClick={() => setStage('install')}>설치하기</Button>
      </section>
    )
  }

  async function connectDetectedRuntime() {
    setChecking(true)
    setError('')
    try {
      await onPair()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PC 앱에 연결하지 못했습니다. 설치 상태를 확인해 주세요.')
    } finally {
      setChecking(false)
    }
  }

  if (stage === 'install') {
    return <WizardForm
      className="setup-wizard"
      title="내 PC 앱 설치"
      completeLabel="설치했어요, PC 앱 찾기"
      onComplete={findRuntime}
      onCancel={() => setStage('start')}
      steps={[
        {
          label: '앱 설치',
          content: <div className="setup-wizard-step">
            <Typography variant="h3">Windows 설치 프로그램을 실행해요</Typography>
            <Typography variant="body-sm">설치 파일을 내려받아 열고 안내에 따라 설치를 마쳐 주세요. 설치가 끝나면 PC 앱이 자동으로 실행됩니다.</Typography>
            <div className="setup-downloads">
              <a href="/install/windows/VoiceStudioSetup.exe" download>Windows 설치 프로그램 다운로드</a>
              <a href="/install/windows-wsl.md" target="_blank" rel="noreferrer">Windows 설치 안내</a>
            </div>
            <p className="setup-origin-note">브라우저 보안상 내려받은 설치 파일은 직접 열어야 합니다.</p>
          </div>,
        },
      ]}
    />
  }

  if (stage === 'detect') {
    return (
      <section className="setup-current" aria-labelledby="runtime-setup-title">
        <Card className="setup-current__card">
          <span className="section-kicker">1단계 · PC 앱</span>
          <h2 id="runtime-setup-title">{runtimeDetected ? 'PC 앱을 찾았어요' : 'PC 앱을 확인하고 있어요'}</h2>
          <p role="status">{runtimeDetected ? '이 PC의 로컬 백엔드가 실행 중입니다.' : '설치가 끝나면 자동으로 연결할 수 있습니다. 설치 프로그램이 완료될 때까지 기다려 주세요.'}</p>
          {error && <p role="alert" className="recorder-error">{error}</p>}
          {runtimeDetected ? (
            <Button variant="primary" size="lg" onClick={() => void connectDetectedRuntime()} disabled={checking}>
              {checking ? '연결 중…' : '이 PC에 연결'}
            </Button>
          ) : <Button variant="secondary" onClick={findRuntime}>다시 확인</Button>}
        </Card>
      </section>
    )
  }

  return (
    <section className="setup-current" aria-labelledby="runtime-setup-title">
      <Card className="setup-current__card">
        <Typography variant="h3" id="runtime-setup-title">PC 앱을 설치해요</Typography>
        <Typography variant="body-sm">첫 설정이 끝나면 이 PC에서 녹음과 음성 생성을 할 수 있습니다.</Typography>
        <div className="setup-current__actions"><Button variant="primary" size="lg" onClick={() => setStage('install')}>설치하기</Button></div>
      </Card>
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
        if (next.status === 'failed') setError('모델 설치에 실패했습니다. PC를 확인한 뒤 다시 시도해 주세요.')
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
