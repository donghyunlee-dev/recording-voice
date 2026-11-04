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
        <Typography variant="caption" className="section-kicker">그림과 함께 듣는 동화</Typography>
        <Typography variant="h1">동화책 미리보기</Typography>
        <Typography variant="body-sm">이야기를 고르고 장면을 넘겨보세요. 준비된 대본을 저장한 목소리로 읽을 수 있습니다.</Typography>
      </div>
      <ProductGrid className="storybook-catalog" items={storybooks} renderCard={(story) => <button className="storybook-card" type="button" key={story.id} onClick={() => { setActiveStory(story); setActiveScene(0) }}>
          <img src={story.scenes[0].image} alt={`${story.title} 삽화 미리보기`} />
          <span className="storybook-card__body"><strong>{story.title}</strong><span>{story.summary}</span><small>그림 3장 · 짧은 줄거리</small></span>
          <span className="storybook-card__arrow" aria-hidden="true">→</span>
        </button>} />
    </div>
  }

  const scene = activeStory.scenes[activeScene]

  return <div className="page-stack storybook-page">
    <div className="storybook-toolbar">
      <Button variant="secondary" onClick={() => setActiveStory(null)}>← 동화 목록</Button>
      <span>{activeStory.title} <small>{activeScene + 1} / {activeStory.scenes.length} 장면</small></span>
    </div>
    <Card className="storybook-viewer-card">
      <figure className="storybook-viewer">
        <img src={scene.image} alt={`${activeStory.title} · 장면 ${activeScene + 1}: ${scene.imageAlt}`} />
        <figcaption className="storybook-subtitle">
          {scene.narration.map((line) => <p key={line}>{line}</p>)}
        </figcaption>
      </figure>
      <div className="storybook-controls">
        <Button variant="secondary" onClick={() => setActiveScene((current) => Math.max(0, current - 1))} disabled={activeScene === 0}>이전 장면</Button>
        <div className="storybook-scene-dots" aria-label="장면 선택">
          {activeStory.scenes.map((item, index) => <button key={item.title} type="button" className={index === activeScene ? 'storybook-scene-dot storybook-scene-dot--active' : 'storybook-scene-dot'} aria-label={`${index + 1}장면 ${item.title}`} aria-current={index === activeScene ? 'step' : undefined} onClick={() => setActiveScene(index)} />)}
        </div>
        <Button variant="secondary" onClick={() => setActiveScene((current) => Math.min(activeStory.scenes.length - 1, current + 1))} disabled={activeScene === activeStory.scenes.length - 1}>다음 장면</Button>
      </div>
    </Card>
    <div className="storybook-footer">
      <a href={scene.imageSource} target="_blank" rel="noreferrer">그림 출처: Wikimedia Commons · 공개 도메인 삽화</a>
      <Button variant="primary" size="lg" onClick={() => onGenerateSpeech(storyScript(activeStory))}>이 이야기로 음성 만들기</Button>
    </div>
  </div>
}
