'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'

// How the page content should animate in once the intro hands off.
export type RevealMode = 'cascade' | 'instant'

interface Props {
  // Fired once, when the page content should start revealing underneath.
  onReveal: (mode: RevealMode) => void
  // Fired once the overlay has fully faded and can be unmounted.
  onDone: () => void
}

// Abort the intro if playback hasn't started (or stalls) for this long —
// the site must never be blocked behind a broken or slow video.
const WATCHDOG_MS = 2500
// Begin the UI handoff this many seconds before the clip ends, over the
// empty-track hold at the tail of the video.
const HANDOFF_BEFORE_END_S = 1.0
const OVERLAY_FADE_S = 0.8

export default function IntroSequence({ onReveal, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Video mounts client-side only; the black overlay itself renders on the
  // server too so there is never a flash of page content.
  const [showVideo, setShowVideo] = useState(false)
  const [fading, setFading] = useState(false)
  const handedOffRef = useRef(false)

  const callbacksRef = useRef({ onReveal, onDone })
  callbacksRef.current = { onReveal, onDone }

  // instant: no fade, no content animation (reduced motion).
  // cut: overlay drops immediately, content still cascades (video failure).
  // fade: normal end-of-video handoff.
  const handoff = (exit: 'fade' | 'cut' | 'instant') => {
    if (handedOffRef.current) return
    handedOffRef.current = true
    callbacksRef.current.onReveal(exit === 'instant' ? 'instant' : 'cascade')
    if (exit === 'fade') {
      setFading(true)
    } else {
      callbacksRef.current.onDone()
    }
  }

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      handoff('instant')
      return
    }
    setShowVideo(true)
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!showVideo) return
    const video = videoRef.current
    if (!video) return

    let started = false
    let stallTimer: ReturnType<typeof setTimeout> | null = null

    const abort = () => handoff('cut')

    const startTimer = setTimeout(() => {
      if (!started) abort()
    }, WATCHDOG_MS)

    const clearStallTimer = () => {
      if (stallTimer) {
        clearTimeout(stallTimer)
        stallTimer = null
      }
    }

    const onPlaying = () => {
      started = true
      clearStallTimer()
    }

    const onWaiting = () => {
      // Buffer underrun mid-playback: give it WATCHDOG_MS to recover.
      clearStallTimer()
      stallTimer = setTimeout(abort, WATCHDOG_MS)
    }

    const onTimeUpdate = () => {
      if (video.currentTime > 0) started = true
      clearStallTimer()
      if (
        Number.isFinite(video.duration) &&
        video.currentTime >= video.duration - HANDOFF_BEFORE_END_S
      ) {
        handoff('fade')
      }
    }

    const onEnded = () => handoff('fade')
    const onError = () => abort()

    video.addEventListener('playing', onPlaying)
    video.addEventListener('waiting', onWaiting)
    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('ended', onEnded)
    video.addEventListener('error', onError)
    video.play().catch(abort)

    return () => {
      clearTimeout(startTimer)
      clearStallTimer()
      video.removeEventListener('playing', onPlaying)
      video.removeEventListener('waiting', onWaiting)
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('ended', onEnded)
      video.removeEventListener('error', onError)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo])

  return (
    <motion.div
      className={`fixed inset-0 z-[200] bg-black ${fading ? 'pointer-events-none' : ''}`}
      initial={false}
      animate={{ opacity: fading ? 0 : 1 }}
      transition={{ duration: OVERLAY_FADE_S, ease: 'easeOut' }}
      onAnimationComplete={() => {
        if (fading) callbacksRef.current.onDone()
      }}
    >
      {showVideo && (
        <>
          <video
            ref={videoRef}
            muted
            autoPlay
            playsInline
            preload="auto"
            poster="/intro/poster.jpg"
            className="h-full w-full object-cover"
          >
            <source src="/intro/launch.webm" type="video/webm" />
            <source src="/intro/launch.mp4" type="video/mp4" />
          </video>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
            onClick={() => handoff('fade')}
            aria-label="Skip intro"
            className="absolute top-6 right-6 px-3 py-2 text-[11px] font-bold tracking-[0.35em] uppercase text-white/40 hover:text-white transition-colors"
          >
            Skip
          </motion.button>
        </>
      )}
    </motion.div>
  )
}
