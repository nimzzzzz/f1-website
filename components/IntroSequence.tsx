'use client'

import { memo, useEffect, useRef, useState, type RefObject } from 'react'
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

// The video is SSR'd as raw markup for two reasons: (1) the browser's
// preload scanner starts the media fetch at HTML parse — several seconds
// before hydration on slow connections — and muted autoplay begins without
// JS; (2) React omits the `muted` attribute during SSR (react#11041),
// which would block pre-hydration autoplay, so React must not own this
// element. motion-reduce:hidden keeps it invisible for reduced-motion
// users until hydration unmounts the whole overlay.
// Kept single-line, no self-closing slashes, no style attribute: the string
// must survive browser HTML re-serialization byte-identical, or hydration
// treats it as a mismatch and recreates the element (restarting playback).
const VIDEO_HTML =
  '<video muted autoplay playsinline preload="auto" fetchpriority="high" poster="/intro/poster.jpg" class="h-full w-full object-cover intro-video-poster"><source src="/intro/launch.webm" type="video/webm"><source src="/intro/launch.mp4" type="video/mp4"></video>'

// memo with stable props: renders exactly once, so React never updates the
// dangerouslySetInnerHTML node after hydration. Without this, React 18's
// post-hydration update path re-assigns the innerHTML on every parent
// re-render (e.g. each beat change), recreating the video and restarting
// playback in a loop.
const VideoLayer = memo(function VideoLayer({ wrapRef }: { wrapRef: RefObject<HTMLDivElement> }) {
  return (
    <div
      ref={wrapRef}
      className="h-full w-full motion-reduce:hidden"
      dangerouslySetInnerHTML={{ __html: VIDEO_HTML }}
    />
  )
})

export default function IntroSequence({ onReveal, onDone }: Props) {
  const videoWrapRef = useRef<HTMLDivElement>(null)
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
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const wrap = videoWrapRef.current
    if (!wrap) return

    let video: HTMLVideoElement | null = null
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
      if (video && video.currentTime > 0) started = true
      clearStallTimer()
      if (
        video &&
        Number.isFinite(video.duration) &&
        video.currentTime >= video.duration - HANDOFF_BEFORE_END_S
      ) {
        handoff('fade')
      }
    }

    const onEnded = () => handoff('fade')
    const onError = () => abort()

    const unbind = (v: HTMLVideoElement) => {
      v.removeEventListener('playing', onPlaying)
      v.removeEventListener('waiting', onWaiting)
      v.removeEventListener('timeupdate', onTimeUpdate)
      v.removeEventListener('ended', onEnded)
      v.removeEventListener('error', onError)
    }

    const bind = (v: HTMLVideoElement) => {
      video = v
      v.addEventListener('playing', onPlaying)
      v.addEventListener('waiting', onWaiting)
      v.addEventListener('timeupdate', onTimeUpdate)
      v.addEventListener('ended', onEnded)
      v.addEventListener('error', onError)
      // The SSR'd video may have been playing since before hydration —
      // catch anything that already happened while no listeners were attached.
      if (v.ended) handoff('fade')
      if (v.currentTime > 0) started = true
      if (v.error) abort()
      // Abort only if the rejection is for the element that is still live
      // AND still in the document: replacing the element rejects its pending
      // play() with AbortError (often before the next tick rebinds), which
      // must not kill the intro. A genuine autoplay denial happens on a
      // connected element.
      v.play().catch(() => {
        if (v === video && v.isConnected) abort()
      })
    }

    // Beat engine: timeupdate only fires ~4Hz, far too coarse to sync the
    // light ignitions, so read currentTime every frame and only set state
    // when the derived beat actually changes. The tick is also the
    // self-healing layer for React's hydration/re-render DOM churn:
    // - element recreated → rebind listeners to the live element;
    // - element MOVED (React remove+reinsert of the same node — which per
    //   spec pauses a media element, with no autoplay re-trigger) → resume.
    let raf = 0
    let lastResume = 0
    let resumeFails = 0
    const tick = () => {
      const current = wrap.querySelector('video')
      if (current !== video) {
        if (video) unbind(video)
        if (current) bind(current)
      }
      if (video) {
        if (video.paused && !video.ended && !handedOffRef.current) {
          const now = performance.now()
          if (now - lastResume > 400) {
            lastResume = now
            const v = video
            v.play().then(() => {
              resumeFails = 0
            }).catch(() => {
              // Repeated rejections on a live, connected element mean
              // playback genuinely can't proceed — cut to content.
              if (v === video && v.isConnected && ++resumeFails >= 6) abort()
            })
          }
        }
        const t = video.currentTime
        const phase: BeatPhase =
          t >= CUES.gone ? 'gone' : t >= CUES.out ? 'out' : t >= CUES.kicker ? 'grid' : 'idle'
        const lit = phase === 'grid' ? CUES.lights.filter((c) => t >= c).length : 0
        setBeat((b) => (b.phase === phase && b.lit === lit ? b : { lit, phase }))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      clearTimeout(startTimer)
      clearStallTimer()
      cancelAnimationFrame(raf)
      if (video) unbind(video)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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
      <>
          <VideoLayer wrapRef={videoWrapRef} />

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
                  initial={{ opacity: 0, y: 18 }}
                  animate={beat.phase === 'grid' ? { opacity: 1, y: 0 } : { opacity: 0, y: 18 }}
                  exit={{ opacity: 0, transition: { duration: 0.2 } }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                >
                  {/* Title card, not caption: display face, near-full white */}
                  <motion.p
                    key={`pulse-${beat.lit}`}
                    animate={beat.lit > 0 ? { scale: [1, 1.03, 1] } : { scale: 1 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    className="uppercase"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.6rem, 3.5vw, 2.8rem)',
                      letterSpacing: '0.25em',
                      lineHeight: 1,
                      color: 'rgba(255,255,255,0.85)',
                      // recentres text that letterspacing skews right
                      textIndent: '0.25em',
                    }}
                  >
                    2026 Season
                  </motion.p>

                  {/* Light markers — the clip's gantry has four lights */}
                  <div className="flex gap-3.5 mt-6">
                    {CUES.lights.map((cue, i) => {
                      const on = i < beat.lit
                      return (
                        <span
                          key={cue}
                          className="w-2.5 h-2.5 rounded-full transition-all duration-150"
                          style={{
                            backgroundColor: on ? '#E10600' : 'rgba(255,255,255,0.14)',
                            boxShadow: on ? '0 0 14px 3px rgba(225,6,0,0.55)' : 'none',
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
    </motion.div>
  )
}
