'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import type { Meeting } from '@/lib/openf1'
import { FadeUp } from '@/components/motion/reveals'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export interface SeasonRound {
  meeting: Meeting
  isPast: boolean
  isNext: boolean
  isCancelled: boolean
}

// Section 4 — "THE SEASON". A pinned, scroll-scrubbed horizontal band of
// every round. The thin red line draws to the season's actual completion
// fraction while the band drives across. Touch and reduced-motion get a
// native horizontal scroller with the line set statically.
export default function SeasonSection({ rounds }: { rounds: SeasonRound[] }) {
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  const completed = rounds.filter((r) => r.isPast && !r.isCancelled).length
  const progress = rounds.length > 0 ? completed / rounds.length : 0

  useGSAP(
    () => {
      const section = sectionRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      const line = lineRef.current
      if (!section || !viewport || !track || !line) return

      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(line, { scaleX: progress })
        return
      }

      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth)
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: 'top top',
            end: () => `+=${window.innerHeight * 1.5}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
          },
        })
        tl.to(track, { x: () => -distance(), ease: 'none' }, 0).fromTo(
          line,
          { scaleX: 0 },
          { scaleX: progress, ease: 'none' },
          0
        )
      })
      mm.add('(max-width: 767px), (hover: none)', () => {
        gsap.fromTo(
          line,
          { scaleX: 0 },
          {
            scaleX: progress,
            ease: 'none',
            scrollTrigger: { trigger: section, start: 'top 75%', end: 'top 20%', scrub: 0.4 },
          }
        )
      })
      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [progress, rounds.length] }
  )

  return (
    <section
      ref={sectionRef}
      className="overflow-hidden border-t border-[var(--line)] py-24 md:flex md:min-h-[100dvh] md:flex-col md:justify-center md:py-0"
    >
      <div className="px-6 md:px-14">
        <FadeUp>
          <p className="label-mono text-[var(--text-dim)]">
            THE SEASON — {String(rounds.length).padStart(2, '0')} ROUNDS
          </p>
        </FadeUp>
        {/* season progress line: red draws over the hairline, tied to scroll */}
        <div className="relative mt-8 h-px bg-[var(--line)]">
          <div
            ref={lineRef}
            className="absolute inset-y-0 left-0 w-full origin-left bg-[var(--accent)]"
            style={{ transform: 'scaleX(0)' }}
          />
        </div>
      </div>

      <div
        ref={viewportRef}
        className="mt-10 overflow-x-auto pb-4 md:overflow-x-hidden md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div ref={trackRef} className="flex w-max pl-6 pr-10 md:pl-14">
          {rounds.map(({ meeting, isPast, isNext, isCancelled }, i) => (
            <div
              key={meeting.meeting_key}
              className={`w-44 shrink-0 border-l border-[var(--line)] py-6 pl-4 pr-6 md:w-56 ${
                isPast || isCancelled ? 'opacity-35' : ''
              }`}
            >
              <p className="label-mono flex items-center gap-2 text-[var(--text-dim)]">
                R{String(i + 1).padStart(2, '0')}
                {isNext && (
                  <span
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)]"
                    aria-label="Next race"
                  />
                )}
              </p>
              <p
                className={`mt-3 uppercase leading-none text-[var(--text)] ${
                  isCancelled ? 'line-through decoration-1' : ''
                }`}
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.5rem, 2vw, 2rem)' }}
              >
                {meeting.circuit_short_name}
              </p>
              <p className="label-mono mt-2 text-[var(--text-dim)]">
                {isCancelled
                  ? 'CANCELLED'
                  : new Date(meeting.date_start)
                      .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      .toUpperCase()}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
