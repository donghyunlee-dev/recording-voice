import { afterEach, describe, expect, it, vi } from 'vitest'
import { convertRecordingToWav, encodePcm16Wav, importAudioFile } from './wav'

afterEach(() => vi.unstubAllGlobals())

describe('encodePcm16Wav', () => {
  it('writes a mono 16-bit PCM WAV header and clips sample values safely', async () => {
    const blob = encodePcm16Wav(new Float32Array([-1, -0.5, 0, 0.5, 1.5]), 24_000)
    const bytes = new DataView(await blob.arrayBuffer())

    expect(blob.type).toBe('audio/wav')
    expect(bytes.getUint32(0, true)).toBe(0x46464952)
    expect(bytes.getUint32(4, true)).toBe(36 + 5 * 2)
    expect(bytes.getUint16(22, true)).toBe(1)
    expect(bytes.getUint32(24, true)).toBe(24_000)
    expect(bytes.getUint16(34, true)).toBe(16)
    expect(bytes.getInt16(44, true)).toBe(-32768)
    expect(bytes.getInt16(52, true)).toBe(32767)
  })
})

describe('importAudioFile', () => {
  it('rejects an empty file before decoding it', async () => {
    const file = new File([], 'empty.wav', { type: 'audio/wav' })
    const convert = vi.fn()

    await expect(importAudioFile(file, convert)).rejects.toThrow('비어')
    expect(convert).not.toHaveBeenCalled()
  })

  it('converts an accepted local audio file to the same bounded reference WAV format', async () => {
    const file = new File(['audio bytes'], 'reference.wav', { type: 'audio/wav' })
    const converted = new Blob([new Uint8Array(48)], { type: 'audio/wav' })
    const convert = vi.fn().mockResolvedValue(converted)

    await expect(importAudioFile(file, convert)).resolves.toBe(converted)

    expect(convert).toHaveBeenCalledWith(file, 24_000, 300)
  })

  it('rejects an oversized local file before decoding it', async () => {
    const file = new File([new Uint8Array(24 * 1024 * 1024 + 1)], 'large.wav', { type: 'audio/wav' })
    const convert = vi.fn()

    await expect(importAudioFile(file, convert)).rejects.toThrow('24 MB')
    expect(convert).not.toHaveBeenCalled()
  })

  it('rejects recordings longer than five minutes before resampling', async () => {
    const close = vi.fn().mockResolvedValue(undefined)
    class MockAudioContext {
      decodeAudioData = vi.fn().mockResolvedValue({ duration: 301 })
      close = close
    }
    vi.stubGlobal('AudioContext', MockAudioContext)

    await expect(convertRecordingToWav(new Blob(['audio']), 24_000, 300)).rejects.toThrow('5분')
    expect(close).toHaveBeenCalled()
  })
})
