import type { ReactNode } from 'react'
import { StatusBadge } from '@windsoft/ui'
import type { ConnectionState } from './ConnectionStatus'

export type AppRoute = 'record' | 'storybook' | 'voices' | 'generate' | 'results' | 'settings'

interface AppShellProps {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onReconnect?: () => void
  connectionState: ConnectionState
  children: ReactNode
}

const primaryLinks: { route: AppRoute; label: string; icon: string }[] = [
  { route: 'record', label: '녹음 스튜디오', icon: '◉' },
  { route: 'storybook', label: '동화책', icon: '▧' },
  { route: 'voices', label: '저장한 녹음', icon: '◌' },
  { route: 'generate', label: '음성 생성', icon: '◖' },
  { route: 'results', label: '생성 결과', icon: '▤' },
]

export function AppShell({ activeRoute, onNavigate, onReconnect, connectionState, children }: AppShellProps) {
  return (
    <div className={`app-shell app-shell--${activeRoute}`}>
      <aside className="sidebar">
        <a className="brand-lockup" href="#record" onClick={(event) => { event.preventDefault(); onNavigate('record') }}>
          <span className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M6 18v-4m5 9V9m5 15V7m5 17v-9m5 5v-4" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
            </svg>
          </span>
          <span className="brand-copy">
            <strong>보이스 스튜디오</strong>
            <small>LOCAL VOICE WORKSPACE</small>
          </span>
        </a>

        <div className="sidebar-section-label">작업 공간</div>
        <nav className="primary-nav" aria-label="주요 메뉴">
          {primaryLinks.map((item) => (
            <a
              key={item.route}
              href={`#${item.route}`}
              className={`nav-link${activeRoute === item.route ? ' nav-link--active' : ''}`}
              aria-label={item.label}
              title={item.label}
              aria-current={activeRoute === item.route ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault()
                onNavigate(item.route)
              }}
            >
              <span className="nav-link__icon" aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
              {item.route === 'record' && <span className="nav-link__dot" aria-hidden="true" />}
            </a>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-section-label sidebar-section-label--bottom">환경</div>
        <a
          href="#settings"
          className={`nav-link${activeRoute === 'settings' ? ' nav-link--active' : ''}`}
          aria-current={activeRoute === 'settings' ? 'page' : undefined}
          onClick={(event) => {
            event.preventDefault()
            onNavigate('settings')
          }}
        >
          <span className="nav-link__icon" aria-hidden="true">⚙</span>
          <span>설정 및 설치</span>
        </a>

        <div className="privacy-card">
          <span className="privacy-card__icon" aria-hidden="true">⌑</span>
          <div>
            <strong>내 PC 안에서 안전하게</strong>
            <p>녹음과 생성 음성은 외부로 전송하지 않습니다.</p>
          </div>
        </div>
        <div className="sidebar-footer">VOICE STUDIO <span>v0.1</span></div>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <div className="topbar__context">
            <span className="topbar__eyebrow">개인 음성 작업공간</span>
            <span className="topbar__divider" aria-hidden="true">/</span>
            <span className="topbar__current">{primaryLinks.find((item) => item.route === activeRoute)?.label ?? '설정 및 설치'}</span>
          </div>
          <div className="topbar__actions">
            <StatusBadge status={connectionState === 'connected' ? 'success' : 'inactive'} label={connectionState === 'connected' ? '로컬 연결됨' : '로컬 연결 전'} />
            {connectionState === 'connected' && onReconnect && <button className="help-button reconnect-button" type="button" aria-label="로컬 앱 다시 연결" title="로컬 앱 다시 연결" onClick={onReconnect}>↻</button>}
            <button className="help-button mobile-settings-button" type="button" aria-label="설정" title="설정" onClick={() => onNavigate('settings')}>
              <span aria-hidden="true">⚙</span>
            </button>
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
