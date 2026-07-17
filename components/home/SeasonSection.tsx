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

const pad2 = (n: number) => String(n).padStart(2, '0')

// Section 4 — "THE SEASON". The season as a typographic index the scroll
// drives through: no cards, each round is an outline numeral + Bebas
// circuit + mono date (+ winner surname once a round is history). The red
// line is the BASELINE the type sits on — it draws to a tip that holds
// station in the viewport while the strip flows past, and the mono counter
// riding the tip ticks "09 / 24" as rounds cross it. Reduced motion and
// touch fall back to a native horizontal scroller driving the same tip.
export default function SeasonSection({
  rounds,
  winners = {},
}: {
  rounds: SeasonRound[]
  winners?: Record<number, string>
}) {
  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)
  const counterRef = useRef<HTMLDivElement>(null)

  const total = rounds.length
  const completed = rounds.filter((r) => r.isPast && !r.isCancelled).length
  const seasonYear = rounds[0]?.meeting.year ?? null

  useGSAP(
    () => {
      const section = sectionRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      const line = lineRef.current
      const counter = counterRef.current
      if (!section || !viewport || !track || !line || !counter) return

      const items = () => [...track.querySelectorAll<HTMLElement>('[data-round]')]

      // Cached per-round measurements (track space) + the elements the
      // tip-focus effect writes to. Re-measured on ScrollTrigger refresh.
      interface RoundMeasure {
        el: HTMLElement
        left: number
        center: number
        base: number
        dimEls: HTMLElement[]
        winEl: HTMLElement | null
      }
      let measures: RoundMeasure[] = []
      const measure = () => {
        measures = items().map((el) => ({
          el,
          left: el.offsetLeft,
          center: el.offsetLeft + el.offsetWidth / 2,
          base: parseFloat(el.dataset.dim ?? '1'),
          dimEls: [...el.querySelectorAll<HTMLElement>('[data-dim-el]')],
          winEl: el.querySelector<HTMLElement>('[data-win]'),
        }))
      }

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      // Focus zone around the tip: the round under the "cursor of time"
      // scales to 1.06 and brightens to full, easing off with distance.
      // Skipped entirely under reduced motion.
      const FOCUS_ZONE = 300
      const WINNER_BASE = 0.55

      // Everything below writes only transforms/opacity/text at a given tip
      // position (in track space): line scaleX, counter x, focus per round.
      let lastCount = -1
      const setTip = (tipX: number) => {
        if (measures.length === 0) measure()
        const width = track.scrollWidth
        const clamped = Math.max(0, Math.min(tipX, width))
        line.style.transform = `scaleX(${clamped / width})`
        counter.style.transform = `translateX(${clamped}px)`
        const count = measures.filter((m) => m.left + 16 < clamped).length
        if (count !== lastCount) {
          lastCount = count
          counter.textContent = `${pad2(count)} / ${pad2(total)}`
        }
        if (reduced) return
        for (const m of measures) {
          const t = Math.max(0, 1 - Math.abs(m.center - clamped) / FOCUS_ZONE)
          const e = t * t * (3 - 2 * t) // smoothstep — focus, not a carousel
          m.el.style.transform = e > 0 ? `scale(${1 + 0.06 * e})` : ''
          const dim = m.base + (1 - m.base) * e
          for (const d of m.dimEls) d.style.opacity = String(dim)
          if (m.winEl) m.winEl.style.opacity = String(WINNER_BASE + (1 - WINNER_BASE) * e)
        }
      }

      if (reduced) {
        // Static, meaningful: tip parked at the next round, counter shows
        // the season's real completed count.
        measure()
        const next = measures.find((m) => m.el.dataset.round === 'next')
        setTip(next ? next.left : track.scrollWidth * (completed / Math.max(1, total)))
        counter.textContent = `${pad2(completed)} / ${pad2(total)}`
        return
      }

      const mm = gsap.matchMedia()

      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth)
        const anchor = () => viewport.clientWidth * 0.58
        gsap.fromTo(
          track,
          { x: 0 },
          {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: () => `+=${Math.max(window.innerHeight, distance() * 0.55)}`,
              pin: true,
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate: (st) => setTip(st.progress * distance() + anchor()),
              onRefresh: (st) => {
                measure()
                setTip(st.progress * distance() + anchor())
              },
            },
          }
        )
      })

      mm.add('(max-width: 767px), (hover: none)', () => {
        const anchor = () => viewport.clientWidth * 0.5
        const onScroll = () => setTip(viewport.scrollLeft + anchor())
        onScroll()
        viewport.addEventListener('scroll', onScroll, { passive: true })
        return () => viewport.removeEventListener('scroll', onScroll)
      })

      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [total, completed] }
  )

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[100dvh] flex-col overflow-hidden"
    >
      {/* massive dim outline season year, anchored behind, off-center —
          top-right so it balances the low-left strip diagonally */}
      {seasonYear !== null && (
        <span
          aria-hidden
          className="outline-numeral absolute -right-[6vw] top-[4vh] z-0 leading-none"
          style={{
            fontSize: 'clamp(15rem, 36vw, 44rem)',
            WebkitTextStroke: '1px rgba(245,245,243,0.09)',
          }}
        >
          {seasonYear}
        </span>
      )}

      <div className="relative z-10 px-6 pt-24 md:px-14">
        <FadeUp>
          <p className="label-mono text-[var(--text-dim)]">
            THE SEASON — {pad2(total)} ROUNDS
          </p>
        </FadeUp>
      </div>

      {/* index strip planted on the baseline */}
      <div className="relative z-10 flex flex-1 items-end pb-[12vh]">
        <div
          ref={viewportRef}
          className="w-full overflow-x-auto md:overflow-x-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <div ref={trackRef} className="relative w-max pb-10 pl-6 pr-[40vw] md:pl-14">
            <div className="flex items-end">
              {rounds.map(({ meeting, isPast, isNext, isCancelled }, i) => {
                const winner = !isCancelled && isPast ? winners[meeting.meeting_key] : undefined
                // Dim lives on the sub-elements (not the container) so the
                // winner record can exceed it and the tip focus can brighten
                // everything independently.
                const dim = isCancelled ? 0.25 : isPast ? 0.35 : 1
                return (
                  <div
                    key={meeting.meeting_key}
                    data-round={isNext ? 'next' : ''}
                    data-dim={dim}
                    className="shrink-0 pb-5 pr-[7vw]"
                    style={{ transformOrigin: 'left bottom' }}
                  >
                    <span
                      aria-label={`Round ${i + 1}`}
                      data-dim-el
                      className={`block ${isNext ? 'leading-none' : 'outline-numeral leading-none'}`}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(5rem, 10vw, 10rem)',
                        opacity: dim,
                        ...(isNext ? { color: 'var(--accent)' } : {}),
                      }}
                    >
                      {pad2(i + 1)}
                    </span>
                    <p
                      data-dim-el
                      className={`mt-1 flex items-center gap-2.5 uppercase leading-none text-[var(--text)] ${
                        isCancelled ? 'line-through decoration-1' : ''
                      }`}
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(1.6rem, 2.4vw, 2.4rem)',
                        opacity: dim,
                      }}
                    >
                      {meeting.circuit_short_name}
                      {isNext && (
                        <span
                          className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]"
                          aria-label="Next race"
                        />
                      )}
                    </p>
                    {winner && (
                      <p
                        data-win
                        className="label-mono mt-2 text-[var(--text)]"
                        style={{ opacity: 0.55 }}
                      >
                        P1 · {winner}
                      </p>
                    )}
                    <p
                      data-dim-el
                      className="label-mono mt-2 text-[var(--text-dim)]"
                      style={{ opacity: dim }}
                    >
                      {isCancelled
                        ? 'CANCELLED'
                        : new Date(meeting.date_start)
                            .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                            .toUpperCase()}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* the baseline the type sits on — hairline + red data line +
                tip counter, all absolutely positioned against the wrapper's
                border box so they share the same coordinate space as
                scrollWidth and the items' offsetLeft measurements */}
            <div className="absolute bottom-10 left-0 h-px w-full bg-[var(--line)]" />
            <div
              ref={lineRef}
              className="absolute bottom-10 left-0 h-px w-full origin-left bg-[var(--accent)]"
              style={{ transform: 'scaleX(0)' }}
            />
            <div
              ref={counterRef}
              className="label-mono absolute bottom-4 left-0 whitespace-nowrap pl-2 text-[var(--accent)]"
              style={{ transform: 'translateX(0)' }}
            >
              {pad2(completed)} / {pad2(total)}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
