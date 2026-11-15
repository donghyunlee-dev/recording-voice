import { Button, Card } from '@windsoft/ui'
import { useEffect, useRef, useState } from 'react'
import { deleteOutput, getOutputAudio, type LocalOutput } from '../../api/localRuntime'

interface AudioOutputCardProps {
  token: string
  output: LocalOutput
  onDeleted?: (id: string) => void
  showTranscript?: boolean
  showTechnicalDetails?: boolean
}

export function AudioOutputCard({ token, output, onDeleted, showTranscript = true, showTechnicalDetails = true }: AudioOutputCardProps) {
  const [audioUrl, setAudioUrl] = useState('')
  const [error, setError] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [loadingAudio, setLoadingAudio] = useState(false)
  const [playingAudio, setPlayingAudio] = useState(false)
  const [playbackTime, setPlaybackTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(output.duration_seconds)
  const playerRef = useRef<HTMLAudioElement>(null)

  useEffect(() => {
    if (!audioUrl) return
    return () => URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function loadAudio(autoplay = true) {
    if (loadingAudio) return
    setLoadingAudio(true)
    try {
      const audio = await getOutputAudio(token, output.id)
      const player = playerRef.current
      if (!player) return
      const url = URL.createObjectURL(audio)
      player.src = url
      setAudioUrl(url)
      setError('')
      if (!autoplay) {
        const link = document.createElement('a')
        link.href = url
        link.download = `voice-${output.id}.wav`
        link.click()
        return
      }
      try {
        await player.play()
        setPlayingAudio(true)
      } catch {
        setError('재생을 시작하지 못했어요. 다시 눌러 주세요.')
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '생성 파일을 불러오지 못했습니다.')
    } finally {
      setLoadingAudio(false)
    }
  }

  async function togglePlayback() {
    const player = playerRef.current
    if (!audioUrl || !player) {
      await loadAudio()
      return
    }
    if (playingAudio) {
      player.pause()
      return
    }
    if (player.ended) player.currentTime = 0
    try {
      await player.play()
      setError('')
    } catch {
      setError('재생을 시작하지 못했어요. 다시 눌러 주세요.')
    }
  }

  function seekAudio(value: string) {
    const time = Number(value)
    if (!Number.isFinite(time)) return
    setPlaybackTime(time)
    if (playerRef.current) playerRef.current.currentTime = time
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
          <span className="audio-output-wave" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" width="20" height="20"><path d="M4 10v4m4-8v12m4-15v18m4-15v12m4-8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg></span>
          <time dateTime={output.created_at}>{formatOutputDate(output.created_at)}</time>
          <span className="voice-take-duration">{output.duration_seconds.toFixed(1)}초</span>
        </div>
        <div className="audio-output-actions">
          {audioUrl ? <a className="voice-take-action audio-output-action" href={audioUrl} download={`voice-${output.id}.wav`} aria-label="WAV 다운로드" title="WAV 다운로드">
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg> 다운로드
          </a> : <Button className="voice-take-action audio-output-action" variant="secondary" disabled={loadingAudio} aria-label="WAV 다운로드" onClick={() => void loadAudio(false)}><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M12 3v12m0 0 4-4m-4 4-4-4M5 17v3h14v-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>다운로드</Button>}
          {onDeleted && <Button className="voice-take-action voice-take-action--delete audio-output-action" variant="secondary" disabled={deleting} aria-label="결과 삭제" title={deleting ? '삭제 중' : '결과 삭제'} onClick={() => void removeOutput()}>
            {deleting ? <span aria-hidden="true">…</span> : <><svg aria-hidden="true" viewBox="0 0 24 24" fill="none"><path d="M4 7h16M9 7V4h6v3m3 0-.8 13H6.8L6 7m4 4v6m4-6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>삭제</>}
          </Button>}
        </div>
      </div>
      <div className="audio-output-playback">
        <audio ref={playerRef} className="audio-output-media" aria-label="생성된 음성 재생" onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || output.duration_seconds)} onTimeUpdate={(event) => setPlaybackTime(event.currentTarget.currentTime)} onPlay={() => setPlayingAudio(true)} onPause={() => setPlayingAudio(false)} onEnded={() => setPlayingAudio(false)} />
        <Button className="audio-output-play-toggle" variant="primary" aria-label={loadingAudio ? '불러오는 중' : playingAudio ? '일시정지' : audioUrl ? playbackTime > 0 && playbackTime < audioDuration ? '이어 듣기' : '다시 듣기' : '듣기'} onClick={() => void (playingAudio ? playerRef.current?.pause() : togglePlayback())} disabled={loadingAudio}>
          {loadingAudio ? <span className="audio-output-spinner" aria-hidden="true" /> : playingAudio
            ? <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M8 5v14m8-14v14" stroke="currentColor" strokeWidth="3" strokeLinecap="round" /></svg>
            : <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7V5Z" fill="currentColor" /></svg>}
          <span>{loadingAudio ? '불러오는 중' : playingAudio ? '일시정지' : audioUrl ? playbackTime > 0 && playbackTime < audioDuration ? '이어 듣기' : '다시 듣기' : '듣기'}</span>
        </Button>
        <div className="audio-output-timeline">
          <input className="audio-output-seek" type="range" min="0" max={audioDuration || output.duration_seconds} step="0.1" value={Math.min(playbackTime, audioDuration || output.duration_seconds)} aria-label="재생 위치" aria-valuetext={`${formatAudioTime(playbackTime)} / ${formatAudioTime(audioDuration || output.duration_seconds)}`} disabled={!audioUrl} onChange={(event) => seekAudio(event.currentTarget.value)} />
          <div className="audio-output-time"><time>{formatAudioTime(playbackTime)}</time><time>{formatAudioTime(audioDuration || output.duration_seconds)}</time></div>
        </div>
      </div>
      {showTranscript && <section className="transcript-reading-page" aria-label="생성 대본">
        <p className="storybook-reading-page__text voice-take-transcript">{output.text}</p>
      </section>}
      {showTechnicalDetails && <details className="audio-output-details" aria-label="파일 정보">
        <summary aria-label="파일 정보" title="파일 정보"><span aria-hidden="true">ⓘ</span></summary>
        <div className="audio-output-detail-list">
          <span>Qwen3-TTS 0.6B Base</span>
          <span>{output.sample_rate.toLocaleString()} Hz</span>
          <span>생성 {output.generation_seconds.toFixed(1)}초</span>
          <span>모델 준비 {output.model_load_seconds.toFixed(1)}초</span>
        </div>
      </details>}
      {error && <p role="alert" className="recorder-error">{error}</p>}
    </Card>
  )
}

function formatOutputDate(value: string): string {
  return new Intl.DateTimeFormat('ko-KR', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value))
}

function formatAudioTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00'
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
