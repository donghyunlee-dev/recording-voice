import { Button, Card, Typography, WizardForm } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { getRuntimeHealth } from '../../api/localRuntime'

interface SetupScreenProps {
  onPair: (code?: string) => Promise<void>
}

export function SetupScreen({ onPair }: SetupScreenProps) {
  return (
    <main className="setup-screen">
      <header className="setup-screen__brand">
        <span className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M6 18v-4m5 9V9m5 15V7m5 17v-9m5 5v-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </span>
        <div><strong>보이스 스튜디오</strong><span>PC 앱 연결</span></div>
      </header>

      <div className="setup-screen__content">
        <div className="setup-screen__intro">
          <Typography variant="caption" className="section-kicker">로컬 앱</Typography>
          <Typography variant="h1">PC 앱에 연결해요</Typography>
          <Typography variant="body-sm">실행 중인 PC 앱을 먼저 확인합니다.</Typography>
        </div>

        <RuntimeSetupStep onPair={onPair} />

        <p className="setup-screen__privacy">녹음, 대본, 생성 결과는 내 PC에 저장됩니다.</p>
      </div>
    </main>
  )
}

function RuntimeSetupStep({ onPair }: SetupScreenProps) {
  const [stage, setStage] = useState<'checking' | 'unavailable' | 'install' | 'detect' | 'ready'>('checking')
  const [checking, setChecking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    void getRuntimeHealth().then((health) => {
      if (active && health.status === 'ok') {
        setStage('ready')
        setError('')
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
          setStage('ready')
          setError('')
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
      if (health.status === 'ok') setStage('ready')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'PC 앱에 연결할 수 없습니다.')
      setStage('unavailable')
    }
  }

  async function findRuntimeAfterInstall() {
    setStage('detect')
    setError('')
    try {
      const health = await getRuntimeHealth()
      if (health.status === 'ok') setStage('ready')
    } catch (reason) {
      if (reason instanceof Error) setError(reason.message)
    }
  }

  if (stage === 'checking') {
    return (
      <section className="setup-current" aria-label="PC 앱 확인 중">
        <Card className="setup-current__card" role="status">
          <h2>실행 중인 PC 앱을 찾고 있어요</h2>
          <progress aria-label="PC 앱 확인 중" />
        </Card>
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
      onComplete={() => { void findRuntimeAfterInstall() }}
      onCancel={() => setStage('unavailable')}
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
          <h2 id="runtime-setup-title">PC 앱을 확인하고 있어요</h2>
          <p role="status">설치 프로그램이 끝나면 연결할 수 있습니다.</p>
          <progress aria-label="PC 앱 확인 중" />
          {error && <p role="alert" className="recorder-error">{error}</p>}
          <Button variant="secondary" onClick={() => void findRuntime()}>다시 확인</Button>
        </Card>
      </section>
    )
  }

  if (stage === 'ready') {
    return (
      <section className="setup-current" aria-labelledby="runtime-setup-title">
        <Card className="setup-current__card">
          <h2 id="runtime-setup-title">PC 앱을 찾았어요</h2>
          <p role="status">이 PC의 로컬 앱이 실행 중입니다.</p>
          {error && <p role="alert" className="recorder-error">{error}</p>}
          <Button variant="primary" size="lg" onClick={() => void connectDetectedRuntime()} disabled={checking}>
            {checking ? '연결 중…' : '이 PC에 연결'}
          </Button>
        </Card>
      </section>
    )
  }

  return (
    <section className="setup-current" aria-labelledby="runtime-setup-title">
      <Card className="setup-current__card">
        <h2 id="runtime-setup-title">PC 앱을 찾지 못했어요</h2>
        <p role="status">연결을 다시 확인하거나 설치 안내를 열어 주세요.</p>
        {error && <p role="alert" className="recorder-error">{error}</p>}
        <div className="setup-current__actions">
          <Button variant="primary" size="lg" onClick={() => void findRuntime()}>연결 다시 확인</Button>
          <Button variant="secondary" onClick={() => setStage('install')}>설치 안내</Button>
        </div>
      </Card>
    </section>
  )
}
