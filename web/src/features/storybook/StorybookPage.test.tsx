import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StorybookPage } from './StorybookPage'
import { storybooks, storyScript } from './storybookData'

describe('StorybookPage', () => {
  it('preloads three short stories with three illustrated scenes each', () => {
    render(<StorybookPage onGenerateSpeech={vi.fn()} />)

    expect(screen.getByRole('heading', { name: '동화책 미리보기' })).toBeVisible()
    expect(screen.getByRole('button', { name: /백설공주/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /아기 돼지 삼형제/ })).toBeVisible()
    expect(screen.getByRole('button', { name: /빨간 모자/ })).toBeVisible()
    expect(screen.getAllByRole('img')).toHaveLength(3)
    for (const story of storybooks) {
      expect(story.scenes).toHaveLength(3)
      expect(storyScript(story).split('\n').filter(Boolean).length).toBeLessThan(20)
    }
  })

  it('changes the illustration and sends the selected story text to voice generation', () => {
    const onGenerateSpeech = vi.fn()
    render(<StorybookPage onGenerateSpeech={onGenerateSpeech} />)

    fireEvent.click(screen.getByRole('button', { name: /빨간 모자/ }))
    expect(screen.getByRole('img', { name: /빨간 모자 · 장면 1/ })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: '다음 장면' }))
    expect(screen.getByRole('img', { name: /빨간 모자 · 장면 2/ })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: '이 이야기로 음성 만들기' }))
    expect(onGenerateSpeech).toHaveBeenCalledTimes(1)
    const script = onGenerateSpeech.mock.calls[0][0]
    expect(script.split('\n').filter(Boolean)).toHaveLength(6)
  })
})
