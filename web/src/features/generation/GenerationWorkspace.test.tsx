import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GenerationWorkspace } from './GenerationWorkspace'
import { listJobs, getJob, createWorkspace, saveWorkspace, listWorkspaces, selectWorkspaceOutput, createGeneration, listModels, listOutputs } from '../../api/localRuntime'

vi.mock('../../api/localRuntime', () => ({
  listJobs: vi.fn(),
  listWorkspaces: vi.fn(), createWorkspace: vi.fn(), saveWorkspace: vi.fn(), selectWorkspaceOutput: vi.fn(),
  listOutputs: vi.fn(),
  getRecordingAudio: vi.fn(),
  cancelJob: vi.fn(),
  createGeneration: vi.fn(),
  getJob: vi.fn(),
  installModel: vi.fn(),
  listModels: vi.fn(),
}))

const recordings = [
  { id: 'voice-mom', transcript: '엄마 목소리', created_at: '2026-11-08T00:00:00Z', duration_seconds: 24, sample_rate: 48_000, channels: 1, bytes: 100_000 },
  { id: 'voice-dad', transcript: '아빠 목소리', created_at: '2026-11-07T00:00:00Z', duration_seconds: 18, sample_rate: 48_000, channels: 1, bytes: 80_000 },
]

const work = { id: 'work-1', title: '안내 방송', text: '저장한 대본', recording_id: 'voice-mom', selected_output_id: null, created_at: '2026-11-11', updated_at: '2026-11-11' }

const installedModel = {
  id: 'qwen3-tts-0.6b-base', repository: 'Qwen/Qwen3-TTS-12Hz-0.6B-Base', status: 'installed' as const,
  language: 'Korean', license: 'Apache-2.0', revision: 'fixed-revision', download_size_bytes: 2_520_000_000,
  disk_free_gib: 20, memory_available_gib: 5.8, memory_recommended_free_gib: 5.7,
}

function renderWorkspace() {
  return render(<GenerationWorkspace
    token="test-token"
    recordings={recordings}
    initialText="엄마와 아이가 함께 읽는 동화 대본입니다."
    onOutputCreated={() => undefined}
    onNavigate={() => undefined}
  />)
}

describe('GenerationWorkspace', () => {
  beforeEach(() => { vi.clearAllMocks(); vi.mocked(listJobs).mockResolvedValue([]); sessionStorage.clear(); vi.mocked(listWorkspaces).mockResolvedValue([]); vi.mocked(createWorkspace).mockResolvedValue(work); vi.mocked(saveWorkspace).mockImplementation(async (_token, _id, title, text, recordingId) => ({ ...work, title, text, recording_id: recordingId })); vi.mocked(listModels).mockResolvedValue([installedModel]); vi.mocked(listOutputs).mockResolvedValue([]) })

  it('restores expression settings and sends them to saving and generation', async () => {
    const settings = { model_id: 'chatterbox-multilingual-v2', expression_intensity: 0.8 }
    vi.mocked(listModels).mockResolvedValue([installedModel, { ...installedModel, id: settings.model_id, supports_expression: true }])
    vi.mocked(listWorkspaces).mockResolvedValue([{ ...work, generation_settings: settings }])
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id }))
    vi.mocked(createGeneration).mockResolvedValue({ id: 'job', kind: 'generation', status: 'queued', recording_id: 'voice-mom', model_id: settings.model_id, text: work.text })
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('slider', { name: '표현 강도' })).toHaveValue('0.8'))
    expect(screen.getByRole('combobox', { name: '음성 엔진' })).toHaveValue(settings.model_id)
    fireEvent.change(screen.getByRole('slider', { name: '표현 강도' }), { target: { value: '0.6' } })
    fireEvent.click(screen.getByRole('button', { name: '음성 만들기' }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledWith('test-token', 'voice-mom', work.text, settings.model_id, work.id, 0.6))
    expect(saveWorkspace).toHaveBeenCalledWith('test-token', work.id, work.title, work.text, 'voice-mom', { ...settings, expression_intensity: 0.6 })
  })

  it('preserves unavailable expression settings without generating with a different engine', async () => {
    const settings = { model_id: 'chatterbox-multilingual-v2', expression_intensity: 0.8 }
    vi.mocked(listWorkspaces).mockResolvedValue([{ ...work, generation_settings: settings }])
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id }))
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('slider', { name: '표현 강도' })).toHaveValue('0.8'))
    expect(screen.getByRole('button', { name: '음성 만들기' })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: '작업 저장' }))
    await waitFor(() => expect(saveWorkspace).toHaveBeenCalledWith('test-token', work.id, work.title, work.text, 'voice-mom', settings))
    expect(createGeneration).not.toHaveBeenCalled()
  })

  it('restores saved fields when only workspace identity remains in browser storage', async () => {
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id }))
    vi.mocked(listWorkspaces).mockResolvedValue([{ ...work, recording_id: 'voice-dad' }])
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue(work.text))
    expect(screen.getByLabelText('제목')).toHaveValue(work.title)
    expect(screen.getAllByRole('radio')[1]).toBeChecked()
  })

  it('starts an explicitly supplied script as a new work without overwriting the previous work', async () => {
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id, text: work.text, title: work.title }))
    vi.mocked(listWorkspaces).mockResolvedValue([work])
    render(<GenerationWorkspace token="test-token" recordings={recordings} initialText="새 대본" initialTitle="새 작업" onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('option', { name: work.title })
    expect(screen.getByRole('combobox', { name: '저장한 작업' })).toHaveValue('')
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue('새 대본')
  })

  it('does not substitute another voice when a restored recording has been deleted', async () => {
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id, text: work.text, recordingId: 'deleted-voice' }))
    vi.mocked(listWorkspaces).mockResolvedValue([{ ...work, recording_id: 'deleted-voice' }])
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('등록한 목소리를 찾을 수 없습니다.')
    expect(screen.getAllByRole('radio').every((radio) => !(radio as HTMLInputElement).checked)).toBe(true)
    expect(screen.getByRole('button', { name: '음성 만들기' })).toBeDisabled()
    fireEvent.click(screen.getAllByRole('radio')[1])
    await waitFor(() => expect(screen.getByRole('button', { name: '음성 만들기' })).toBeEnabled())
    expect(screen.queryByText(/등록한 목소리를 찾을 수 없습니다/)).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue(work.text)
  })

  it('selects a saved voice from a card', async () => {
    renderWorkspace()

    const savedVoice = await screen.findByRole('radio', { name: /저장한 목소리 2/ })
    fireEvent.click(savedVoice)

    expect(savedVoice).toBeChecked()
    expect(screen.getByRole('radio', { name: /저장한 목소리 1/ })).not.toBeChecked()
  })

  it('keeps the conversion screen focused on the book, voice, and conversion action', async () => {
    renderWorkspace()

    expect(await screen.findByRole('heading', { level: 2, name: '목소리 선택' })).toBeVisible()
    expect(screen.getByRole('heading', { level: 2, name: '읽을 텍스트' })).toBeVisible()
    expect(screen.getByRole('button', { name: '음성 만들기' })).toBeVisible()
    expect(screen.queryAllByRole('combobox')).toHaveLength(1)
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue('엄마와 아이가 함께 읽는 동화 대본입니다.')
    expect(screen.queryByText(/Qwen|모델|메모리|RAM/i)).not.toBeInTheDocument()
  })
  it('prevents duplicate generation requests while submission is pending', async () => {
    vi.mocked(createGeneration).mockImplementation(() => new Promise(() => {}))
    renderWorkspace()
    await screen.findByRole('button', { name: '선택한 목소리 듣기' })
    const button = screen.getByRole('button', { name: '음성 만들기' })
    await new Promise((resolve) => setTimeout(resolve, 0))
    fireEvent.click(button)
    fireEvent.click(button)
    await waitFor(() => expect(createGeneration).toHaveBeenCalledTimes(1))
    expect(button).toBeDisabled()
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toBeDisabled()
  })

  it('restores edited text after leaving and reopening the workspace', async () => {
    const view = render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toBeEnabled())
    fireEvent.change(screen.getByRole('textbox', { name: '읽을 텍스트' }), { target: { value: '다음에도 이어서 만들 대본' } })
    view.unmount()
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue('다음에도 이어서 만들 대본')
    await screen.findByRole('button', { name: '선택한 목소리 듣기' })
  })

  it('opens a persisted workspace and sends its identity with generation', async () => {
    vi.mocked(listWorkspaces).mockResolvedValue([work])
    vi.mocked(createGeneration).mockImplementation(() => new Promise(() => {}))
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('option', { name: '안내 방송' })
    fireEvent.change(screen.getByRole('combobox', { name: '저장한 작업' }), { target: { value: work.id } })
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue(work.text)
    fireEvent.click(screen.getByRole('button', { name: '음성 만들기' }))
    await waitFor(() => expect(createGeneration).toHaveBeenCalledWith('test-token', 'voice-mom', work.text, installedModel.id, work.id))
    expect(createWorkspace).not.toHaveBeenCalled()
  })

  it('keeps draft content and blocks generation when workspace saving fails', async () => {
    vi.mocked(saveWorkspace).mockRejectedValueOnce(new Error('저장 실패'))
    renderWorkspace()
    await waitFor(() => expect(screen.getByRole('button', { name: '음성 만들기' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '음성 만들기' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('저장 실패')
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue('엄마와 아이가 함께 읽는 동화 대본입니다.')
    expect(createGeneration).not.toHaveBeenCalled()
  })

  it('filters versions by workspace and persists the final choice', async () => {
    vi.mocked(listWorkspaces).mockResolvedValue([work])
    const output = { id: 'result-1', workspace_id: work.id, recording_id: 'voice-mom', text: '이 작업의 결과', created_at: '2026-11-11T00:00:00Z', duration_seconds: 3, sample_rate: 24000, bytes: 100, model_id: installedModel.id, model_load_seconds: 1, generation_seconds: 2, peak_rss_mib: 100 }
    vi.mocked(listOutputs).mockResolvedValue([output, { ...output, id: 'result-2', workspace_id: 'other-work', text: '다른 작업의 결과' }])
    vi.mocked(selectWorkspaceOutput).mockResolvedValue({ ...work, selected_output_id: output.id })
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    await screen.findByRole('option', { name: work.title })
    fireEvent.change(screen.getByRole('combobox', { name: '저장한 작업' }), { target: { value: work.id } })
    expect(await screen.findByText(output.text)).toBeVisible()
    expect(screen.queryByText('다른 작업의 결과')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '최종 결과로 선택' }))
    await waitFor(() => expect(selectWorkspaceOutput).toHaveBeenCalledWith('test-token', work.id, output.id))
    expect(await screen.findByRole('button', { name: '최종 결과' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows an interrupted saved job and lets the preserved script be retried', async () => {
    sessionStorage.setItem('voice-studio.generation-draft', JSON.stringify({ workId: work.id }))
    vi.mocked(listWorkspaces).mockResolvedValue([work])
    vi.mocked(listJobs).mockResolvedValue([{ id: 'interrupted-job', kind: 'generation', status: 'failed', workspace_id: work.id, recording_id: 'voice-mom', model_id: installedModel.id, text: work.text, error_code: 'runtime_restarted' }])
    vi.mocked(createGeneration).mockResolvedValue({ id: 'retry-job', kind: 'generation', status: 'queued', recording_id: 'voice-mom', model_id: installedModel.id, text: work.text })
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={vi.fn()} onNavigate={vi.fn()} />)
    expect(await screen.findByRole('alert')).toHaveTextContent('PC 앱이 재시작되어 생성이 중단되었습니다.')
    expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toHaveValue(work.text)
    const retry = screen.getByRole('button', { name: '다시 생성' })
    await waitFor(() => expect(retry).toBeEnabled())
    fireEvent.click(retry)
    await waitFor(() => expect(createGeneration).toHaveBeenCalledWith('test-token', 'voice-mom', work.text, installedModel.id, work.id))
  })

  it('recovers an active generation after reopening and shows the completed result', async () => {
    const output = { id: 'recovered-output', text: '복구한 음성', recording_id: 'voice-mom', created_at: '2026-11-11T00:00:00Z', duration_seconds: 2, sample_rate: 24000, bytes: 100, model_id: installedModel.id, model_load_seconds: 1, generation_seconds: 1, peak_rss_mib: 100 }
    const pending = { created_at: new Date(Date.now() - 120000).toISOString(), id: 'active-job', kind: 'generation' as const, status: 'generating' as const, recording_id: 'voice-mom', model_id: installedModel.id, text: output.text }
    vi.mocked(listJobs).mockResolvedValue([pending])
    vi.mocked(getJob).mockResolvedValue({ ...pending, status: 'completed', output })
    const onOutputCreated = vi.fn()
    render(<GenerationWorkspace token="test-token" recordings={recordings} onOutputCreated={onOutputCreated} onNavigate={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('textbox', { name: '읽을 텍스트' })).toBeDisabled())
    expect(await screen.findByLabelText('생성 경과 시간')).toHaveTextContent(/경과 02:0[0-9]/)
    expect(screen.getByLabelText('생성 경과 시간').closest('[role="status"], [aria-live="polite"]')).toBeNull()
    await waitFor(() => expect(onOutputCreated).toHaveBeenCalledWith(output), { timeout: 3000 })
    expect(await screen.findByText(output.text)).toBeVisible()
  })

})
