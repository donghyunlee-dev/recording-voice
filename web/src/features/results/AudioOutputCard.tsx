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
    if (!window.confirm('이 생성 결과를 삭제할까요?')) return
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
    <Card className="audio-output-card">
      <div className="audio-output-toolbar">
        <div className="audio-output-meta">
          <span className="audio-output-wave" aria-hidden="true">〰</span>
          <time dateTime={output.created_at}>{formatOutputDate(output.created_at)}</time>
          <span className="voice-take-duration">{output.duration_seconds.toFixed(1)}초</span>
        </div>
        <div className="audio-output-actions">
          {!audioUrl && <Button className="audio-output-play" variant="primary" aria-label="생성된 음성 듣기" title="생성된 음성 듣기" onClick={() => void loadAudio()}>
            <span aria-hidden="true">▶</span>
          </Button>}
          {onDeleted && <Button className="audio-output-delete" variant="ghost" disabled={deleting} aria-label="결과 삭제" title={deleting ? '삭제 중' : '결과 삭제'} onClick={() => void removeOutput()}>
            {deleting ? <span aria-hidden="true">…</span> : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
          </Button>}
        </div>
      </div>
      <section className="transcript-reading-page" aria-label="생성 대본">
        <p className="storybook-reading-page__text voice-take-transcript">{output.text}</p>
      </section>
      {audioUrl && <audio className="audio-output-player" controls src={audioUrl} aria-label="생성된 음성 재생" />}
      <details className="audio-output-details" aria-label="파일 정보">
        <summary aria-label="파일 정보" title="파일 정보"><span aria-hidden="true">ⓘ</span></summary>
        <div className="audio-output-detail-list">
          <span>Qwen3-TTS 0.6B Base</span>
          <span>{output.sample_rate.toLocaleString()} Hz</span>
          <span>생성 {output.generation_seconds.toFixed(1)}초</span>
          <span>모델 준비 {output.model_load_seconds.toFixed(1)}초</span>
          {audioUrl && <a className="audio-output-download" href={audioUrl} download="voice-generated.wav" aria-label="WAV 다운로드" title="WAV 다운로드">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </a>}
        </div>
      </details>
      {error && <p role="alert" className="recorder-error">{error}</p>}
    </Card>
  )
}

function formatOutputDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}
