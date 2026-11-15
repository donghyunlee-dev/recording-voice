import { describe, expect, it } from 'vitest'
import { measureInput } from './inputSignal'

describe('microphone signal measurements', () => {
  it('reports digital silence without claiming recording quality', () => {
    expect(measureInput(new Uint8Array(512).fill(128))).toEqual({ level: 0, db: null, status: '입력 없음' })
  })
  it('distinguishes quiet input, normal input and near-clipping peaks', () => {
    expect(measureInput(new Uint8Array([129, 127, 129, 127])).status).toBe('입력 작음')
    const signal = measureInput(new Uint8Array([144, 112, 144, 112]))
    expect(signal.status).toBe('입력 감지')
    expect(signal.db).toBeCloseTo(-18, 0)
    expect(measureInput(new Uint8Array([255, 128, 128, 128])).status).toBe('입력 과다')
  })
})
