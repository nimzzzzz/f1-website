'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import type { Driver, Session } from '@/lib/openf1'
import { getCachedLatestDrivers, getCachedSessions, getCachedSessionResult } from '@/lib/client-cache'
import { CANCELLED_COUNTRIES, fetchAllSessionResults } from '@/lib/openf1'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

gsap.registerPlugin(ScrollTrigger, useGSAP)

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function DriversPage() {
  const [unique, setUnique] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  // Championship points per driver — enrichment via the same cached fetchers
  // the standings page uses (shared request cache, no new fetch pattern).
  const [points, setPoints] = useState<Map<number, number> | null>(null)
  const apiBlocked = useApiBlocked()

  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      setUnique(
        deduplicateDrivers(drivers).sort((a, b) => {
          if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name)
          return a.driver_number - b.driver_number
        })
      )
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let alive = true
    getCachedSessions()
      .then(async (allSessions: Session[]) => {
        const now = new Date()
        const pointsSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            (s.session_name === 'Race' || s.session_name === 'Sprint') &&
            new Date(s.date_end) < now &&
            !CANCELLED_COUNTRIES.has(s.country_name)
        )
        if (pointsSessions.length === 0) return
        const resultsMap = await fetchAllSessionResults(
          pointsSessions.map((s) => s.session_key),
          getCachedSessionResult
        )
        if (!alive) return
        const tally = new Map<number, number>()
        for (const s of pointsSessions) {
          for (const r of resultsMap.get(s.session_key) ?? []) {
            tally.set(r.driver_number, (tally.get(r.driver_number) ?? 0) + (r.points ?? 0))
          }
        }
        if (tally.size > 0) setPoints(tally)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // Championship order when points are known; the existing team order otherwise.
  const ordered = points
    ? [...unique].sort(
        (a, b) => (points.get(b.driver_number) ?? 0) - (points.get(a.driver_number) ?? 0)
      )
    : unique

  // The pin is created ONCE per mount (recreating a pinned ScrollTrigger on
  // dependency changes leaves a stale pin-spacer behind and breaks the fixed
  // coordinates). Reorders flow through this ref; the rail reads it live.
  const orderedRef = useRef(ordered)
  orderedRef.current = ordered
  const hasDrivers = ordered.length > 0

  useGSAP(
    () => {
      const section = sectionRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      const rail = railRef.current
      if (!section || !viewport || !track || !hasDrivers) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth)
        let lastIdx = -1
        const setPanel = (progress: number) => {
          const list = orderedRef.current
          if (!rail || list.length === 0) return
          const idx = Math.min(list.length - 1, Math.round(progress * (list.length - 1)))
          if (idx === lastIdx) return
          lastIdx = idx
          const counter = rail.querySelector<HTMLElement>('[data-rail-counter]')
          if (counter) counter.textContent = `${pad2(idx + 1)} / ${pad2(list.length)}`
          rail.querySelectorAll<HTMLElement>('[data-tick]').forEach((t, i) => {
            t.style.backgroundColor =
              i === idx ? `#${list[i]?.team_colour || 'F5F5F3'}` : 'rgba(245,245,243,0.18)'
            t.style.transform = i === idx ? 'scaleY(1.8)' : 'scaleY(1)'
          })
        }
        gsap.fromTo(
          track,
          { x: 0 },
          {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: () => `+=${Math.max(window.innerHeight, distance() * 0.45)}`,
              pin: true,
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate: (st) => setPanel(st.progress),
              onRefresh: (st) => setPanel(st.progress),
            },
          }
        )
      })
      return () => mm.revert()
    },
    { scope: sectionRef, dependencies: [hasDrivers] }
  )

  // Reorder / late points: re-measure trigger positions without recreating
  useEffect(() => {
    if (points) requestAnimationFrame(() => ScrollTrigger.refresh())
  }, [points])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-36 animate-pulse rounded bg-white/5" />
        <div className="mt-10 h-56 w-[70%] animate-pulse rounded bg-white/5" />
        <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING THE GRID…</p>
      </div>
    )
  }

  if (ordered.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        {!apiBlocked && <p className="label-mono text-[var(--text-dim)]">NO DRIVER DATA YET</p>}
      </div>
    )
  }

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <div className="px-6 pt-10 md:px-14">
        <p className="label-mono text-[var(--text-dim)]">
          THE GRID — {pad2(ordered.length)} DRIVERS
          {points ? ' · CHAMPIONSHIP ORDER' : ''}
        </p>
      </div>

      <div ref={viewportRef} className="mt-6 overflow-x-hidden">
        {/* one full-viewport panel per driver: horizontal on desktop,
            a vertical stack on mobile and under reduced motion */}
        <div
          ref={trackRef}
          className="flex w-full flex-col md:w-max md:flex-row motion-reduce:md:w-full motion-reduce:md:flex-col"
        >
          {ordered.map((d, i) => {
            const teamColor = `#${d.team_colour || 'F5F5F3'}`
            const pts = points?.get(d.driver_number)
            return (
              <TransitionLink
                key={d.driver_number}
                href={`/drivers/${d.name_acronym.toLowerCase()}`}
                className="group relative flex min-h-[72vh] w-full shrink-0 flex-col justify-end overflow-hidden border-t border-[var(--line)] px-6 pb-16 pt-10 md:min-h-[calc(100dvh-11rem)] md:w-screen md:border-l md:border-t-0 md:px-14 motion-reduce:md:w-full motion-reduce:md:border-l-0 motion-reduce:md:border-t"
              >
                {/* the race number — massive, outlined in the team's color.
                    Team colors are the dataset here; red stays scarce. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-[2vw] top-1/2 -translate-y-1/2 leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(14rem, 30vw, 26rem)',
                    color: 'transparent',
                    WebkitTextStroke: `2px ${teamColor}`,
                    opacity: 0.55,
                  }}
                >
                  {d.driver_number}
                </span>

                {/* championship index */}
                <span className="label-mono absolute right-6 top-6 text-[var(--text-dim)] md:right-14">
                  {pad2(i + 1)} / {pad2(ordered.length)}
                </span>

                <div className="relative">
                  <p className="label-mono mb-3 text-[var(--text-dim)]">
                    {d.first_name?.toUpperCase()}
                  </p>
                  <p
                    className="uppercase leading-[0.85] text-[var(--text)] transition-transform duration-300 group-hover:translate-x-3 motion-reduce:transition-none"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(3.4rem, 9vw, 9rem)',
                    }}
                  >
                    {d.last_name}
                  </p>
                  <div className="label-mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-[2px] w-3"
                        style={{ backgroundColor: teamColor }}
                      />
                      {d.team_name?.toUpperCase()}
                    </span>
                    {d.country_code && <span>{d.country_code}</span>}
                    {pts !== undefined && (
                      <span className="text-[var(--text)]">{Math.floor(pts)} PTS</span>
                    )}
                    <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                      PROFILE →
                    </span>
                  </div>
                </div>
              </TransitionLink>
            )
          })}
        </div>
      </div>

      {/* progress rail — desktop pinned mode only */}
      <div
        ref={railRef}
        className="absolute inset-x-6 bottom-6 z-10 hidden items-center gap-4 md:inset-x-14 md:flex motion-reduce:md:hidden"
      >
        <div className="flex flex-1 items-center gap-1.5">
          {ordered.map((d, i) => (
            <span
              key={d.driver_number}
              data-tick
              className="h-2 flex-1 origin-bottom transition-[transform,background-color] duration-200"
              style={{
                backgroundColor: i === 0 ? `#${d.team_colour || 'F5F5F3'}` : 'rgba(245,245,243,0.18)',
              }}
            />
          ))}
        </div>
        <span data-rail-counter className="label-mono shrink-0 text-[var(--text-dim)]">
          01 / {pad2(ordered.length)}
        </span>
      </div>
    </section>
  )
}
