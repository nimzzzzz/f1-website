'use client'

import { useMemo, useRef, useState } from 'react'
import type { Driver, Lap, Session } from '@/lib/openf1'
import { getCachedLaps, getCachedDrivers } from '@/lib/client-cache'
import { getLapContext } from '@/lib/laps-data'
import { lapDrivers, lapTime, prepareLaps, timedLaps, type LapDriver } from '@/lib/laps-story'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_MEDIUM } from '@/lib/session-live'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import LapIdentity from './LapIdentity'
import SectorDuel from './SectorDuel'
import LapPace from './LapPace'
import IdealLap from './IdealLap'
import LapLeaderboard from './LapLeaderboard'
import LapExplorer from './LapExplorer'
import { focusTimingSection } from './laps-scroll'
import './laps.css'

const anySession = (s: Session) => !s.is_cancelled
const initialSession = (sorted: Session[]) => {
  const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('session')
  return (requested && sorted.find((s) => String(s.session_key) === requested)) || sorted.find((s) => new Date(s.date_end) < new Date())
}
type Pick = { number: number; lap: number | null }

function LapExperience({ session, laps, roster }: { session: Session; laps: Lap[]; roster: Driver[] }) {
  const drivers = useMemo(() => lapDrivers(laps, roster), [laps, roster])
  const [picks, setPicks] = useState<Pick[]>(() => drivers.slice(0, 2).map((d) => ({ number: d.number, lap: null })))
  const title = useRef<HTMLHeadingElement>(null)
  // Extra requests start only after primary lap data has arrived, and their
  // failure cannot hide the timings. Keep the whole experience session-keyed.
  const extra = useSessionData(session.session_key, { context: getLapContext }, { primary: 'context', pollMs: { context: POLL_MEDIUM }, session })
  const context = extra.dataKey === session.session_key ? extra.data?.context[0] ?? null : null
  const a = drivers.find((d) => d.number === picks[0]?.number) ?? drivers[0]
  const b = drivers.find((d) => d.number === picks[1]?.number && d.number !== a?.number) ?? drivers.find((d) => d.number !== a?.number)
  const lapA = a && (timedLaps(a.laps).find((l) => l.lap_number === picks[0]?.lap) ?? a.best)
  const lapB = b && (timedLaps(b.laps).find((l) => l.lap_number === picks[1]?.lap) ?? b.best)
  const comparison = useMemo(() => [a, b].filter((d): d is LapDriver => !!d), [a, b])
  const select = (slot: number, number: number, lap: number | null) => {
    setPicks((previous) => {
      const current = [{ number: a?.number, lap: previous[0]?.lap ?? null }, { number: b?.number, lap: previous[1]?.lap ?? null }]
      const other = slot === 0 ? 1 : 0
      if (current[other]?.number === number) current[other] = current[slot]
      current[slot] = { number, lap }
      return current.filter((p): p is Pick => p.number !== undefined)
    })
  }
  const useLap = (slot: number, lap: Lap) => {
    select(slot, lap.driver_number, lap.lap_number)
    focusTimingSection(title.current, true)
  }
  return <div className="laps-experience">
    {a && lapA ? <>
      <section className="laps-lab" aria-labelledby="laps-lab-title">
        <div className="laps-lab-heading"><h2 ref={title} id="laps-lab-title" tabIndex={-1}>CHASING<br /><span>THOUSANDTHS.</span></h2><div className="laps-session-best"><span className="laps-caption">FASTEST RECORDED LAP</span><strong>{lapTime(drivers[0].best.lap_duration)}</strong><span>{drivers[0].name} · L{drivers[0].best.lap_number}</span></div></div>
        <p className="laps-lab-intro">Two laps. Three sectors. Find where the difference is made.</p>
        <div className="laps-identities">
          <LapIdentity slot="A" driver={a} lap={lapA} drivers={drivers} other={b?.number} onDriver={(n) => select(0, n, null)} onLap={(n) => select(0, a.number, n)} stints={context?.stints ?? null} />
          {b && lapB && <LapIdentity slot="B" driver={b} lap={lapB} drivers={drivers} other={a.number} onDriver={(n) => select(1, n, null)} onLap={(n) => select(1, b.number, n)} stints={context?.stints ?? null} />}
        </div>
        {b && lapB ? <SectorDuel a={lapA} b={lapB} driverA={a} driverB={b} /> : <p className="laps-empty">A second driver with a recorded lap is needed for a sector duel. Explore the available laps below.</p>}
      </section>
      {context && (context.stints === null || context.stops === null) && <div className="laps-context-note"><p className="laps-note">Some tyre or pit-stop details are unavailable. Lap timings remain available.</p><button type="button" className="laps-button" onClick={extra.refresh}>CHECK AGAIN</button></div>}
      <LapPace drivers={comparison} context={context} onUse={useLap} />
      <IdealLap driver={a} />
      <LapLeaderboard drivers={drivers} selected={a.number} onSelect={(d) => useLap(0, d.best)} stints={context?.stints ?? null} />
    </> : <p className="laps-empty">No completed timed laps yet. Recorded out laps and partial laps are available below.</p>}
    <LapExplorer laps={laps} drivers={drivers} roster={roster} context={context} onUse={useLap} />
  </div>
}

export default function LapsClient() {
  const list = useSessionList(anySession, initialSession)
  const { sessions, selectedKey, setSelectedKey, loading } = list
  const selectedSession = sessions.find((s) => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(
    selectedKey, { laps: getCachedLaps, drivers: getCachedDrivers },
    { primary: 'laps', optional: ['drivers'], pollMs: { laps: POLL_MEDIUM }, session: selectedSession },
  )
  const laps = useMemo(() => prepareLaps(data?.laps ?? []), [data?.laps])
  const displayedSession = sessions.find((s) => s.session_key === dataKey) ?? selectedSession
  const different = dataKey !== null && dataKey !== selectedKey
  const staleLabel = different ? sessionStripLabel(displayedSession ?? undefined) : null
  const selectSession = (key: number) => {
    setSelectedKey(key)
    const url = new URL(window.location.href)
    url.searchParams.set('session', String(key))
    window.history.replaceState(window.history.state, '', url)
  }
  if (loading) return <div className="laps-page laps-loading"><h1 className="sr-only" data-loading-h1>LAP TIMES</h1><p className="laps-caption">LOADING SESSIONS…</p><div className="laps-skeleton" aria-hidden /></div>
  return <div className="laps-page">
    <SessionHeader ghost="LAPS" kicker="LAP TIMES" sessions={sessions} selectedKey={selectedKey} onSelect={selectSession} live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />} />
    <DataStateNotice state={list.state === 'unavailable' ? list.state : state} message={list.message ?? message} stale={stale} staleLabel={staleLabel} onRetry={list.state === 'unavailable' ? () => window.location.reload() : refresh} emptyLabel="LAP TIMES WILL APPEAR WHEN TIMING IS AVAILABLE FOR THIS SESSION" className="mt-8" />
    {different && !stale && laps.length > 0 && <p className="laps-context-note" role="status">LOADING SELECTED SESSION · SHOWING {staleLabel}</p>}
    {fetching && laps.length === 0 ? <div className="laps-skeleton" role="status"><span className="sr-only">Loading lap times</span></div> : laps.length > 0 && displayedSession ? <LapExperience key={dataKey} session={displayedSession} laps={laps} roster={data?.drivers ?? []} /> : <div className="laps-awaiting" aria-hidden>EVERY<br />THOUSANDTH.</div>}
  </div>
}
