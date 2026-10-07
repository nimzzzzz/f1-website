'use client'

import { useEffect, useRef, useState } from 'react'

/** The existing LIGHTS OUT launch film, kept separate from the usable account form. */
export default function RacingFilm() {
  const video = useRef<HTMLVideoElement>(null)
  const [enabled, setEnabled] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [reduced, setReduced] = useState(true)
  const [failed, setFailed] = useState(false)
  const userPaused = useRef(false)
  const userStarted = useRef(false)
  const ready = useRef(false)
  const visible = useRef(true)

  useEffect(() => {
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    const sync = () => {
      setReduced(preference.matches)
      if (preference.matches) { userStarted.current = false; video.current?.pause() }
      else if (!(navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData) setEnabled(true)
    }
    sync()
    preference.addEventListener('change', sync)
    return () => preference.removeEventListener('change', sync)
  }, [])

  useEffect(() => {
    const element = video.current
    if (!element || !enabled) return
    function resume() {
      if (!element || document.hidden || !visible.current || userPaused.current || (reduced && !userStarted.current)) return
      element.play().catch(() => setPlaying(false))
    }
    function visibility() { if (document.hidden) element?.pause(); else resume() }
    element.muted = true
    if (!element.currentSrc) element.load()
    resume()
    const observer = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting
      if (entry.isIntersecting) resume(); else element.pause()
    })
    observer.observe(element)
    document.addEventListener('visibilitychange', visibility)
    return () => { observer.disconnect(); document.removeEventListener('visibilitychange', visibility); element.pause() }
  }, [enabled, reduced])

  function toggle() {
    const element = video.current
    if (!element) return
    if (playing) { userPaused.current = true; element.pause() }
    else {
      userPaused.current = false
      userStarted.current = true
      if (!enabled) { setEnabled(true); return }
      // Playback after a direct user action is also available with reduced motion.
      element.play().catch(() => setPlaying(false))
    }
  }

  return <>
    <div className="signin-film" aria-hidden="true">
      <div className="signin-film-poster" />
      <video ref={video} className={playing || ready.current ? 'is-ready' : ''} muted playsInline loop preload="none" poster="/intro/poster.jpg"
        onPlaying={() => { ready.current = true; setPlaying(true) }} onPause={() => setPlaying(false)} onError={() => { setFailed(true); setPlaying(false) }}>
        {enabled && <><source src="/intro/launch.webm" type="video/webm" /><source src="/intro/launch.mp4" type="video/mp4" /></>}
      </video>
      <div className="signin-film-shade" />
    </div>
    {!failed && <button type="button" className="signin-film-control" onClick={toggle} aria-label={playing ? 'Pause background film' : 'Play background film'}>
      <span className={`signin-play-symbol ${playing ? 'is-playing' : ''}`} aria-hidden /><span>{playing ? 'Pause film' : 'Play film'}</span>
    </button>}
  </>
}
