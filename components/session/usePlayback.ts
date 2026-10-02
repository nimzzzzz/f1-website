'use client'
import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'

/** Explicit sample playback; no per-frame React updates. */
export function usePlayback(value: number, min: number, max: number, update: Dispatch<SetStateAction<number>>, delay = 250) {
  const [playing, setPlaying] = useState(false)
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => { setReduced(media.matches); if (media.matches) setPlaying(false) }
    const hidden = () => { if (document.hidden) setPlaying(false) }
    sync(); media.addEventListener('change', sync); document.addEventListener('visibilitychange', hidden)
    return () => { media.removeEventListener('change', sync); document.removeEventListener('visibilitychange', hidden) }
  }, [])
  useEffect(() => { if (value >= max) setPlaying(false) }, [value, max])
  useEffect(() => {
    if (!playing || reduced) return
    const timer = window.setInterval(() => update(v => Math.min(max, v + 1)), delay)
    return () => window.clearInterval(timer)
  }, [playing, reduced, max, update, delay])
  return { playing, reduced, stop: () => setPlaying(false), toggle: () => {
    if (reduced || max <= min) return
    if (value >= max) update(min)
    setPlaying(v => !v)
  } }
}
