import type { ReactNode } from 'react'
import type { ConnectionState } from './ConnectionStatus'

export type AppRoute = 'studio' | 'record' | 'storybook' | 'voices' | 'generate' | 'results' | 'settings'

interface AppShellProps {
  activeRoute: AppRoute
  onNavigate: (route: AppRoute) => void
  onReconnect?: () => void
  connectionState: ConnectionState
  isChildMode?: boolean
  children: ReactNode
}

export function AppShell({ activeRoute, onNavigate, onReconnect, connectionState, isChildMode = false, children }: AppShellProps) {
  return (
    <div className={`app-shell app-shell--${activeRoute}`}>
      <div className="app-main">
        <header className="topbar studio-topbar">
          <button className="studio-brand" type="button" onClick={() => onNavigate('studio')} aria-label="스튜디오 홈">
            <span className="brand-mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" fill="none"><path d="M6 13v6m5-12v18m5-21v24m5-18v12m5-9v6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
            </span>
            <strong>VOICE STUDIO</strong>
          </button>
          <nav className="studio-nav" aria-label="주 메뉴">
            {([['studio', '스튜디오'], ['record', '녹음'], ['generate', '음성 만들기'], ['voices', '내 목소리'], ['results', '만든 음성']] as const).map(([route, label]) => <button key={route} type="button" className={activeRoute === route ? 'studio-nav__item studio-nav__item--active' : 'studio-nav__item'} aria-current={activeRoute === route ? 'page' : undefined} onClick={() => onNavigate(route)}>{label}</button>)}
          </nav><div className="topbar__actions">

            {!isChildMode && <><span className="visually-hidden" role="status" aria-live="polite">{connectionState === 'connected' ? '로컬 앱 연결됨' : connectionState === 'checking' ? '로컬 앱 연결 확인 중' : '로컬 앱 연결 끊김'}</span>
            {connectionState !== 'connected' && <button
              className={`connection-state connection-state--${connectionState}`}
              type="button"
              aria-label="로컬 앱 다시 연결"
              title={connectionState === 'checking' ? '로컬 앱 연결 확인 중' : '로컬 앱 연결 끊김 · 클릭하여 다시 연결'}
              onClick={onReconnect}
              disabled={connectionState === 'checking' || !onReconnect}
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M8 7v4m8-4v4M6 11h12v2a6 6 0 0 1-12 0v-2Zm6 8v2m-3 0h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />{connectionState !== 'checking' && <path d="m5 5 14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}</svg>
            </button>}
            <button className="help-button settings-button" type="button" aria-label="설정" title="설정" onClick={() => onNavigate('settings')}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm0-5v2m0 13v2m9-8h-2m-14 0H3m15.36-6.36-1.42 1.42M7.06 16.94l-1.42 1.42m12.72 0-1.42-1.42M7.06 7.06 5.64 5.64" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" /></svg>
            </button>
            </>}
          </div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  )
}
