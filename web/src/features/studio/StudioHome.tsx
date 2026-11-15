import type { LocalOutput, LocalRecording } from '../../api/localRuntime'
import { getOutputTitle, getVoiceName } from './localMetadata'
import { storybooks, type Storybook } from '../storybook/storybookData'

interface StudioHomeProps {
  recordings: LocalRecording[]
  outputs: LocalOutput[]
  isChildMode?: boolean
  onChangeMode?: (isChildMode: boolean) => void
  onRegisterVoice: () => void
  onManageVoices: () => void
  onOpenStory: (story: Storybook) => void
  onGenerateStory: (story: Storybook) => void
  onOpenOutput: (output: LocalOutput) => void
  onComposeText: () => void
}

export function StudioHome({ recordings, outputs, onRegisterVoice, onManageVoices, onOpenOutput, onComposeText, onOpenStory }: StudioHomeProps) {
  return <div className="studio-dashboard">
    <div className="studio-dashboard__heading"><div><span className="studio-dashboard__eyebrow">VOICE STUDIO</span><h1>스튜디오</h1></div></div>
    <div className="studio-dashboard__actions">
      <button className="studio-action studio-action--record" type="button" onClick={onRegisterVoice}><span className="studio-action__icon" aria-hidden="true">●</span><span><small>RECORD</small><strong>목소리 녹음</strong></span><span className="studio-action__arrow" aria-hidden="true">↗</span></button>
      <button className="studio-action studio-action--generate" type="button" onClick={onComposeText}><span className="studio-action__icon" aria-hidden="true">✦</span><span><small>CREATE</small><strong>음성 만들기</strong></span><span className="studio-action__arrow" aria-hidden="true">↗</span></button>
    </div>
    <div className="studio-dashboard__grid">
      <section className="studio-panel"><header><h2>내 목소리 <span>{recordings.length}</span></h2><button type="button" onClick={onManageVoices}>전체 보기 →</button></header>
        {recordings.length ? <ul className="studio-panel__list">{recordings.slice(0, 4).map((recording, index) => <li key={recording.id}><span className="studio-panel__symbol">◉</span><span><strong>{recording.name || getVoiceName(recording.id, `목소리 ${index + 1}`)}</strong><small>{Math.round(recording.duration_seconds)}초</small></span></li>)}</ul> : <button className="studio-panel__empty" type="button" onClick={onRegisterVoice}>+ 목소리 등록</button>}
      </section>
      <section className="studio-panel"><header><h2>최근 만든 음성 <span>{outputs.length}</span></h2></header>
        {outputs.length ? <ul className="studio-panel__list">{outputs.slice(0, 4).map((output) => <li key={output.id}><button type="button" onClick={() => onOpenOutput(output)}><span className="studio-panel__symbol">▶</span><span><strong>{getOutputTitle(output.id) ?? '만든 음성'}</strong><small>{output.text}</small></span><span aria-hidden="true">→</span></button></li>)}</ul> : <div className="studio-panel__empty">생성된 음성 없음</div>}
      </section>
    </div>
    <button className="studio-dashboard__examples" type="button" onClick={() => onOpenStory(storybooks[0])}>예시 동화 보기 →</button>
  </div>
}
