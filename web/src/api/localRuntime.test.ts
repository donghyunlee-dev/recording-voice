import { afterEach, describe, expect, it, vi } from 'vitest'
import { getRuntimeHealth, getRuntimeSystem, pairRuntime, saveRecording } from './localRuntime'

describe('local runtime client', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

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

  it('requests installer-mode pairing only after the browser connection action', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ access_token: 'token', expires_in: 43200, token_type: 'Bearer' }) })
    vi.stubGlobal('fetch', fetchMock)

    await pairRuntime()

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://127.0.0.1:8765/api/v1/pair')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({}))
    expect(new Headers(init.headers).get('X-Local-Request')).toBe('1')
    expect(init.targetAddressSpace).toBe('loopback')
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

  it('selects the Windows runtime first and routes pairing to that port', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', os: 'Windows', version: '0.1.0', api_version: 'v1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'windows-token', expires_in: 43200, token_type: 'Bearer' }) })
    vi.stubGlobal('fetch', fetchMock)

    const health = await getRuntimeHealth()
    await pairRuntime()

    expect(health.os).toBe('Windows')
    expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:8766/api/v1/health')
    expect(fetchMock.mock.calls[1][0]).toBe('http://127.0.0.1:8766/api/v1/pair')
  })

  it('falls back to the WSL development runtime when Windows is unavailable', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Windows runtime unavailable'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', os: 'Linux', version: '0.1.0', api_version: 'v1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'linux-token', expires_in: 43200, token_type: 'Bearer' }) })
    vi.stubGlobal('fetch', fetchMock)

    const health = await getRuntimeHealth()
    await pairRuntime()

    expect(health.os).toBe('Linux')
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:8766/api/v1/health',
      'http://127.0.0.1:8765/api/v1/health',
      'http://127.0.0.1:8765/api/v1/pair',
    ])
  })

  it('does not select a Linux service responding on the Windows-only port', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', os: 'Linux', version: '0.1.0', api_version: 'v1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', os: 'Linux', version: '0.1.0', api_version: 'v1' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'linux-token', expires_in: 43200, token_type: 'Bearer' }) })
    vi.stubGlobal('fetch', fetchMock)

    await getRuntimeHealth()
    await pairRuntime()

    expect(fetchMock.mock.calls[2][0]).toBe('http://127.0.0.1:8765/api/v1/pair')
  })

  it('refuses to connect a production page to the WSL runtime', async () => {
    vi.stubEnv('DEV', false)
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('Windows runtime unavailable'))
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'ok', os: 'Linux', version: '0.1.0', api_version: 'v1' }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getRuntimeHealth()).rejects.toMatchObject({ code: 'windows_runtime_required' })
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:8766/api/v1/health',
      'http://127.0.0.1:8765/api/v1/health',
    ])
  })
})
