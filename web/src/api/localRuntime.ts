export interface RuntimeHealth {
  status: 'ok'
  version: string
  api_version: 'v1'
  os?: string
}

export interface RuntimeSession {
  access_token: string
  expires_in: number
  token_type: 'Bearer'
}

export interface RuntimeSystem {
  os: string
  architecture: string
  cpu_logical_count: number | null
  memory_total_gib: number | null
  memory_available_gib: number | null
  model_cache_disk_free_gib: number
}

export interface LocalRecording {
  id: string
  transcript: string
  created_at: string
  duration_seconds: number
  sample_rate: number
  channels: number
  bytes: number
}

export interface LocalModel {
  id: string
  repository: string
  status: 'installed' | 'not_installed' | 'installing'
  language: string
  license: string
  revision: string
  download_size_bytes: number
  disk_free_gib: number
  memory_available_gib: number | null
  memory_recommended_free_gib: number
}

export interface LocalOutput {
  id: string
  created_at: string
  duration_seconds: number
  sample_rate: number
  bytes: number
  model_id: string
  recording_id: string
  text: string
  model_load_seconds: number
  generation_seconds: number
  peak_rss_mib: number
}

export interface RuntimeJob {
  id: string
  kind: 'generation' | 'model_install'
  status: 'queued' | 'downloading' | 'loading_model' | 'generating' | 'completed' | 'failed' | 'cancelled'
  recording_id: string
  model_id: string
  text: string
  output_id?: string
  output?: LocalOutput
  error_code?: string
  error_type?: string
  downloaded_bytes?: number
  total_bytes?: number | null
  progress_percent?: number | null
}

export type RuntimeErrorCode =
  | 'pairing_required'
  | 'invalid_or_expired_pairing_code'
  | 'session_expired'
  | 'origin_not_allowed'
  | 'invalid_host'
  | 'local_request_header_required'
  | 'runtime_unavailable'
  | 'local_access_blocked'
  | 'license_confirmation_required'
  | 'model_already_installed'
  | 'local_job_running'
  | 'unsupported_model'
  | 'disk_space_insufficient'
  | 'memory_insufficient'
  | 'windows_runtime_required'
  | 'unknown'

export class LocalRuntimeError extends Error {
  constructor(readonly code: RuntimeErrorCode, message: string) {
    super(message)
    this.name = 'LocalRuntimeError'
  }
}

const windowsRuntimeBaseUrl = 'http://127.0.0.1:8766/api/v1'
const linuxRuntimeBaseUrl = 'http://127.0.0.1:8765/api/v1'
const runtimeHealthTimeoutMs = 2500
let runtimeBaseUrl = linuxRuntimeBaseUrl
let discoveryInFlight: Promise<RuntimeHealth> | null = null

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  try {
    const headers = new Headers(init.headers)
    if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    const response = await fetch(`${runtimeBaseUrl}${path}`, {
      ...init,
      headers,
      // Chrome requires this declaration for HTTPS pages calling a loopback HTTP service.
      targetAddressSpace: 'loopback',
    } as RequestInit)
    if (response.status === 204) return undefined as T
    const payload = await response.json()
    if (!response.ok) {
      const code = payload?.detail?.code as RuntimeErrorCode | undefined
      throw new LocalRuntimeError(code ?? 'unknown', runtimeMessage(code))
    }
    return payload as T
  } catch (error) {
    if (error instanceof LocalRuntimeError) throw error
    if (location.protocol === 'https:') {
      throw new LocalRuntimeError('local_access_blocked', '브라우저가 로컬 접근을 차단했거나 로컬 앱이 중지되었습니다. 주소 표시줄의 로컬 네트워크/Loopback 권한과 PC 앱 실행 상태를 확인해 주세요.')
    }
    throw new LocalRuntimeError('runtime_unavailable', 'PC에서 로컬 앱이 실행 중인지 확인해 주세요.')
  }
}

function runtimeMessage(code?: RuntimeErrorCode): string {
  switch (code) {
    case 'invalid_or_expired_pairing_code': return '페어링 코드가 틀렸거나 만료되었습니다.'
    case 'session_expired': return '연결이 만료되었습니다. 다시 연결해 주세요.'
    case 'origin_not_allowed': return '현재 웹 주소는 로컬 앱 연결 허용 목록에 없습니다.'
    case 'invalid_host': return '로컬 앱 주소를 확인할 수 없습니다.'
    case 'local_request_header_required': return '브라우저 요청을 확인할 수 없습니다. 페이지를 새로고침해 주세요.'
    case 'pairing_required': return '먼저 페어링 코드를 입력해 주세요.'
    case 'local_access_blocked': return '브라우저 로컬 네트워크/Loopback 권한 또는 로컬 앱 실행 상태를 확인해 주세요.'
    case 'license_confirmation_required': return '다운로드를 시작하기 전에 모델 라이선스를 확인해 주세요.'
    case 'model_already_installed': return '이 모델은 이미 설치되어 있습니다.'
    case 'local_job_running': return '현재 로컬 작업이 끝난 뒤 다시 시도해 주세요.'
    case 'unsupported_model': return '지원하지 않는 모델입니다.'
    case 'disk_space_insufficient': return '모델을 내려받을 디스크 공간이 부족합니다. 모델 캐시에 최소 8 GiB를 확보해 주세요.'
    case 'memory_insufficient': return '현재 사용 가능한 메모리가 부족합니다. 다른 프로그램을 종료한 뒤 다시 시도해 주세요.'
    case 'windows_runtime_required': return 'Windows 백엔드 대신 Linux/WSL 백엔드가 응답했습니다. Windows 설치 프로그램을 다시 실행해 주세요.'
    default: return 'PC에서 로컬 앱이 실행 중인지 확인해 주세요.'
  }
}

export async function getRuntimeHealth(): Promise<RuntimeHealth> {
  if (!discoveryInFlight) {
    discoveryInFlight = discoverRuntime().finally(() => { discoveryInFlight = null })
  }
  return discoveryInFlight
}

async function discoverRuntime(): Promise<RuntimeHealth> {
  for (const candidate of [
    { baseUrl: windowsRuntimeBaseUrl, requireWindows: true },
    { baseUrl: linuxRuntimeBaseUrl, requireWindows: !import.meta.env.DEV },
  ]) {
    let health: RuntimeHealth
    const controller = new AbortController()
    const timeoutId = window.setTimeout(() => controller.abort(), runtimeHealthTimeoutMs)
    try {
      const response = await fetch(`${candidate.baseUrl}/health`, {
        targetAddressSpace: 'loopback',
        signal: controller.signal,
      } as RequestInit)
      if (!response.ok) continue
      health = await response.json() as RuntimeHealth
    } catch {
      // Try the legacy WSL development port if the Windows app is not reachable.
      continue
    } finally {
      window.clearTimeout(timeoutId)
    }
    if (health.status !== 'ok') continue
    if (candidate.requireWindows && health.os !== 'Windows') {
      if (candidate.baseUrl === linuxRuntimeBaseUrl) {
        throw new LocalRuntimeError('windows_runtime_required', runtimeMessage('windows_runtime_required'))
      }
      continue
    }
    runtimeBaseUrl = candidate.baseUrl
    return health
  }
  if (location.protocol === 'https:') {
    throw new LocalRuntimeError('local_access_blocked', '브라우저가 로컬 접근을 차단했거나 로컬 앱이 중지되었습니다. 주소 표시줄의 로컬 네트워크/Loopback 권한과 PC 앱 실행 상태를 확인해 주세요.')
  }
  throw new LocalRuntimeError('runtime_unavailable', 'PC에서 로컬 앱이 실행 중인지 확인해 주세요.')
}

export async function pairRuntime(code?: string): Promise<RuntimeSession> {
  return request<RuntimeSession>('/pair', {
    method: 'POST',
    body: JSON.stringify(code ? { code } : {}),
    headers: code ? undefined : { 'X-Local-Request': '1' },
  })
}

export async function getRuntimeSystem(token: string): Promise<RuntimeSystem> {
  return request<RuntimeSystem>('/system', {
    headers: { Authorization: `Bearer ${token}`, 'X-Local-Request': '1' },
  })
}

export async function listRecordings(token: string): Promise<LocalRecording[]> {
  const response = await request<{ items: LocalRecording[] }>('/recordings', { headers: localHeaders(token) })
  return response.items
}

export async function saveRecording(token: string, wav: Blob, transcript: string): Promise<LocalRecording> {
  const form = new FormData()
  form.set('file', wav, 'voice-take.wav')
  form.set('transcript', transcript)
  return request<LocalRecording>('/recordings', { method: 'POST', body: form, headers: localHeaders(token) })
}

export async function deleteRecording(token: string, recordingId: string): Promise<void> {
  return request<void>(`/recordings/${encodeURIComponent(recordingId)}`, { method: 'DELETE', headers: localHeaders(token) })
}

export async function getRecordingAudio(token: string, recordingId: string): Promise<Blob> {
  return getProtectedAudio(token, `/recordings/${encodeURIComponent(recordingId)}/audio`, '녹음 파일을 불러오지 못했습니다.')
}

async function getProtectedAudio(token: string, path: string, errorMessage: string): Promise<Blob> {
  try {
    const response = await fetch(`${runtimeBaseUrl}${path}`, {
      headers: localHeaders(token), targetAddressSpace: 'loopback',
    } as RequestInit)
    if (!response.ok) throw new LocalRuntimeError('unknown', errorMessage)
    return await response.blob()
  } catch (error) {
    if (error instanceof LocalRuntimeError) throw error
    if (location.protocol === 'https:') {
      throw new LocalRuntimeError('local_access_blocked', '브라우저가 로컬 접근을 차단했거나 로컬 앱이 중지되었습니다. 주소 표시줄의 로컬 네트워크/Loopback 권한과 PC 앱 실행 상태를 확인해 주세요.')
    }
    throw new LocalRuntimeError('runtime_unavailable', 'PC에서 로컬 앱이 실행 중인지 확인해 주세요.')
  }
}

export async function listModels(token: string): Promise<LocalModel[]> {
  return (await request<{ items: LocalModel[] }>('/models', { headers: localHeaders(token) })).items
}

export async function createGeneration(token: string, recordingId: string, text: string, modelId: string): Promise<RuntimeJob> {
  return request<RuntimeJob>('/generations', {
    method: 'POST',
    body: JSON.stringify({ recording_id: recordingId, text, model_id: modelId }),
    headers: localHeaders(token),
  })
}

export async function installModel(token: string, modelId: string, acceptLicense: boolean): Promise<RuntimeJob> {
  return request<RuntimeJob>(`/models/${encodeURIComponent(modelId)}/install`, {
    method: 'POST', body: JSON.stringify({ accept_license: acceptLicense }), headers: localHeaders(token),
  })
}

export async function getJob(token: string, jobId: string): Promise<RuntimeJob> {
  return request<RuntimeJob>(`/jobs/${encodeURIComponent(jobId)}`, { headers: localHeaders(token) })
}

export async function cancelJob(token: string, jobId: string): Promise<void> {
  return request<void>(`/jobs/${encodeURIComponent(jobId)}/cancel`, { method: 'POST', headers: localHeaders(token) })
}

export async function listOutputs(token: string): Promise<LocalOutput[]> {
  return (await request<{ items: LocalOutput[] }>('/outputs', { headers: localHeaders(token) })).items
}

export async function getOutputAudio(token: string, outputId: string): Promise<Blob> {
  return getProtectedAudio(token, `/outputs/${encodeURIComponent(outputId)}/audio`, '생성 파일을 불러오지 못했습니다.')
}

export async function deleteOutput(token: string, outputId: string): Promise<void> {
  return request<void>(`/outputs/${encodeURIComponent(outputId)}`, { method: 'DELETE', headers: localHeaders(token) })
}

function localHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'X-Local-Request': '1' }
}
