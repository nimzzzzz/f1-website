'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

// How the page content should animate in once the intro hands off.
export type RevealMode = 'cascade' | 'instant'

interface Props {
  // Fired once, when the page content should start revealing underneath.
  onReveal: (mode: RevealMode) => void
  // Fired once the overlay has fully faded and can be unmounted.
  onDone: () => void
}

// Beat timestamps (seconds) hand-read from public/intro/launch.mp4
// (8.04s, 24fps) via 10fps frame analysis — these are tied to THIS
// specific video file; re-cut the clip and they must be re-derived.
// NOTE: the AI-generated clip shows FOUR start lights, not the five of a
// real F1 gantry, so the marker dots sync to the four real ignitions.
const CUES = {
  kicker: 0.3, // "2026 SEASON" kicker fades in
  lights: [0.8, 1.6, 2.25, 3.05], // each start light ignites
  out: 5.45, // all lights dark — the LIGHTS OUT moment
  gone: 6.9, // car fully out of frame; empty wet-track hold begins
} as const

type BeatPhase = 'idle' | 'grid' | 'out' | 'gone'

// Abort the intro if playback hasn't started (or stalls) for this long —
// the site must never be blocked behind a broken or slow video.
const WATCHDOG_MS = 2500
// Begin the UI handoff this many seconds before the clip ends, over the
// empty-track hold at the tail of the video.
const HANDOFF_BEFORE_END_S = 1.0
const OVERLAY_FADE_S = 0.8

const GRAIN_URL =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")"

export default function IntroSequence({ onReveal, onDone }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  // Video mounts client-side only; the black overlay itself renders on the
  // server too so there is never a flash of page content.
  const [showVideo, setShowVideo] = useState(false)
  const [fading, setFading] = useState(false)
  const [beat, setBeat] = useState<{ lit: number; phase: BeatPhase }>({ lit: 0, phase: 'idle' })
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

    // Beat engine: timeupdate only fires ~4Hz, far too coarse to sync the
    // light ignitions, so read currentTime every frame and only set state
    // when the derived beat actually changes.
    let raf = 0
    const tick = () => {
      const t = video.currentTime
      const phase: BeatPhase =
        t >= CUES.gone ? 'gone' : t >= CUES.out ? 'out' : t >= CUES.kicker ? 'grid' : 'idle'
      const lit = phase === 'grid' ? CUES.lights.filter((c) => t >= c).length : 0
      setBeat((b) => (b.phase === phase && b.lit === lit ? b : { lit, phase }))
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      clearTimeout(startTimer)
      clearStallTimer()
      cancelAnimationFrame(raf)
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

          {/* Texture: vignette + film grain over the video */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)',
            }}
          />
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{ backgroundImage: GRAIN_URL, opacity: 0.055 }}
          />

          {/* Typographic beat map — centered above the video */}
          <div className="absolute inset-0 grid place-items-center pointer-events-none">
            <AnimatePresence>
              {(beat.phase === 'grid' || beat.phase === 'idle') && (
                <motion.div
                  key="kicker"
                  className="col-start-1 row-start-1 flex flex-col items-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: beat.phase === 'grid' ? 1 : 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  <motion.p
                    key={`pulse-${beat.lit}`}
                    animate={beat.lit > 0 ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 14,
                      letterSpacing: '0.3em',
                      color: 'rgba(255,255,255,0.6)',
                      // recentres text that letterspacing skews right
                      textIndent: '0.3em',
                    }}
                  >
                    2026 Season
                  </motion.p>

                  {/* Light markers — the clip's gantry has four lights */}
                  <div className="flex gap-2.5 mt-4">
                    {CUES.lights.map((cue, i) => {
                      const on = i < beat.lit
                      return (
                        <span
                          key={cue}
                          className="w-1.5 h-1.5 rounded-full transition-all duration-150"
                          style={{
                            backgroundColor: on ? '#E10600' : 'rgba(255,255,255,0.14)',
                            boxShadow: on ? '0 0 10px 2px rgba(225,6,0,0.55)' : 'none',
                          }}
                        />
                      )
                    })}
                  </div>
                </motion.div>
              )}

              {beat.phase === 'out' && (
                <motion.div
                  key="wordmark"
                  className="col-start-1 row-start-1 relative px-6 text-center"
                  initial={{ opacity: 0, scale: 1.14, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                  exit={{
                    opacity: 0,
                    y: -24,
                    filter: 'blur(8px)',
                    transition: { duration: 0.5, ease: 'easeIn' },
                  }}
                  transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                >
                  {/* red shockwave ghost behind the wordmark */}
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 px-6"
                    initial={{ opacity: 0.8, scale: 1.04 }}
                    animate={{ opacity: 0, scale: 1.18 }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(4rem, 13vw, 11rem)',
                      lineHeight: 0.9,
                      letterSpacing: '0.04em',
                      color: '#E10600',
                    }}
                  >
                    LIGHTS OUT
                  </motion.span>
                  <span
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(4rem, 13vw, 11rem)',
                      lineHeight: 0.9,
                      letterSpacing: '0.04em',
                      color: '#fff',
                      textShadow: '0 0 40px rgba(0,0,0,0.5)',
                    }}
                  >
                    LIGHTS OUT
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.4 }}
            onClick={() => handoff('fade')}
            aria-label="Skip intro"
            className="absolute top-6 right-6 px-3 py-2 text-[11px] tracking-[0.35em] uppercase text-white/40 hover:text-white transition-colors"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            Skip
          </motion.button>
        </>
      )}
    </motion.div>
  )
}
