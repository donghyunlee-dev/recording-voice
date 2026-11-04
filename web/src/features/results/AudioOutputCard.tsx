import { Button, Card } from '@windsoft/ui'
import { useEffect, useState } from 'react'
import { deleteOutput, getOutputAudio, type LocalOutput } from '../../api/localRuntime'

interface AudioOutputCardProps {
  token: string
  output: LocalOutput
  onDeleted?: (id: string) => void
}

export function AudioOutputCard({ token, output, onDeleted }: AudioOutputCardProps) {
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!audioUrl) return
    return () => URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function loadAudio() {
    try {
      const audio = await getOutputAudio(token, output.id)
      setAudioUrl(URL.createObjectURL(audio))
      setError('')
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '생성 파일을 불러오지 못했습니다.')
    }
  }

  async function removeOutput() {
    setDeleting(true)
    try {
      await deleteOutput(token, output.id)
      onDeleted?.(output.id)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '파일을 삭제하지 못했습니다.')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="voice-take-card" title={`생성 결과 · ${new Date(output.created_at).toLocaleString('ko-KR')}`} description={`${output.duration_seconds.toFixed(1)}초 · ${output.sample_rate.toLocaleString()} Hz · 생성 ${output.generation_seconds.toFixed(1)}초`}>
      <p className="voice-take-transcript">{output.text}</p>
      {!audioUrl ? <Button variant="primary" onClick={() => void loadAudio()}>내 PC에서 결과 재생</Button> : (
        <>
          <audio controls src={audioUrl} aria-label="생성된 음성 재생" />
          <a className="download-take" href={audioUrl} download="voice-generated.wav">WAV 다운로드</a>
        </>
      )}
      <p className="output-model-meta">음성 모델 Qwen3-TTS 0.6B Base · 생성 {output.generation_seconds.toFixed(1)}초 · 모델 준비 {output.model_load_seconds.toFixed(1)}초</p>
      {onDeleted && <Button variant="ghost" disabled={deleting} onClick={() => void removeOutput()}>{deleting ? '삭제 중…' : '결과 삭제'}</Button>}
      {error && <p role="alert" className="recorder-error">{error}</p>}
    </Card>
  )
}
