import { afterEach, describe, expect, it, vi } from 'vitest'
import { getOutputTitle, getVoiceName, saveVoiceName } from './localMetadata'

afterEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('legacy local metadata', () => {
  it('keeps valid cached names while rejecting invalid value types', () => {
    localStorage.setItem('voice-studio.voice-names', JSON.stringify({ good: '  내레이션  ', bad: 42, empty: null, object: {} }))
    expect(getVoiceName('good', '기본 이름')).toBe('내레이션')
    for (const id of ['bad', 'empty', 'object', 'missing']) expect(getVoiceName(id, '기본 이름')).toBe('기본 이름')
    localStorage.setItem('voice-studio.output-titles', JSON.stringify({ bad: false }))
    expect(getOutputTitle('bad')).toBeUndefined()
  })

  it('continues when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    expect(() => saveVoiceName('voice', '목소리')).not.toThrow()
    expect(getVoiceName('voice', '기본 이름')).toBe('기본 이름')
  })
})
