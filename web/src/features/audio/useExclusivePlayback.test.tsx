import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useExclusivePlayback } from './useExclusivePlayback'

function Players() {
  useExclusivePlayback()
  return <><audio aria-label="원본" /><audio aria-label="결과 A" /><audio aria-label="결과 B" /></>
}

describe('exclusive studio playback', () => {
  it('pauses the previous player when another result starts, leaving idle players alone', () => {
    render(<Players />)
    const original = screen.getByLabelText('원본') as HTMLAudioElement
    const result = screen.getByLabelText('결과 A') as HTMLAudioElement
    const idle = screen.getByLabelText('결과 B') as HTMLAudioElement
    Object.defineProperty(original, 'paused', { configurable: true, value: false })
    Object.defineProperty(result, 'paused', { configurable: true, value: false })
    const pauseOriginal = vi.spyOn(original, 'pause').mockImplementation(() => undefined)
    const pauseResult = vi.spyOn(result, 'pause').mockImplementation(() => undefined)
    const pauseIdle = vi.spyOn(idle, 'pause').mockImplementation(() => undefined)
    fireEvent.play(result)
    expect(pauseOriginal).toHaveBeenCalledOnce()
    expect(pauseResult).not.toHaveBeenCalled()
    expect(pauseIdle).not.toHaveBeenCalled()
  })
})
