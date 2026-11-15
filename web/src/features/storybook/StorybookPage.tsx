import { Button, Card, ProductGrid, Typography } from '@windsoft/ui'
import { useEffect, useRef, useState, type TouchEvent } from 'react'
import { storybooks, storyScript, type Storybook } from './storybookData'
import { AudioOutputCard } from '../results/AudioOutputCard'
import type { LocalOutput, LocalRecording } from '../../api/localRuntime'

interface StorybookPageProps {
  onGenerateSpeech: (text: string) => void
  initialStory?: Storybook | null
  token?: string | null
  recordings?: LocalRecording[]
  outputs?: LocalOutput[]
  onOutputDeleted?: (id: string) => void
  onRegisterVoice?: () => void
  onBack?: () => void
  listenOnly?: boolean
}

export function StorybookPage({ onGenerateSpeech, initialStory = null, token, recordings = [], outputs = [], onOutputDeleted, onRegisterVoice, onBack, listenOnly = false }: StorybookPageProps) {
  const [activeStory, setActiveStory] = useState<Storybook | null>(initialStory)
  const [activeScene, setActiveScene] = useState(0)
  const touchStartX = useRef<number | null>(null)

  useEffect(() => {
    setActiveStory(initialStory)
    setActiveScene(0)
  }, [initialStory])

  if (!activeStory) {
    return <div className="page-stack storybook-page">
      <div className="page-heading">
        <div className="storybook-welcome">
          <img src="/storybook/reading-together.svg" alt="함께 읽는 동화책" />
          <Typography variant="h1">동화책</Typography>
        </div>
      </div>
      <ProductGrid className="storybook-catalog" items={storybooks} renderCard={(story) => <StorybookCard key={story.id} story={story} onSelect={() => { setActiveStory(story); setActiveScene(0) }} />} />
    </div>
  }

  const scene = activeStory.scenes[activeScene]
  const sceneCount = activeStory.scenes.length
  const script = normalizeText(storyScript(activeStory))
  const storyOutputs = outputs.filter((output) => normalizeText(output.text) === script)

  function handleSceneSwipe(event: TouchEvent<HTMLDivElement>) {
    const startX = touchStartX.current
    touchStartX.current = null
    if (startX === null) return
    const distance = event.changedTouches[0].clientX - startX
    if (Math.abs(distance) < 55) return
    setActiveScene((current) => Math.max(0, Math.min(sceneCount - 1, current + (distance < 0 ? 1 : -1))))
  }

  return <div className="page-stack storybook-page">
    <div className="storybook-toolbar">
      <Button className="storybook-toolbar__back" variant="secondary" aria-label="메인으로 돌아가기" onClick={() => onBack ? onBack() : setActiveStory(null)}>‹</Button>
      <span>{activeStory.title}</span>
    </div>
    <Card className="storybook-viewer-card">
      <div className="storybook-spread" role="group" aria-label="펼친 동화책" onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX }} onTouchEnd={handleSceneSwipe}>
        <figure className="storybook-illustration-page">
          <div className="storybook-viewer__art">
            <img src={scene.image} alt={`${activeStory.title} · 장면 ${activeScene + 1}: ${scene.imageAlt}`} />
          </div>
        </figure>
        <section className="storybook-reading-page" aria-label="동화 본문">
          <div className="storybook-reading-page__text">
            {scene.narration.map((line) => <p key={line}>{line}</p>)}
          </div>
          <div className="storybook-scene-dots" role="group" aria-label="장면 선택">
            {activeStory.scenes.map((item, index) => <button key={item.title} type="button" aria-label={`${index + 1}장`} aria-current={activeScene === index ? 'step' : undefined} onClick={() => setActiveScene(index)}><span /></button>)}
          </div>
        </section>
      </div>
      <div className="storybook-footer">
        {!listenOnly && storyOutputs.length === 0 && <Button variant="secondary" disabled aria-label="듣기">듣기</Button>}
        {!listenOnly && storyOutputs.length === 0 && (recordings.length > 0
          ? <Button variant="primary" size="lg" onClick={() => onGenerateSpeech(storyScript(activeStory))}>음성 만들기</Button>
          : <Button variant="primary" size="lg" onClick={onRegisterVoice}>목소리 등록</Button>)}
        {listenOnly && storyOutputs.length === 0 && <span className="storybook-waiting-voice">아직 목소리가 없어요</span>}
      </div>
    </Card>
    {storyOutputs.length > 0 && token && <section className="storybook-audio-list" aria-label="동화책 음성">
      {storyOutputs.map((output) => <AudioOutputCard key={output.id} token={token} output={output} onDeleted={listenOnly ? undefined : onOutputDeleted} showTranscript={false} showTechnicalDetails={false} />)}
    </section>}
  </div>
}

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function StorybookCard({ story, onSelect }: { story: Storybook; onSelect: () => void }) {
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)

  return <button className={failed ? 'storybook-card storybook-card--error' : 'storybook-card'} type="button" aria-label={`${story.title} 선택`} aria-busy={loading || undefined} onClick={onSelect}>
    <span className={`storybook-card__art${loading ? ' storybook-card__art--loading' : ''}`}>
      {failed ? <svg className="storybook-card__fallback" viewBox="0 0 120 90" aria-hidden="true">
        <path d="M14 18c15-6 29-4 46 4v52c-17-8-31-10-46-4V18Zm92 0c-15-6-29-4-46 4v52c17-8 31-10 46-4V18Z" />
        <path d="M60 22v52" />
        <path d="M24 31c9-3 17-2 25 1m-25 9c9-3 17-2 25 1m22-10c8-3 16-4 25-1m-25 10c8-3 16-4 25-1" />
      </svg> : <img src={story.scenes[0].image} alt={`${story.title} 삽화 미리보기`} onLoad={() => setLoading(false)} onError={() => { setLoading(false); setFailed(true) }} />}
      {loading && <span className="storybook-card__skeleton" aria-hidden="true" />}
    </span>
    <span className="storybook-card__body"><strong>{story.title}</strong></span>
  </button>
}
