import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cancelJob, installModel, listModels } from '../../api/localRuntime'
import { ModelSettings } from './ModelSettings'

vi.mock('../../api/localRuntime', () => ({
  cancelJob: vi.fn(),
  getJob: vi.fn(),
  installModel: vi.fn(),
  listModels: vi.fn(),
}))

const model = {
  id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', status: 'not_installed' as const,
  language: 'Korean', license: 'Apache-2.0', revision: 'fixed-revision', download_size_bytes: 2_520_000_000,
  disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
}

describe('ModelSettings', () => {
  beforeEach(() => {
    vi.mocked(listModels).mockResolvedValue([model])
    vi.mocked(installModel).mockResolvedValue({ id: 'install-job', kind: 'model_install', status: 'queued', recording_id: '', model_id: model.id, text: '' })
    vi.mocked(cancelJob).mockResolvedValue()
  })

  it('keeps the existing license-confirmed installation and cancellation actions in settings', async () => {
    render(<ModelSettings token="test-token" />)

    const install = await screen.findByRole('button', { name: '이 PC에 모델 설치' })
    expect(install).toBeDisabled()
    fireEvent.click(screen.getByRole('checkbox', { name: /라이선스와 다운로드 출처/ }))
    expect(install).toBeEnabled()
    fireEvent.click(install)

    await waitFor(() => expect(installModel).toHaveBeenCalledWith('test-token', model.id, true))
    fireEvent.click(await screen.findByRole('button', { name: '취소' }))
    await waitFor(() => expect(cancelJob).toHaveBeenCalledWith('test-token', 'install-job'))
    expect(await screen.findByText('취소됨')).toBeVisible()
  })
})
