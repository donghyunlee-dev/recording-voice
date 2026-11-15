import { useEffect } from 'react'

/** Keep reference and generated audio from overlapping while comparing takes. */
export function useExclusivePlayback() {
  useEffect(() => {
    const onPlay = (event: Event) => {
      if (!(event.target instanceof HTMLAudioElement)) return
      for (const player of document.querySelectorAll('audio')) {
        if (player !== event.target && !player.paused) player.pause()
      }
    }
    // Native media play events do not bubble.
    document.addEventListener('play', onPlay, true)
    return () => document.removeEventListener('play', onPlay, true)
  }, [])
}
