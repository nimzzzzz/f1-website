'use client'

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import {
  getRaceMeetings,
  isMeetingCompleted,
  getCurrentMeeting,
  getNextMeeting,
  isCancelled,
} from '@/lib/openf1'
import { useFreshSeasonBundle } from '@/lib/use-season-bundle'
import type { RevealMode } from '@/components/IntroSequence'

const IntroSequence = dynamic(() => import('@/components/IntroSequence'), { ssr: false })
import NowSection from '@/components/home/NowSection'
import FightSection, { type FightRow } from '@/components/home/FightSection'
import LastRaceSection, { type PodiumRow } from '@/components/home/LastRaceSection'
import SeasonSection from '@/components/home/SeasonSection'
import HomeFooter from '@/components/home/HomeFooter'
import PaddockSection from '@/components/home/PaddockSection'
import RaceToolsSection from '@/components/home/RaceToolsSection'

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
  const reducedMotion = useReducedMotion()
  return (
    <motion.div
      initial={false}
      animate={state === 'hidden' ? { opacity: 0, y: 24 } : { opacity: 1, y: 0 }}
      transition={
        state === 'instant' || reducedMotion
          ? { duration: 0 }
          : { duration: 0.7, delay: order * 0.18, ease: [0.22, 1, 0.36, 1] }
      }
    >
      {children}
    </motion.div>
  )
}

import type { SeasonBundle } from '@/lib/season-data'

export default function HomeClient({ initialBundle }: { initialBundle: SeasonBundle | null }) {
  // All season state seeds from the SSR-injected bundle snapshot, so the
  // first paint already has the calendar, the fight, and the podium — the
  // client fetches below only refresh it.
  const [meetings, setMeetings] = useState<Meeting[]>(() => initialBundle?.meetings ?? [])
  const [sessions, setSessions] = useState<Session[]>(() => initialBundle?.sessions ?? [])
  const [loading, setLoading] = useState(() => !initialBundle)
  const [fight, setFight] = useState<FightRow[] | null>(() =>
    initialBundle && initialBundle.driverStandings.length > 0
      ? initialBundle.driverStandings.slice(0, 3).map((d) => ({
          position: d.position,
          surname: d.surname,
          fullName: d.fullName,
          points: d.points,
          wins: d.wins,
          acronym: d.nameAcronym,
          teamName: d.teamName,
          teamColour: d.teamColour,
        }))
      : null
  )
  const [lastRace, setLastRace] = useState<LastRaceData | null>(() =>
    initialBundle?.lastRace && initialBundle.lastRace.podium.length > 0
      ? {
          label: initialBundle.lastRace.label,
          podium: initialBundle.lastRace.podium.map((p) => ({
            position: p.position,
            surname: p.surname,
            fullName: p.fullName,
            gapLabel: p.gapLabel,
          })),
        }
      : null
  )
  // meeting_key → winner surname, for the season index (from the bundle)
  const [winners, setWinners] = useState<Record<number, string>>(
    () => initialBundle?.winnersByRound ?? {}
  )
  // The film is opt-in: the hero paints immediately and neither the film
  // nor its playback code downloads until the visitor chooses to watch.
  const [introActive, setIntroActive] = useState(false)
  const [reveal, setReveal] = useState<'hidden' | RevealMode>('instant')

  const handleIntroReveal = useCallback((mode: RevealMode) => setReveal(mode), [])
  const handleIntroDone = useCallback(() => {
    setIntroActive(false)
    // Safety net: never leave content hidden once the overlay is gone
    setReveal((r) => (r === 'hidden' ? 'cascade' : r))
  }, [])

  // Phase 1: fetch meetings + sessions, then show the page immediately
  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([mtgRes, sessionRes]) => {
        // Fresh data wins; a FAILED fetch never clobbers calendar state the
        // bundle fallback may already have filled. This used to guess at
        // failure from `length > 0`, which also refused a legitimately
        // empty calendar — harmless here, but the check now says what it
        // means.
        if (mtgRes.ok) setMeetings(mtgRes.rows)
        if (sessionRes.ok) setSessions(sessionRes.rows)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // Phase 2: one server-computed bundle replaces the client-side
  // multi-fetch standings pipeline (fight, last race, season winners).
  // The bundle's calendar also backstops the direct openf1 fetch: during
  // live-session 401 lockouts the meetings/sessions state stays populated
  // from durable data, so NOW (and its countdown) keep working.
  const { bundle } = useFreshSeasonBundle(initialBundle?.computedAt ?? null)

  useEffect(() => {
    if (!bundle) return
    {
      setMeetings((cur) => (cur.length > 0 ? cur : bundle.meetings))
      setSessions((cur) => (cur.length > 0 ? cur : bundle.sessions))
      const top3: FightRow[] = bundle.driverStandings.slice(0, 3).map((d) => ({
        position: d.position,
        surname: d.surname,
        fullName: d.fullName,
        points: d.points,
        wins: d.wins,
        acronym: d.nameAcronym,
        teamName: d.teamName,
        teamColour: d.teamColour,
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
    }
  }, [bundle])

  // Sections 2–3 mount after their data arrives, which changes the page
  // height above the pinned season strip — recompute trigger positions.
  useEffect(() => {
    if (fight || lastRace || Object.keys(winners).length > 0) {
      requestAnimationFrame(() => ScrollTrigger.refresh())
    }
  }, [fight, lastRace, winners])

  // Portal outside the route fade so the film covers the shell after client
  // navigation too. It mounts only from a browser click, never during SSR.
  const intro = introActive && createPortal(
    <IntroSequence key="intro" onReveal={handleIntroReveal} onDone={handleIntroDone} />,
    document.body,
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
  const activeMeetings = meetings.filter((m) => !isCancelled(m))
  const currentMeeting = getCurrentMeeting(activeMeetings)
  const nextMeeting = getNextMeeting(activeMeetings)
  const targetMeeting = currentMeeting ?? nextMeeting
  const isLiveWeekend = currentMeeting !== null

  // Round NUMBER and round TOTAL both count scored rounds only. Indexing
  // into raceMeetings (which includes cancelled entries, struck through on
  // the strip) inflated both: a cancelled round earlier in the calendar
  // pushed every later round's number up by one, and the denominator
  // claimed 25 while the season scores 23 — the same two-numbers-
  // disagreeing problem /schedule and the season strip already fixed.
  const scoredMeetings = raceMeetings.filter((m) => !isCancelled(m))
  const roundNumber = targetMeeting
    ? scoredMeetings.findIndex((m) => m.meeting_key === targetMeeting.meeting_key) + 1
    : null

  const seasonRounds = raceMeetings.map((m) => ({
    meeting: m,
    isPast: isMeetingCompleted(m),
    isNext: targetMeeting?.meeting_key === m.meeting_key,
    isCancelled: isCancelled(m),
  }))

  // "Season complete" only when it is VERIFIABLY over: a loaded calendar
  // whose every race has finished. An empty calendar (lockout, 429,
  // network) must never be mislabeled as the season ending.
  const seasonGenuinelyOver =
    raceMeetings.length > 0 &&
    raceMeetings.every((m) => new Date(m.date_end).getTime() < Date.now())

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
                totalRounds={scoredMeetings.length}
                isLive={isLiveWeekend}
                onPlayIntro={() => setIntroActive(true)}
              />
            ) : seasonGenuinelyOver ? (
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
              // no calendar from any source yet (fresh deploy mid-lockout,
              // rate-limited first load) — hold the skeleton; never a
              // notice, never a false "season complete"
              skeleton
            )}
          </Reveal>

          {/* ─── Sections 2–3: frames render immediately with same-scale
              ghost content; data replaces in place (no late mounting, no
              layout shift). Blocked = the lockout note inside the frame. */}
          {targetMeeting && (
            <>
              <Reveal order={1} state={reveal}>
                <FightSection rows={fight} computedAt={bundle?.computedAt ?? initialBundle?.computedAt} />
              </Reveal>
              <Reveal order={2} state={reveal}>
                <LastRaceSection
                  raceLabel={lastRace?.label ?? null}
                  podium={lastRace?.podium ?? null}
                />
              </Reveal>
            </>
          )}

          <PaddockSection teams={(bundle ?? initialBundle)?.teamStandings ?? []} />
          <RaceToolsSection />

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
