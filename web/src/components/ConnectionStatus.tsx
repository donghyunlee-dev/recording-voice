import { StatusBadge } from '@windsoft/ui'
import { useState, type FormEvent } from 'react'

export type ConnectionState = 'disconnected' | 'checking' | 'connected' | 'permission-denied' | 'error'

const connectionCopy: Record<
  ConnectionState,
  { badge: string; tone: 'inactive' | 'pending' | 'success' | 'warning' | 'error'; title: string; detail: string }
> = {
  disconnected: {
    badge: '연결 전', tone: 'inactive', title: '로컬 런타임 연결 대기',
    detail: 'PC에서 로컬 앱을 실행한 뒤 터미널에 표시된 페어링 코드로 연결하세요.',
  },
  checking: {
    badge: '확인 중', tone: 'pending', title: 'PC 연결을 확인하고 있습니다',
    detail: '로컬 앱과 보안 연결을 확인하고 있습니다.',
  },
  connected: {
    badge: '연결됨', tone: 'success', title: '내 PC와 안전하게 연결되었습니다',
    detail: '녹음과 음성 생성은 이 PC에서 처리됩니다.',
  },
  'permission-denied': {
    badge: '권한 필요', tone: 'warning', title: '브라우저 권한이 필요합니다',
    detail: '주소 표시줄에서 로컬 네트워크/Loopback 권한을 허용한 뒤 다시 연결하세요.',
  },
  error: {
    badge: '연결 오류', tone: 'error', title: '로컬 앱에 연결할 수 없습니다',
    detail: 'PC에서 로컬 앱이 실행 중인지 확인한 뒤 다시 시도하세요.',
  },
}

interface ConnectionStatusProps {
  state: ConnectionState
  onPair?: (code: string) => Promise<void>
  onReconnect?: () => void
  pairingOpenByDefault?: boolean
}

export function ConnectionStatus({ state, onPair, onReconnect, pairingOpenByDefault = false }: ConnectionStatusProps) {
  const [showPairing, setShowPairing] = useState(pairingOpenByDefault)
  const [code, setCode] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const copy = connectionCopy[state]

  async function submitPairing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!onPair || !code.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await onPair(code.trim())
      setShowPairing(false)
      setCode('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '연결할 수 없습니다. 로컬 앱 상태를 확인해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={`connection-banner connection-banner--${state}`} role="status" aria-live="polite">
      <StatusBadge status={copy.tone} label={copy.badge} />
      <div className="connection-banner__copy">
        <strong>{copy.title}</strong>
        <p>{copy.detail}</p>
      </div>
      {state === 'connected' && onReconnect && <button className="pairing-cancel" type="button" onClick={() => { setShowPairing(true); onReconnect() }}>다시 연결하기</button>}
      {state !== 'connected' && onPair && !showPairing && (
        <button className="connection-action" type="button" onClick={() => setShowPairing(true)}>로컬 앱 연결</button>
      )}
      {state !== 'connected' && showPairing && (
        <form className="pairing-form" onSubmit={submitPairing}>
          <label htmlFor="pairing-code">터미널 페어링 코드</label>
          <input
            id="pairing-code"
            autoComplete="off"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="로컬 앱 터미널에 표시된 코드"
            required
          />
          <button className="connection-action" type="submit" disabled={submitting || !code.trim()}>
            {submitting ? '연결 중…' : '코드 확인 후 연결'}
          </button>
          <button className="pairing-cancel" type="button" onClick={() => { setShowPairing(false); setError('') }}>취소</button>
          {error && <span className="pairing-error" role="alert">{error}</span>}
        </form>
      )}
    </div>
  )
}
