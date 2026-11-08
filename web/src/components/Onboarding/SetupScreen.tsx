import { Button, Card, Typography, WizardForm } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { getRuntimeHealth } from '../../api/localRuntime'

interface SetupScreenProps {
  onPair: (code?: string) => Promise<void>
}

export function SetupScreen({ onPair }: SetupScreenProps) {
  const [stage, setStage] = useState<SetupStage>('checking')

  return (
    <main className="setup-screen">
      <header className="setup-screen__brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 18v-4m5 9V9m5 15V7m5 17v-9m5 5v-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <div><strong>보이스 스튜디오</strong></div>
      </header>

      <div className="setup-screen__content">
        {stage !== 'install' && <div className="setup-screen__intro">
          <Typography variant="h1">{stageHeading[stage]}</Typography>
        </div>}

        <RuntimeSetupStep onPair={onPair} onStageChange={setStage} />
      </div>
    </main>
  )
}

type SetupStage = 'checking' | 'unavailable' | 'install' | 'detect' | 'ready' | 'pairing'

const stageHeading: Record<Exclude<SetupStage, 'install'>, string> = {
  checking: 'PC 앱을 확인하고 있어요',
  unavailable: 'PC 앱을 찾지 못했어요',
  detect: 'PC 앱을 확인하고 있어요',
  ready: 'PC 앱을 찾았어요',
  pairing: 'PC 앱을 연결하고 있어요',
}

interface RuntimeSetupStepProps extends SetupScreenProps {
  onStageChange: (stage: SetupStage) => void
}

function RuntimeSetupStep({ onPair, onStageChange }: RuntimeSetupStepProps) {
  const [stage, setStage] = useState<SetupStage>('checking')
  const [error, setError] = useState('')

  useEffect(() => onStageChange(stage), [onStageChange, stage])

  useEffect(() => {
    let active = true
    void getRuntimeHealth().then((health) => {
      if (active && health.status === 'ok') {
        setError('')
        void connectDetectedRuntime()
      }
    }).catch((reason: unknown) => {
      if (active) {
        setError(reason instanceof Error ? reason.message : 'PC 앱에 연결할 수 없습니다.')
        setStage('unavailable')
      }
    })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (stage !== 'detect') return
    let active = true
    let requestInFlight = false
    const checkRuntime = async () => {
      if (requestInFlight) return
      requestInFlight = true
      try {
        const health = await getRuntimeHealth()
        if (active && health.status === 'ok') {
          setError('')
          await connectDetectedRuntime()
        }
      } catch (reason) {
        if (active && reason instanceof Error) setError(reason.message)
      } finally {
        requestInFlight = false
      }
    }
    void checkRuntime()
    const timer = window.setInterval(() => void checkRuntime(), 1500)
    return () => { active = false; window.clearInterval(timer) }
  }, [stage])

  async function findRuntime() {
    setStage('checking')
    setError('')
    // Retry directly from the click so browsers can associate a local-network
    // permission prompt with a user gesture.
    try {
      const health = await getRuntimeHealth()
      if (health.status === 'ok') {
        await connectDetectedRuntime()
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PC 앱에 연결할 수 없습니다.')
      setStage('unavailable')
    }
  }

  async function findRuntimeAfterInstall() {
    setStage('detect')
    setError('')
  }

  if (stage === 'checking') {
    return (
      <section className="setup-current" aria-label="PC 앱 확인 중">
        <Card className="setup-current__card setup-current__card--center" role="status" aria-busy="true">
          <span className="setup-state-indicator setup-state-indicator--pending" aria-hidden="true"><span /></span>
          <progress aria-label="PC 앱 확인 중" />
        </Card>
      </section>
    )
  }

  async function connectDetectedRuntime() {
    setError('')
    setStage('pairing')
    try {
      await onPair()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PC 앱에 연결하지 못했습니다. 설치 상태를 확인해 주세요.')
      setStage('ready')
    }
  }

  if (stage === 'install') {
    return <WizardForm
      className="setup-wizard"
      title="내 PC 앱 설치"
      completeLabel="설치했어요, PC 앱 찾기"
      onComplete={() => { void findRuntimeAfterInstall() }}
      onCancel={() => setStage('unavailable')}
      steps={[
        {
          label: '앱 설치',
          content: <div className="setup-wizard-step">
            <span className="setup-state-indicator" aria-label="Windows 앱 설치" role="img">↓</span>
            <div className="setup-downloads">
              <a href="/install/windows/VoiceStudioSetup.exe" download>Windows 설치 프로그램 다운로드</a>
              <a href="/install/windows-wsl.md" target="_blank" rel="noreferrer">Windows 설치 안내</a>
            </div>
          </div>,
        },
      ]}
    />
  }

  if (stage === 'detect') {
    return (
      <section className="setup-current" aria-label="PC 앱 확인 중">
        <Card className="setup-current__card">
          <span className="setup-state-indicator setup-state-indicator--pending" aria-hidden="true"><span /></span>
          <progress aria-label="PC 앱 확인 중" />
          {error && <p role="alert" className="recorder-error">{error}</p>}
          <Button variant="secondary" onClick={() => void findRuntime()}>다시 확인</Button>
        </Card>
      </section>
    )
  }

  if (stage === 'pairing') {
    return (
      <section className="setup-current" aria-label="PC 앱 연결 중">
        <Card className="setup-current__card setup-current__card--center" role="status" aria-busy="true">
          <span className="setup-state-indicator setup-state-indicator--pending" aria-hidden="true"><span /></span>
          <progress aria-label="PC 앱 연결 중" />
        </Card>
      </section>
    )
  }

  if (stage === 'ready') {
    return (
      <section className="setup-current" aria-label="PC 앱 연결">
        <Card className="setup-current__card">
          <span className="setup-state-indicator setup-state-indicator--ready" aria-label="PC 앱 실행 중" role="img">✓</span>
          {error && <p role="alert" className="recorder-error">{error}</p>}
          <Button variant="primary" size="lg" onClick={() => void connectDetectedRuntime()}>이 PC에 연결</Button>
        </Card>
      </section>
    )
  }

  return (
    <section className="setup-current" aria-label="PC 앱 연결">
      <Card className="setup-current__card">
        <span className="setup-state-indicator setup-state-indicator--unavailable" aria-label="PC 앱을 찾지 못함" role="img">!</span>
        {error && <p role="alert" className="recorder-error">{error}</p>}
        <div className="setup-current__actions">
          <Button variant="primary" size="lg" onClick={() => void findRuntime()}>연결 다시 확인</Button>
          <Button variant="secondary" onClick={() => setStage('install')}>설치 안내</Button>
        </div>
      </Card>
    </section>
  )
}
