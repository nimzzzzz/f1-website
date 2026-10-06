'use client'

import { useMemo, useRef, useState } from 'react'
import type { Session, Stint } from '@/lib/openf1'
import { getCachedPitStops, getCachedDrivers, getCachedStints } from '@/lib/client-cache'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_MEDIUM } from '@/lib/session-live'
import { median, pitTime, pitVisits, rankVisits, type PitMetric, type PitVisit } from '@/lib/pit-story'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import PitGarage from './PitGarage'
import PitTraffic, { type PitWindow } from './PitTraffic'
import PitLedger from './PitLedger'
import PitTeams from './PitTeams'
import { focusPitSection } from './pit-scroll'
import './pit-stops.css'

const isRace = (s: Session) => s.session_type === 'Race' && !s.is_cancelled
const initialSession = (sorted: Session[]) => {
  const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('session')
  return (requested && sorted.find(s => String(s.session_key) === requested)) || sorted.find(s => new Date(s.date_end) < new Date())
}

function PitExperience({ visits, stints }: { visits: PitVisit[]; stints: Stint[] | null }) {
  const stationaryCount = visits.filter(v => v.stationary !== null).length
  const [metric, setMetric] = useState<PitMetric>(() => stationaryCount ? 'stationary' : 'lane')
  const [selection, setSelection] = useState<string | null>(null)
  const [window, setWindow] = useState<PitWindow | null>(null)
  const [replaySignal, setReplaySignal] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const ranking = useMemo(() => rankVisits(visits, metric), [visits, metric])
  const selected = visits.find(v => v.key === selection) ?? ranking[0] ?? visits[0]
  const middle = median(visits.flatMap(v => v[metric] === null ? [] : [v[metric]!]))
  const inspect = (v: PitVisit) => {
    setSelection(v.key); setReplaySignal(n => n + 1)
    requestAnimationFrame(() => focusPitSection(title.current))
  }
  return <>
    <div className="pit-overview"><div><span className="pit-label">COMPARE</span><div className="pit-metric" role="group" aria-label="Timing measurement">
      <button type="button" aria-pressed={metric === 'stationary'} onClick={() => { setMetric('stationary'); setSelection(null) }} disabled={!stationaryCount} title={!stationaryCount ? 'Stationary timings have not been published for this session' : undefined}>STATIONARY</button>
      <button type="button" aria-pressed={metric === 'lane'} onClick={() => { setMetric('lane'); setSelection(null) }}>PIT LANE</button>
    </div></div><dl><div><dt>RECORDED VISITS</dt><dd>{visits.length}</dd></div><div><dt>{metric === 'lane' ? 'MEDIAN LANE TIME' : 'MEDIAN STATIONARY'}</dt><dd>{pitTime(middle)}{middle !== null && middle < 60 && <small>s</small>}</dd></div></dl></div>
    <PitGarage key={`${selected.key}-${metric}`} visit={selected} metric={metric} best={ranking[0]} stints={stints} titleRef={title} replaySignal={replaySignal} />
    {!stationaryCount ? <p className="pit-coverage">Stationary timings are not published for this session. The clock shows the complete pit-lane visit.</p> : stationaryCount < visits.length ? <p className="pit-coverage">Stationary timings are available for {stationaryCount} of {visits.length} visits. Unpublished times remain marked N/A.</p> : null}
    {ranking.length > 1 && <div className="pit-shortlist"><span className="pit-label">{metric === 'stationary' ? 'QUICKEST STATIONARY STOPS' : 'QUICKEST LANE VISITS'}</span><div className="pit-shortlist-scroll" data-scroll-x><div className="pit-quickest" role="group" aria-label="Inspect the quickest visits">
      {ranking.slice(0, 5).map((v, i) => <button type="button" key={v.key} aria-pressed={selected.key === v.key} onClick={() => { setSelection(v.key); setReplaySignal(n => n + 1) }}><span className="pit-quick-rank">{String(i + 1).padStart(2, '0')}</span><span className="pit-quick-name"><i style={{ background: v.color }} aria-hidden />{v.acronym}<small>L{v.lap ?? '?'}</small></span><strong className={pitTime(v[metric]).includes(':') ? 'is-long' : undefined}>{pitTime(v[metric])}</strong></button>)}
    </div></div></div>}
    <PitTraffic visits={visits} selected={window} onSelect={setWindow} />
    <PitLedger visits={visits} metric={metric} window={window} selected={selected.key} stints={stints} onInspect={inspect} onClearWindow={() => setWindow(null)} />
    <PitTeams visits={visits} metric={metric} />
    <p className="pit-source-note">Timing definitions: <a href="https://openf1.org/docs/#pit" target="_blank" rel="noreferrer">OpenF1 pit data ↗</a>. Pit-lane time includes the stationary stop. Visits may also include drive-throughs or extended holds.</p>
  </>
}

export default function PitStopsClient() {
  const list = useSessionList(isRace, initialSession)
  const { sessions, selectedKey, setSelectedKey, loading } = list
  const selectedSession = sessions.find(s => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(
    selectedKey, { pitStops: getCachedPitStops, drivers: getCachedDrivers, stints: getCachedStints },
    { primary: 'pitStops', optional: ['drivers', 'stints'], pollMs: { pitStops: POLL_MEDIUM, stints: POLL_MEDIUM }, session: selectedSession },
  )
  const visits = useMemo(() => pitVisits(data?.pitStops ?? [], data?.drivers ?? [], dataKey ?? -1), [data, dataKey])
  const different = dataKey !== null && dataKey !== selectedKey
  const staleLabel = different ? sessionStripLabel(sessions.find(s => s.session_key === dataKey)) : null
  const select = (key: number) => {
    setSelectedKey(key)
    const url = new URL(window.location.href)
    url.searchParams.set('session', String(key)); window.history.replaceState(window.history.state, '', url)
  }
  if (loading) return <div className="pit-page pit-loading"><h1 className="sr-only" data-loading-h1>PIT STOPS</h1><p className="pit-label">LOADING SESSIONS…</p><div className="pit-skeleton" aria-hidden /></div>
  return <div className="pit-page">
    <SessionHeader ghost="PIT" kicker="PIT STOPS" sessions={sessions} selectedKey={selectedKey} onSelect={select} live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />} />
    <DataStateNotice state={list.state === 'unavailable' ? list.state : state} message={list.message ?? message} stale={stale} staleLabel={staleLabel}
      onRetry={list.state === 'unavailable' ? () => window.location.reload() : refresh} emptyLabel={selectedKey ? 'NO PIT VISITS RECORDED FOR THIS SESSION' : 'SELECT A RACE SESSION'} className="mt-8" />
    {different && !stale && visits.length > 0 && <p className="pit-coverage" role="status">LOADING SELECTED SESSION · SHOWING {staleLabel}</p>}
    {fetching && !visits.length ? <div className="pit-skeleton" role="status"><span className="sr-only">Loading pit timing</span></div>
      : visits.length ? <PitExperience key={dataKey} visits={visits} stints={data?.stints ?? null} /> : <div className="pit-clear" aria-hidden>CLEAR<br />LANE.</div>}
  </div>
}
