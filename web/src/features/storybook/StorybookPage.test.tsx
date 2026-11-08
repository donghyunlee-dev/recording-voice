import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorybookPage } from './StorybookPage'
import { storybooks, storyScript } from './storybookData'

describe('StorybookPage', () => {
  it('renders story choices as picture-book covers without summary copy', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)

    expect(screen.getByRole('img', { name: '엄마와 아이가 함께 읽는 동화책' })).toBeVisible()
    for (const story of storybooks) {
      expect(screen.getByRole('button', { name: `${story.title} 선택` })).toBeVisible()
      expect(screen.queryByText(story.summary)).not.toBeInTheDocument()
    }
  })

  it('preloads three short stories with three illustrated scenes each', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '동화책 미리보기' })).toBeVisible()
    expect(screen.getByRole('button', { name: '백설공주 선택' })).toBeVisible()
    expect(screen.getByRole('button', { name: '아기 돼지 삼형제 선택' })).toBeVisible()
    expect(screen.getByRole('button', { name: '빨간 모자 선택' })).toBeVisible()
    expect(screen.queryByText('그림과 함께 듣는 동화')).not.toBeInTheDocument()
    expect(screen.queryByText(/이야기를 고르고 장면을 넘겨보세요/)).not.toBeInTheDocument()
    expect(screen.queryByText(/그림 3장/)).not.toBeInTheDocument()
    expect(screen.queryByText(storybooks[0].summary)).not.toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: /삽화 미리보기$/ })).toHaveLength(3)
    expect(screen.getAllByRole('button', { name: /선택$/ })).toHaveLength(3)
    for (const story of storybooks) {
      expect(story.scenes).toHaveLength(3)
      for (const scene of story.scenes) {
        expect(scene.image).toMatch(/-kawaii\.webp$/)
        expect(scene.imageAlt).not.toMatch(/옛 삽화/)
      }
      expect(storyScript(story).split('\n').filter(Boolean).length).toBeLessThan(20)
    }
  })

  it('shows a visual loading and error state for story illustrations', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)

    const image = screen.getByRole('img', { name: '백설공주 삽화 미리보기' })
    const card = screen.getByRole('button', { name: '백설공주 선택' })
    expect(card).toHaveAttribute('aria-busy', 'true')

    fireEvent.load(image)
    expect(card).not.toHaveAttribute('aria-busy', 'true')

    fireEvent.error(image)
    expect(screen.getByText('백설공주')).toBeVisible()
    expect(card).toHaveClass('storybook-card--error')
  })

  it('changes the illustration and sends the selected story text to voice generation', () => {
    const onGenerateSpeech = vi.fn()
    render(<StorybookPage onGenerateSpeech={onGenerateSpeech} />)

    fireEvent.click(screen.getByRole('button', { name: '빨간 모자 선택' }))
    expect(screen.getByRole('img', { name: /빨간 모자 · 장면 1/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    expect(screen.getByRole('img', { name: /빨간 모자 · 장면 2/ })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '이 이야기로 음성 만들기' }))
    expect(onGenerateSpeech).toHaveBeenCalledTimes(1)
    const script = onGenerateSpeech.mock.calls[0][0]
    expect(script.split('\n').filter(Boolean)).toHaveLength(6)
  })

  it('keeps narration below the illustration and exposes visual scene progress', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '백설공주 선택' }))

    const illustration = screen.getByRole('img', { name: /백설공주 · 장면 1/ })
    const narration = screen.getByText(/깊은 숲에서 길을 잃은 백설공주/)
    expect(illustration.compareDocumentPosition(narration) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText(/1 \/ 3 장면/)).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: '장면 진행' })).toHaveAttribute('aria-valuenow', '1')
    expect(screen.getByRole('button', { name: '이전 장면' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 장면' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '이 이야기로 음성 만들기' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Wikimedia Commons' })).not.toBeInTheDocument()
  })

  it('keeps narration and reading actions in the picture-book page hierarchy', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: '백설공주 선택' }))

    const readingPage = screen.getByRole('region', { name: '동화 본문' })
    expect(readingPage).toContainElement(screen.getByText(/깊은 숲에서 길을 잃은 백설공주/))
    expect(readingPage).toHaveClass('storybook-reading-page')
    expect(screen.getByRole('button', { name: '이전 장면' })).toBeDisabled()
    expect(screen.getByRole('button', { name: '다음 장면' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '이 이야기로 음성 만들기' })).toBeVisible()
    expect(screen.getByRole('progressbar', { name: '장면 진행' })).toBeVisible()
  })
})
