'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import ReactDOM from 'react-dom'
import { motion } from 'framer-motion'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import {
  getRaceMeetings,
  isMeetingCompleted,
  getCurrentMeeting,
  getNextMeeting,
  CANCELLED_COUNTRIES,
} from '@/lib/openf1'
import { fetchSeasonData, bundleAsOf } from '@/lib/season-data'
import IntroSequence, { type RevealMode } from '@/components/IntroSequence'
import LiveSessionNotice from '@/components/LiveSessionNotice'
import { useApiBlocked } from '@/components/shell/useApiBlocked'
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
  // meeting_key → winner surname, for the season index (from the bundle)
  const [winners, setWinners] = useState<Record<number, string>>({})
  // "AS OF 14:32" when the bundle is stale (served through a lockout)
  const [asOf, setAsOf] = useState<string | null>(null)
  // Cinematic intro overlay — plays on every visit to /; data fetching below
  // runs in parallel behind it.
  const [introActive, setIntroActive] = useState(true)
  const [reveal, setReveal] = useState<'hidden' | RevealMode>('hidden')
  // Live-session lockout (openf1 401s) vs genuine off-season: when meetings
  // come back empty, hold a short grace window so the async 401 probe can
  // classify the failure before we commit to showing either state.
  const apiBlocked = useApiBlocked()
  const [classifyGraceOver, setClassifyGraceOver] = useState(false)

  const handleIntroReveal = useCallback((mode: RevealMode) => setReveal(mode), [])
  const handleIntroDone = useCallback(() => {
    setIntroActive(false)
    // Safety net: never leave content hidden once the overlay is gone
    setReveal((r) => (r === 'hidden' ? 'cascade' : r))
  }, [])

  // Phase 1: fetch meetings + sessions, then show the page immediately
  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([m, s]) => {
        // fresh data wins; an empty (locked-out) result never clobbers
        // calendar state the bundle fallback may already have filled
        setMeetings((cur) => (m.length > 0 ? m : cur))
        setSessions((cur) => (s.length > 0 ? s : cur))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (loading || meetings.length > 0) return
    const t = setTimeout(() => setClassifyGraceOver(true), 1800)
    return () => clearTimeout(t)
  }, [loading, meetings])

  // Phase 2: one server-computed bundle replaces the client-side
  // multi-fetch standings pipeline (fight, last race, season winners).
  // The bundle's calendar also backstops the direct openf1 fetch: during
  // live-session 401 lockouts the meetings/sessions state stays populated
  // from durable data, so NOW (and its countdown) keep working.
  useEffect(() => {
    let alive = true
    fetchSeasonData().then((bundle) => {
      if (!alive || !bundle) return
      setMeetings((cur) => (cur.length > 0 ? cur : bundle.meetings))
      setSessions((cur) => (cur.length > 0 ? cur : bundle.sessions))
      const top3: FightRow[] = bundle.driverStandings.slice(0, 3).map((d) => ({
        position: d.position,
        surname: d.surname,
        fullName: d.fullName,
        points: d.points,
        wins: d.wins,
        acronym: d.nameAcronym,
      }))
      if (top3.length > 0) setFight(top3)

      if (bundle.lastRace && bundle.lastRace.podium.length > 0) {
        const podium: PodiumRow[] = bundle.lastRace.podium.map((p) => ({
          position: p.position,
          surname: p.surname,
          fullName: p.fullName,
          gapLabel: p.gapLabel,
        }))
        setLastRace({ label: bundle.lastRace.label, podium })
      }

      if (Object.keys(bundle.winnersByRound).length > 0) setWinners(bundle.winnersByRound)
      setAsOf(bundleAsOf(bundle))
    })
    return () => {
      alive = false
    }
  }, [])

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
          {/* ─── Section 1: NOW ───
              Four states, never conflated: race data → NowSection;
              openf1 live-session lockout → honest notice; genuinely no
              upcoming races (data loaded fine) → season complete; empty
              while the 401 probe classifies → hold the placeholder. */}
          <Reveal order={0} state={reveal}>
            {targetMeeting && roundNumber !== null ? (
              <NowSection
                meeting={targetMeeting}
                sessions={sessions}
                round={roundNumber}
                totalRounds={raceMeetings.length}
                isLive={isLiveWeekend}
              />
            ) : apiBlocked ? (
              <LiveSessionNotice variant="full" />
            ) : meetings.length > 0 || classifyGraceOver ? (
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
            ) : (
              skeleton
            )}
          </Reveal>

          {/* ─── Sections 2–3: frames render immediately with same-scale
              ghost content; data replaces in place (no late mounting, no
              layout shift). Blocked = the lockout note inside the frame. */}
          {targetMeeting && (
            <>
              <Reveal order={1} state={reveal}>
                <FightSection rows={fight} blocked={apiBlocked && !fight} asOf={asOf} />
              </Reveal>
              <Reveal order={2} state={reveal}>
                <LastRaceSection
                  raceLabel={lastRace?.label ?? null}
                  podium={lastRace?.podium ?? null}
                  blocked={apiBlocked && !lastRace}
                  asOf={asOf}
                />
              </Reveal>
            </>
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
