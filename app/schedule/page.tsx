'use client'

import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions, getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import { getCurrentMeeting, getNextMeeting, CANCELLED_COUNTRIES, fetchAllSessionResults } from '@/lib/openf1'
import { circuitImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'
import { FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const SESSION_SHORT: Record<string, string> = {
  'Practice 1': 'FP1',
  'Practice 2': 'FP2',
  'Practice 3': 'FP3',
  'Sprint Shootout': 'SQ',
  'Sprint': 'SPRINT',
  'Qualifying': 'QUALI',
  'Race': 'RACE',
}

function getSessionStatus(session: Session): 'live' | 'completed' | 'upcoming' {
  const now = new Date()
  const start = new Date(session.date_start)
  const end = new Date(session.date_end)
  if (start <= now && now < end) return 'live'
  if (end < now) return 'completed'
  return 'upcoming'
}

function formatSessionTime(dateStr: string): string {
  const d = new Date(dateStr)
  const day = d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${day} ${time}`
}

function formatMeetingDates(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} — ${e.toLocaleDateString('en-US', opts)}`.toUpperCase()
}

const surname = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function SchedulePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessionsByMeeting, setSessionsByMeeting] = useState<Record<number, Session[]>>({})
  const [loading, setLoading] = useState(true)
  // meeting_key → winner surname (same cached fetchers as the home index)
  const [winners, setWinners] = useState<Record<number, string>>({})
  const apiBlocked = useApiBlocked()

  const timelineRef = useRef<HTMLDivElement>(null)
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()]).then(([mtgs, sessions]) => {
      setMeetings(mtgs)
      setSessionsByMeeting(
        sessions.reduce<Record<number, Session[]>>((acc, s) => {
          if (!acc[s.meeting_key]) acc[s.meeting_key] = []
          acc[s.meeting_key].push(s)
          return acc
        }, {})
      )
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let alive = true
    getCachedSessions()
      .then(async (allSessions: Session[]) => {
        const now = new Date()
        const raceSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Race' &&
            new Date(s.date_end) < now &&
            !CANCELLED_COUNTRIES.has(s.country_name)
        )
        if (raceSessions.length === 0) return
        const latest = [...raceSessions].sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )[0]
        const [drivers, resultsMap] = await Promise.all([
          getCachedDrivers(latest.session_key),
          fetchAllSessionResults(raceSessions.map((s) => s.session_key), getCachedSessionResult),
        ])
        if (!alive) return
        const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))
        const map: Record<number, string> = {}
        for (const s of raceSessions) {
          const first = resultsMap.get(s.session_key)?.find((r) => r.position === 1)
          const info = first ? driverMap.get(first.driver_number) : undefined
          if (info?.full_name) map[s.meeting_key] = surname(info.full_name)
        }
        if (Object.keys(map).length > 0) setWinners(map)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const testingMeetings = meetings.filter(
    (m) =>
      m.meeting_name.toLowerCase().includes('testing') ||
      m.meeting_name.toLowerCase().includes('pre-season')
  )
  const raceMeetings = meetings
    .filter(
      (m) =>
        !m.meeting_name.toLowerCase().includes('testing') &&
        !m.meeting_name.toLowerCase().includes('pre-season')
    )
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())

  const activeMeetings = raceMeetings.filter((m) => !CANCELLED_COUNTRIES.has(m.country_name))
  const targetMeeting = getCurrentMeeting(activeMeetings) ?? getNextMeeting(activeMeetings)
  const pastFraction =
    raceMeetings.length > 0
      ? raceMeetings.filter((m) => new Date(m.date_end).getTime() < Date.now()).length /
        raceMeetings.length
      : 0

  // The red line draws down the spine as you scroll the timeline.
  useGSAP(
    () => {
      const timeline = timelineRef.current
      const line = lineRef.current
      if (!timeline || !line || raceMeetings.length === 0) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(line, { scaleY: pastFraction })
        return
      }
      gsap.fromTo(
        line,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: timeline,
            start: 'top 72%',
            end: 'bottom 85%',
            scrub: 0.4,
          },
        }
      )
    },
    { scope: timelineRef, dependencies: [raceMeetings.length] }
  )

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
        <div className="mt-10 space-y-8">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
        <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING THE SEASON…</p>
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
        {!apiBlocked && <p className="label-mono text-[var(--text-dim)]">NO SCHEDULE DATA YET</p>}
      </div>
    )
  }

  const seasonYear = raceMeetings[0]?.year

  return (
    <div className="relative overflow-x-clip px-6 pb-32 pt-20 md:px-14">
      <FadeUp>
        <p className="label-mono text-[var(--text-dim)]">
          THE CALENDAR{seasonYear ? ` — ${seasonYear}` : ''} · {pad2(raceMeetings.length)} ROUNDS
        </p>
      </FadeUp>

      {/* pre-season testing — quiet mono prologue */}
      {testingMeetings.length > 0 && (
        <div className="mt-10 space-y-2">
          {testingMeetings.map((m) => (
            <p key={m.meeting_key} className="label-mono text-[var(--text-dim)]">
              PRE-SEASON — {m.circuit_short_name.toUpperCase()} ·{' '}
              {formatMeetingDates(m.date_start, m.date_end)}
            </p>
          ))}
        </div>
      )}

      {/* ─── the timeline ─── */}
      <div ref={timelineRef} className="relative mt-16">
        {/* spine + drawing red line */}
        <div className="absolute bottom-0 left-3 top-0 w-px bg-[var(--line)] md:left-1/2" />
        <div
          ref={lineRef}
          className="absolute bottom-0 left-3 top-0 w-px origin-top bg-[var(--accent)] md:left-1/2"
          style={{ transform: 'scaleY(0)' }}
        />

        <div className="space-y-20 md:space-y-28">
          {raceMeetings.map((m, i) => {
            const isCancelled = CANCELLED_COUNTRIES.has(m.country_name)
            const isPast = new Date(m.date_end).getTime() < Date.now()
            const isNext = targetMeeting?.meeting_key === m.meeting_key
            const winner = !isCancelled && isPast ? winners[m.meeting_key] : undefined
            const dim = isCancelled ? 0.25 : isPast ? 0.35 : 1
            const right = i % 2 === 1
            const sessions = (sessionsByMeeting[m.meeting_key] ?? []).sort(
              (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
            )
            return (
              <div key={m.meeting_key} className="relative md:grid md:grid-cols-2 md:gap-x-20">
                {/* node on the spine */}
                <span
                  aria-hidden
                  className={`absolute left-3 top-4 h-2 w-2 -translate-x-1/2 rounded-full md:left-1/2 ${
                    isNext
                      ? 'animate-pulse bg-[var(--accent)] motion-reduce:animate-none'
                      : 'bg-[rgba(245,245,243,0.25)]'
                  }`}
                />

                <div
                  className={`pl-10 md:pl-0 ${
                    right
                      ? 'md:col-start-2 md:pl-20'
                      : 'md:col-start-1 md:flex md:flex-col md:items-end md:pr-20 md:text-right'
                  }`}
                >
                  {circuitImage(m.country_name) && (
                    <div className={right ? '' : 'md:flex md:justify-end'} style={{ opacity: dim }}>
                      <TreatedImage
                        src={circuitImage(m.country_name)}
                        treatment="line"
                        fade={false}
                        position={right ? 'left center' : 'right center'}
                        sizes="120px"
                        className="mb-4 h-14 w-24 md:h-16 md:w-28"
                      />
                    </div>
                  )}

                  <span
                    aria-label={`Round ${i + 1}`}
                    className={isNext ? 'block leading-[0.85]' : 'outline-numeral block leading-[0.85]'}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
                      opacity: isNext ? 1 : dim,
                      ...(isNext ? { color: 'var(--accent)' } : {}),
                    }}
                  >
                    {pad2(i + 1)}
                  </span>

                  <p
                    className={`mt-2 uppercase leading-none text-[var(--text)] ${
                      isCancelled ? 'line-through decoration-1' : ''
                    }`}
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(1.9rem, 3.6vw, 3.2rem)',
                      opacity: dim,
                    }}
                  >
                    {m.circuit_short_name}
                  </p>

                  <p className="label-mono mt-3 text-[var(--text-dim)]" style={{ opacity: dim }}>
                    {m.country_name.toUpperCase()} · {formatMeetingDates(m.date_start, m.date_end)}
                    {isCancelled ? ' · CANCELLED' : ''}
                  </p>

                  {/* the season-record rule: winner stays legible above the dim */}
                  {winner && (
                    <p className="label-mono mt-2 text-[var(--text)]" style={{ opacity: 0.55 }}>
                      P1 · {winner}
                    </p>
                  )}

                  {/* compact mono session table */}
                  {!isCancelled && sessions.length > 0 && (
                    <div
                      className={`mt-6 w-full max-w-[300px] space-y-1.5 ${right ? '' : 'md:ml-auto'}`}
                      style={{ opacity: dim }}
                    >
                      {sessions.map((s) => {
                        const status = getSessionStatus(s)
                        return (
                          <div
                            key={s.session_key}
                            className="label-mono flex items-center justify-between gap-6 border-b border-[var(--line)] pb-1.5"
                          >
                            <span
                              className={
                                status === 'live'
                                  ? 'flex items-center gap-2 text-[var(--accent)]'
                                  : status === 'completed'
                                  ? 'text-[var(--text-dim)]'
                                  : 'text-[var(--text)]'
                              }
                            >
                              {status === 'live' && (
                                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
                              )}
                              {SESSION_SHORT[s.session_name] ?? s.session_name.toUpperCase()}
                            </span>
                            <span className="tabular-nums text-[var(--text-dim)]">
                              {formatSessionTime(s.date_start)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
