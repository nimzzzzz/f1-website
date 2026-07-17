'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Meeting, Session, SessionResult } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import {
  getRaceMeetings,
  isMeetingCompleted,
  getCurrentMeeting,
  getNextMeeting,
  CANCELLED_COUNTRIES,
  fetchAllSessionResults,
} from '@/lib/openf1'
import { getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import IntroSequence, { type RevealMode } from '@/components/IntroSequence'
import NowSection from '@/components/home/NowSection'
import FightSection, { type FightRow } from '@/components/home/FightSection'
import LastRaceSection, { type PodiumRow } from '@/components/home/LastRaceSection'
import SeasonSection from '@/components/home/SeasonSection'
import HomeFooter from '@/components/home/HomeFooter'

interface LastRaceData {
  label: string
  podium: PodiumRow[]
}

// Staggered reveal wrapper for the intro handoff: content mounts hidden
// behind the intro overlay and cascades in when the intro hands off.
// 'instant' (reduced motion) shows content with no animation.
function Reveal({ order, state, children }: {
  order: number
  state: 'hidden' | RevealMode
  children: ReactNode
}) {
  return (
    <motion.div
      initial={false}
      animate={state === 'hidden' ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
      transition={
        state === 'instant'
          ? { duration: 0 }
          : { duration: 0.7, delay: order * 0.18, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  )
}

// react-dom's float preload API (present in the React canary Next 14 ships,
// but missing from @types/react-dom@18, hence the loose typing).
const preloadAsset = (
  ReactDOM as unknown as {
    preload?: (href: string, opts: { as: string; type?: string; fetchPriority?: string }) => void
  }
).preload

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

function gapLabel(gap: SessionResult['gap_to_leader']): string {
  if (gap === null || gap === undefined) return '—'
  if (Array.isArray(gap)) {
    const laps = gap[0] ?? 1
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`
  }
  return `+${gap.toFixed(3)}S`
}

export default function HomePage() {
  // Start the poster fetch while the HTML is still streaming — called during
  // render so SSR hoists <link rel="preload"> into <head>. The video itself
  // is NOT link-preloaded: measured in Chromium, as="video" preloads are
  // never fetched and as="fetch" preloads double-download alongside the
  // media request. The webm loads early because IntroSequence SSRs the
  // <video> element, which the browser's preload scanner picks up at parse.
  preloadAsset?.('/intro/poster.jpg', { as: 'image', fetchPriority: 'high' })

  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [fight, setFight] = useState<FightRow[] | null>(null)
  const [lastRace, setLastRace] = useState<LastRaceData | null>(null)
  // meeting_key → winner surname, for the season index (derived from the
  // same session results the standings math already fetches)
  const [winners, setWinners] = useState<Record<number, string>>({})
  // Cinematic intro overlay — plays on every visit to /; data fetching below
  // runs in parallel behind it.
  const [introActive, setIntroActive] = useState(true)
  const [reveal, setReveal] = useState<'hidden' | RevealMode>('hidden')

  const handleIntroReveal = useCallback((mode: RevealMode) => setReveal(mode), [])
  const handleIntroDone = useCallback(() => {
    setIntroActive(false)
    // Safety net: never leave content hidden once the overlay is gone
    setReveal((r) => (r === 'hidden' ? 'cascade' : r))
  }, [])

  // Phase 1: fetch meetings + sessions, then show the page immediately
  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([m, s]) => { setMeetings(m); setSessions(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Phase 2: compute championship top 3 + last race podium in the background
  // (same fetches as before — standings from race/sprint results)
  useEffect(() => {
    if (sessions.length === 0 || meetings.length === 0) return
    const now = new Date()
    const notCancelled = (x: Session) => !CANCELLED_COUNTRIES.has(x.country_name)

    const completedRaceSessions = sessions.filter(
      x => x.session_type === 'Race' && x.session_name === 'Race' && new Date(x.date_end) < now && notCancelled(x)
    )
    const completedSprintSessions = sessions.filter(
      x => x.session_type === 'Race' && x.session_name === 'Sprint' && new Date(x.date_end) < now && notCancelled(x)
    )
    if (completedRaceSessions.length === 0) return

    const latestRace = [...completedRaceSessions].sort(
      (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    )[0]

    const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]
    const allSessionKeys = allPointsSessions.map(x => x.session_key)

    Promise.all([
      getCachedDrivers(latestRace.session_key),
      fetchAllSessionResults(allSessionKeys, getCachedSessionResult),
    ]).then(([drivers, resultsMap]) => {
      const driverMap = new Map(drivers.map(d => [d.driver_number, d]))
      const standings = new Map<number, { points: number; wins: number }>()

      for (const session of allPointsSessions) {
        const results = resultsMap.get(session.session_key)
        if (!results) continue
        for (const r of results) {
          const cur = standings.get(r.driver_number) ?? { points: 0, wins: 0 }
          cur.points += r.points ?? 0
          if (r.position === 1 && session.session_name === 'Race') cur.wins++
          standings.set(r.driver_number, cur)
        }
      }

      const top3: FightRow[] = [...standings.entries()]
        .sort((a, b) => b[1].points - a[1].points)
        .slice(0, 3)
        .map(([driverNumber, s], i) => {
          const info = driverMap.get(driverNumber)
          const fullName = info?.full_name ?? `Driver #${driverNumber}`
          return {
            position: i + 1,
            surname: surnameOf(fullName),
            fullName,
            points: s.points,
            wins: s.wins,
          }
        })
      if (top3.length > 0) setFight(top3)

      // Race winner per meeting, for THE SEASON index
      const winnersMap: Record<number, string> = {}
      for (const session of completedRaceSessions) {
        const results = resultsMap.get(session.session_key)
        const first = results?.find(r => r.position === 1)
        const info = first ? driverMap.get(first.driver_number) : undefined
        if (info?.full_name) winnersMap[session.meeting_key] = surnameOf(info.full_name)
      }
      if (Object.keys(winnersMap).length > 0) setWinners(winnersMap)

      // Last time out: podium of the most recent completed grand prix
      const latestResults = resultsMap.get(latestRace.session_key)
      const latestMeeting = meetings.find(m => m.meeting_key === latestRace.meeting_key)
      if (latestResults && latestMeeting) {
        const podium: PodiumRow[] = latestResults
          .filter(r => r.position !== null && r.position <= 3)
          .sort((a, b) => (a.position ?? 9) - (b.position ?? 9))
          .map(r => {
            const info = driverMap.get(r.driver_number)
            const fullName = info?.full_name ?? `Driver #${r.driver_number}`
            return {
              position: r.position ?? 0,
              surname: surnameOf(fullName),
              fullName,
              gapLabel: r.position === 1 ? '' : gapLabel(r.gap_to_leader),
            }
          })
        if (podium.length > 0) {
          setLastRace({
            label: latestMeeting.meeting_name.replace(/grand prix/i, 'GP').toUpperCase(),
            podium,
          })
        }
      }
    })
  }, [sessions, meetings])

  // Sections 2–3 mount after their data arrives, which changes the page
  // height above the pinned season strip — recompute trigger positions.
  useEffect(() => {
    if (fight || lastRace || Object.keys(winners).length > 0) {
      requestAnimationFrame(() => ScrollTrigger.refresh())
    }
  }, [fight, lastRace, winners])

  // Keep the intro at ONE stable tree position across the loading flip —
  // rendering it from two different return statements remounts it (and the
  // video) when `loading` changes.
  const intro = introActive && (
    <IntroSequence key="intro" onReveal={handleIntroReveal} onDone={handleIntroDone} />
  )

  const skeleton = (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
      <div className="h-3 w-40 animate-pulse rounded bg-white/5" />
      <div className="mt-8 h-28 w-[70%] animate-pulse rounded bg-white/5 md:h-44" />
      <div className="mt-6 h-4 w-64 animate-pulse rounded bg-white/5" />
      <div className="mt-14 flex gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-20 w-24 animate-pulse rounded bg-white/5" />
        ))}
      </div>
    </div>
  )

  const raceMeetings = getRaceMeetings(meetings).sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )
  // Exclude cancelled races from countdown + race weekend logic
  const activeMeetings = meetings.filter((m) => !CANCELLED_COUNTRIES.has(m.country_name))
  const currentMeeting = getCurrentMeeting(activeMeetings)
  const nextMeeting = getNextMeeting(activeMeetings)
  const targetMeeting = currentMeeting ?? nextMeeting
  const isLiveWeekend = currentMeeting !== null

  const raceSession = targetMeeting
    ? sessions.find(
        (s) => s.meeting_key === targetMeeting.meeting_key && s.session_name === 'Race'
      ) ?? null
    : null

  const roundNumber = targetMeeting
    ? raceMeetings.findIndex((m) => m.meeting_key === targetMeeting.meeting_key) + 1
    : null

  const seasonRounds = raceMeetings.map((m) => ({
    meeting: m,
    isPast: isMeetingCompleted(m),
    isNext: targetMeeting?.meeting_key === m.meeting_key,
    isCancelled: CANCELLED_COUNTRIES.has(m.country_name),
  }))

  const seasonYear = raceMeetings[0]?.year ?? null

  return (
    <>
      {intro}
      {loading ? skeleton : (
        <>
          {/* ─── Section 1: NOW ─── */}
          <Reveal order={0} state={reveal}>
            {targetMeeting && roundNumber !== null ? (
              <NowSection
                meeting={targetMeeting}
                raceSession={raceSession}
                round={roundNumber}
                totalRounds={raceMeetings.length}
                isLive={isLiveWeekend}
              />
            ) : (
              <section className="flex min-h-[calc(100dvh-4rem)] items-center px-6 md:px-14">
                <h1
                  className="uppercase text-[var(--text)]"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(4rem, 12vw, 13rem)',
                    lineHeight: 0.85,
                  }}
                >
                  Season complete
                </h1>
              </section>
            )}
          </Reveal>

          {/* ─── Section 2: THE FIGHT ─── */}
          {fight && (
            <Reveal order={1} state={reveal}>
              <FightSection rows={fight} />
            </Reveal>
          )}

          {/* ─── Section 3: LAST TIME OUT ─── */}
          {lastRace && (
            <Reveal order={2} state={reveal}>
              <LastRaceSection raceLabel={lastRace.label} podium={lastRace.podium} />
            </Reveal>
          )}

          {/* ─── Section 4: THE SEASON ───
              Not wrapped in Reveal (pins must not live inside a transformed
              ancestor). The plain div is load-bearing: ScrollTrigger's pin
              reparents the section into a pin-spacer, and React must never
              use that moved node as an insertBefore reference when the data
              sections above mount late — the wrapper stays React-owned. */}
          {seasonRounds.length > 0 && (
            <div>
              <SeasonSection rounds={seasonRounds} winners={winners} />
            </div>
          )}

          <HomeFooter seasonYear={seasonYear} />
        </>
      )}
    </>
  )
}
