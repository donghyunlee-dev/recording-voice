import { Button, Card, ProductGrid, Typography } from '@windsoft/ui'
import { useState } from 'react'
import { storybooks, storyScript, type Storybook } from './storybookData'

interface StorybookPageProps {
  onGenerateSpeech: (text: string) => void
}

export function StorybookPage({ onGenerateSpeech }: StorybookPageProps) {
  const [activeStory, setActiveStory] = useState<Storybook | null>(null)
  const [activeScene, setActiveScene] = useState(0)

  if (!activeStory) {
    return <div className="page-stack storybook-page">
      <div className="page-heading">
        <Typography variant="h1">동화책 미리보기</Typography>
      </div>
      <ProductGrid className="storybook-catalog" items={storybooks} renderCard={(story) => <StorybookCard key={story.id} story={story} onSelect={() => { setActiveStory(story); setActiveScene(0) }} />} />
    </div>
  }

  const scene = activeStory.scenes[activeScene]

  return <div className="page-stack storybook-page">
    <div className="storybook-toolbar">
      <Button variant="secondary" onClick={() => setActiveStory(null)}>← 동화 목록</Button>
      <span>{activeStory.title}</span>
    </div>
    <Card className="storybook-viewer-card">
      <figure className="storybook-viewer">
        <div className="storybook-viewer__art">
          <img src={scene.image} alt={`${activeStory.title} · 장면 ${activeScene + 1}: ${scene.imageAlt}`} />
          <Button className="storybook-viewer__nav storybook-viewer__nav--previous" variant="secondary" aria-label="이전 장면" onClick={() => setActiveScene((current) => Math.max(0, current - 1))} disabled={activeScene === 0}>‹</Button>
          <Button className="storybook-viewer__nav storybook-viewer__nav--next" variant="secondary" aria-label="다음 장면" onClick={() => setActiveScene((current) => Math.min(activeStory.scenes.length - 1, current + 1))} disabled={activeScene === activeStory.scenes.length - 1}>›</Button>
        </div>
        <figcaption className="storybook-subtitle">
          {scene.narration.map((line) => <p key={line}>{line}</p>)}
        </figcaption>
      </figure>
      <div className="storybook-footer">
        <div className="storybook-progress" role="progressbar" aria-label="장면 진행" aria-valuemin={1} aria-valuemax={activeStory.scenes.length} aria-valuenow={activeScene + 1}>
          <span style={{ width: `${((activeScene + 1) / activeStory.scenes.length) * 100}%` }} />
        </div>
        <details className="storybook-source">
          <summary aria-label="그림 출처">ⓘ</summary>
          <a href={scene.imageSource} target="_blank" rel="noreferrer">Wikimedia Commons</a>
        </details>
        <Button variant="primary" size="lg" onClick={() => onGenerateSpeech(storyScript(activeStory))}>이 이야기로 음성 만들기</Button>
      </div>
    </Card>
  </div>
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
