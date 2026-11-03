import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRuntimeSystem, pairRuntime, saveRecording } from './localRuntime'

describe('local runtime client', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('sends pairing only when explicitly called and declares the loopback target', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'token', expires_in: 43200, token_type: 'Bearer' }) })
    vi.stubGlobal('fetch', fetchMock)

    await pairRuntime('terminal-code')

    expect(fetchMock).toHaveBeenCalledWith('http://127.0.0.1:8765/api/v1/pair', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ code: 'terminal-code' }),
      targetAddressSpace: 'loopback',
    }))
  })

  it('protects system requests with the paired token and custom header', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ os: 'Linux' }) })
    vi.stubGlobal('fetch', fetchMock)

    await getRuntimeSystem('local-token')

    const headers = new Headers(fetchMock.mock.calls[0][1].headers)
    expect(headers.get('Authorization')).toBe('Bearer local-token')
    expect(headers.get('X-Local-Request')).toBe('1')
  })

  it('uploads the WAV and transcript in multipart form without overriding its boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: 'take-id' }) })
    vi.stubGlobal('fetch', fetchMock)
    const wav = new Blob([new Uint8Array([82, 73, 70, 70])], { type: 'audio/wav' })

    await saveRecording('local-token', wav, '안녕하세요.')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8765/api/v1/recordings')
    expect(init.body).toBeInstanceOf(FormData)
    expect((init.body as FormData).get('transcript')).toBe('안녕하세요.')
    expect(new Headers(init.headers).has('Content-Type')).toBe(false)
    expect(init.targetAddressSpace).toBe('loopback')
  })
})
