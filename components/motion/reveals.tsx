'use client'

import { useRef, type ReactNode, type CSSProperties } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// Reusable scroll-reveal primitives. All of them animate transform /
// opacity / clip-path ONLY (no layout properties), and all collapse to
// fully-visible static content under prefers-reduced-motion.
//
// ⚠ THESE WRAPPERS CREATE STACKING CONTEXTS. Every reveal here leaves a
// transform (and/or opacity/clip-path) on its wrapper div, and each of
// those properties makes the element a stacking context. Consequences:
//
//   • A z-index set on anything INSIDE a reveal is scoped to that reveal.
//     It cannot beat content in a sibling reveal — two sibling wrappers
//     both at z-index:auto paint in DOM ORDER, so the later one always
//     wins no matter how high the inner z-index is.
//   • Therefore ANY OVERLAY rendered inside a reveal — dropdown, popover,
//     tooltip, modal — MUST portal to document.body (createPortal) and
//     position itself `fixed`. Raising z-index is not a fix and will look
//     like it works only until the overlay meets a later sibling.
//
// This has now bitten this codebase three times, each a different symptom
// of the same mechanism:
//   1. the intro: a CSS animation with fill-mode:both made <main> a
//      stacking context and trapped a fixed z-[200] overlay under the bar
//   2. /drivers pin: position:fixed pinning scored a real 0.0429 CLS;
//      fixed by pinType:'transform' (see DriversGallery's note)
//   3. the session picker: its panel, inside a FadeUp on /results, was
//      painted over by the podium block in the NEXT sibling FadeUp —
//      z-[140] was powerless. Fixed by portalling (see SessionPicker).

const reduced = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface RevealProps {
  children: ReactNode
  className?: string
  style?: CSSProperties
  delay?: number
}

export function FadeUp({ children, className, style, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (reduced() || !ref.current) return
      gsap.fromTo(
        ref.current,
        { autoAlpha: 0, y: 44 },
        {
          autoAlpha: 1,
          y: 0,
          duration: 0.9,
          delay,
          ease: 'power3.out',
          scrollTrigger: { trigger: ref.current, start: 'top 85%', once: true },
        }
      )
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

export function ClipReveal({ children, className, style, delay = 0 }: RevealProps) {
  const ref = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (reduced() || !ref.current) return
      gsap.fromTo(
        ref.current,
        { clipPath: 'inset(0 0 100% 0)', y: 24 },
        {
          clipPath: 'inset(0 0 0% 0)',
          y: 0,
          duration: 1.0,
          delay,
          ease: 'power4.out',
          scrollTrigger: { trigger: ref.current, start: 'top 88%', once: true },
        }
      )
    },
    { scope: ref }
  )

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  )
}

// Animates a number from 0 to `value` when it scrolls into view.
// Renders the final value statically for reduced motion / no-JS-yet.
export function CountUp({
  value,
  format = (n: number) => String(Math.round(n)),
  className,
  style,
}: {
  value: number
  format?: (n: number) => string
  className?: string
  style?: CSSProperties
}) {
  const ref = useRef<HTMLSpanElement>(null)

  useGSAP(
    () => {
      const el = ref.current
      if (reduced() || !el) return
      const state = { n: 0 }
      gsap.to(state, {
        n: value,
        duration: 1.4,
        ease: 'power2.out',
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        onUpdate: () => {
          el.textContent = format(state.n)
        },
      })
    },
    { scope: ref, dependencies: [value] }
  )

  return (
    <span ref={ref} className={className} style={style}>
      {format(value)}
    </span>
  )
}

// Pins its container for `scrub` viewport-heights of scroll and drives a
// horizontal band (first child of the pinned track) across. Falls back to
// native horizontal overflow scrolling for reduced motion and touch.
export function PinnedSection({
  children,
  className,
  heights = 1.6,
}: {
  children: ReactNode
  className?: string
  heights?: number
}) {
  const outerRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const outer = outerRef.current
      const track = trackRef.current
      if (reduced() || !outer || !track) return

      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - outer.clientWidth)
        gsap.to(track, {
          x: () => -distance(),
          ease: 'none',
          scrollTrigger: {
            trigger: outer,
            start: 'top top',
            end: () => `+=${window.innerHeight * heights}`,
            pin: true,
            scrub: 0.6,
            invalidateOnRefresh: true,
          },
        })
      })
      return () => mm.revert()
    },
    { scope: outerRef }
  )

  return (
    <div ref={outerRef} className={`overflow-x-auto md:overflow-x-visible ${className ?? ''}`}>
      <div ref={trackRef} className="w-max">
        {children}
      </div>
    </div>
  )
}

// Scroll-scrubbed progress: scales the bar's X from `from` to `to` while
// `triggerRef`'s element crosses the viewport. Used by THE SEASON strip.
export function useScrollProgress(
  barRef: React.RefObject<HTMLElement>,
  triggerRef: React.RefObject<HTMLElement>,
  to = 1
) {
  useGSAP(
    () => {
      const bar = barRef.current
      const trigger = triggerRef.current
      if (!bar || !trigger) return
      if (reduced()) {
        gsap.set(bar, { scaleX: to })
        return
      }
      gsap.fromTo(
        bar,
        { scaleX: 0 },
        {
          scaleX: to,
          ease: 'none',
          scrollTrigger: { trigger, start: 'top 80%', end: 'bottom 40%', scrub: 0.4 },
        }
      )
    },
    { dependencies: [to] }
  )
}
