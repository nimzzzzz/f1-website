'use client'

import { useEffect, useRef, useState, type MouseEvent } from 'react'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions, getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import { isCancelled, fetchAllSessionResults } from '@/lib/openf1'
import { type FetchFailureReason, unavailableMessage } from '@/lib/fetch-result'
import { getLenis } from '@/lib/lenis-store'
import { formatScheduleDates, type ScheduleTimeMode } from '@/lib/schedule-time'
import ScheduleRound from './ScheduleRound'
import { useScheduleMotion } from './useScheduleMotion'
import './schedule.css'

const surname = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

const pad2 = (n: number) => String(n).padStart(2, '0')

const groupSessions = (sessions: Session[]) => sessions.reduce<Record<number, Session[]>>((groups, session) => {
  ;(groups[session.meeting_key] ??= []).push(session)
  return groups
}, {})

export interface ScheduleSnapshot {
  meetings: Meeting[]
  sessions: Session[]
  winnersByRound: Record<number, string>
  renderedAt: number
}

export default function ScheduleClient({ initialData }: { initialData: ScheduleSnapshot | null }) {
  const [meetings, setMeetings] = useState<Meeting[]>(() => initialData?.meetings ?? [])
  const [sessionsByMeeting, setSessionsByMeeting] = useState(() => groupSessions(initialData?.sessions ?? []))
  const [loading, setLoading] = useState(!initialData)
  // meeting_key → winner surname (same cached fetchers as the home index)
  const [winners, setWinners] = useState<Record<number, string>>(() => initialData?.winnersByRound ?? {})
  // Set when the calendar could not be fetched at all — kept apart from
  // "the calendar came back empty".
  const [unavailable, setUnavailable] = useState<FetchFailureReason | undefined>(undefined)
  const [timeMode, setTimeMode] = useState<ScheduleTimeMode>('local')
  const [localZone, setLocalZone] = useState('UTC')
  const [now, setNow] = useState(() => initialData?.renderedAt ?? Date.now())

  const timelineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setNow(Date.now())
    setLocalZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
    try {
      if (localStorage.getItem('lights-out:schedule-time') === 'track') setTimeMode('track')
    } catch { /* Clock controls also work when storage is unavailable. */ }
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  const chooseTime = (mode: ScheduleTimeMode) => {
    setTimeMode(mode)
    try { localStorage.setItem('lights-out:schedule-time', mode) } catch { /* Optional persistence. */ }
  }

  const jumpToWeekend = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = document.getElementById(event.currentTarget.hash.slice(1))
    if (!target) return
    event.preventDefault()
    window.history.replaceState(window.history.state, '', event.currentTarget.hash)
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const lenis = getLenis()
    if (lenis && !reduce) {
      lenis.scrollTo(target, { offset: -110, duration: 1.15, onComplete: () => target.focus({ preventScroll: true }) })
    } else {
      target.focus({ preventScroll: true })
      target.scrollIntoView({ block: 'start', behavior: 'instant' })
    }
  }

  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([mtgRes, sessionRes]) => {
        // A failed calendar fetch is NOT an empty calendar. Leaving the
        // state untouched means the "no schedule" copy below can only be
        // reached by a successful, genuinely empty response.
        if (!mtgRes.ok || !sessionRes.ok) {
          setUnavailable((!mtgRes.ok && mtgRes.reason) || (!sessionRes.ok ? sessionRes.reason : undefined))
          return
        }
        setUnavailable(undefined)
        setMeetings(mtgRes.rows)
        setSessionsByMeeting(groupSessions(sessionRes.rows))
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    let alive = true
    getCachedSessions()
      .then(async (sessionRes) => {
        if (!sessionRes.ok) return
        const now = new Date()
        const raceSessions = sessionRes.rows.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Race' &&
            new Date(s.date_end) < now &&
            !isCancelled(s)
        )
        if (raceSessions.length === 0) return
        const latest = [...raceSessions].sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )[0]
        const [driverRes, resultsMap] = await Promise.all([
          getCachedDrivers(latest.session_key),
          fetchAllSessionResults(raceSessions.map((s) => s.session_key), getCachedSessionResult),
        ])
        if (!alive || !driverRes.ok) return
        const driverMap = new Map(driverRes.rows.map((d) => [d.driver_number, d]))
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

  const activeMeetings = raceMeetings.filter((m) => !isCancelled(m))
  // Use the same timestamp on the server and first client render. The
  // clock effect updates it on mount and while the page stays open.
  const targetMeeting = activeMeetings.find((meeting) => Date.parse(meeting.date_start) <= now && now < Date.parse(meeting.date_end))
    ?? activeMeetings.find((meeting) => Date.parse(meeting.date_start) > now)
  useScheduleMotion(timelineRef, raceMeetings.map((meeting) => `${meeting.meeting_key}:${isCancelled(meeting)}:${meeting.meeting_key === targetMeeting?.meeting_key}`).join(','))

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
        {unavailable ? (
          <p className="label-mono border-l-2 border-[var(--accent)] pl-4 text-[var(--accent-text)]" role="status">
            {unavailableMessage(unavailable, false, 'CALENDAR')}
          </p>
        ) : (
          <p className="label-mono text-[var(--text-dim)]">NO SCHEDULE DATA YET</p>
        )}
      </div>
    )
  }

  const cancelledCount = raceMeetings.length - activeMeetings.length
  const seasonYear = raceMeetings[0]?.year

  let scoredRound = 0

  return (
    <div className="schedule-page relative overflow-x-clip px-6 pb-32 pt-20 md:px-14">
      <h1 className="strip-header text-[var(--text-dim)]">
        THE CALENDAR{seasonYear ? ` — ${seasonYear}` : ''} — {pad2(activeMeetings.length)} ROUNDS
        {cancelledCount > 0 ? ` · ${cancelledCount} CANCELLED` : ''}
      </h1>

      <div className="schedule-tools">
        <div className="schedule-clock">
          <div className="schedule-clock-options" role="group" aria-label="Schedule time zone">
            <button type="button" aria-pressed={timeMode === 'local'} onClick={() => chooseTime('local')}>Your time</button>
            <button type="button" aria-pressed={timeMode === 'track'} onClick={() => chooseTime('track')}>Track time</button>
          </div>
          <p className="schedule-clock-description" aria-live="polite">
            {timeMode === 'local' ? localZone.replaceAll('_', ' ') : 'Local time at each circuit'}
          </p>
        </div>
        {targetMeeting && (
          <a className="schedule-jump" href={`#round-${targetMeeting.meeting_key}`} onClick={jumpToWeekend}>
            Jump to {Date.parse(targetMeeting.date_start) <= now ? 'current' : 'next'} weekend
            <span className="schedule-jump-circuit">{targetMeeting.circuit_short_name}</span>
          </a>
        )}
      </div>

      {testingMeetings.length > 0 && (
        <div className="schedule-testing">
          {testingMeetings.map((meeting) => (
            <p key={meeting.meeting_key} className="label-mono text-[var(--text-dim)]">
              PRE-SEASON — {meeting.circuit_short_name.toUpperCase()} ·{' '}
              {formatScheduleDates(meeting.date_start, meeting.date_end, timeMode, meeting.gmt_offset, localZone)}
            </p>
          ))}
        </div>
      )}

      <div ref={timelineRef} className="schedule-timeline">
        <div className="schedule-spine" aria-hidden="true" />
        <div className="schedule-progress" aria-hidden="true" />
        <div className="schedule-rounds">
          {raceMeetings.map((meeting, index) => {
            if (!isCancelled(meeting)) scoredRound += 1
            return (
              <ScheduleRound
                key={meeting.meeting_key}
                meeting={meeting}
                sessions={[...(sessionsByMeeting[meeting.meeting_key] ?? [])].sort((a, b) => Date.parse(a.date_start) - Date.parse(b.date_start))}
                winner={winners[meeting.meeting_key]}
                roundNo={scoredRound}
                index={index}
                isTarget={meeting.meeting_key === targetMeeting?.meeting_key}
                now={now}
                timeMode={timeMode}
                localZone={localZone}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}
