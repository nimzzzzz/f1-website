'use client'

import { useMemo } from 'react'
import type { Session } from '@/lib/openf1'
import { getCachedDrivers } from '@/lib/client-cache'
import { getResultClassification, getRaceExtras } from '@/lib/results-data'
import { resultRows, sessionKind, type ResultRow } from '@/lib/results-story'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_FAST, POLL_MEDIUM } from '@/lib/session-live'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import ResultsPodium from './ResultsPodium'
import ResultsClassification from './ResultsClassification'
import ResultsRaceStory from './ResultsRaceStory'
import './results.css'

const anySession = (s: Session) => !s.is_cancelled
const initialSession = (sorted: Session[]) => {
  // A copied URL can open the exact session without changing the route or
  // its metadata. Unknown keys fall back to the latest completed session.
  const requested = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('session')
  return (requested && sorted.find((s) => String(s.session_key) === requested)) || sorted.find((s) => new Date(s.date_end) < new Date())
}

function ResultsExperience({ session, rows }: { session: Session; rows: ResultRow[] }) {
  const kind = sessionKind(session)
  const published = rows.some((r) => r.detail !== null)
  // Only races pay for the grid, position history and pit data. This
  // enrichment loads after the classification, and cannot hide it.
  const { data, dataKey, fetching, refresh } = useSessionData(
    kind === 'race' ? session.session_key : null,
    { extras: getRaceExtras },
    { primary: 'extras', pollMs: { extras: POLL_MEDIUM }, session },
  )
  const extras = dataKey === session.session_key ? data?.extras[0] ?? null : null
  return <div className="results-experience">
    <ResultsPodium rows={rows} session={session} kind={kind} published={published} />
    {kind === 'race' && <ResultsRaceStory rows={rows} extras={extras} pending={fetching} onRetry={refresh} />}
    <ResultsClassification rows={rows} kind={kind} extras={extras} published={published} sprintQualifying={session.session_name.includes('Sprint')} />
  </div>
}

export default function ResultsClient() {
  const list = useSessionList(anySession, initialSession)
  const { sessions, selectedKey, setSelectedKey, loading } = list
  const selectSession = (key: number) => {
    setSelectedKey(key)
    const url = new URL(window.location.href)
    url.searchParams.set('session', String(key))
    window.history.replaceState(window.history.state, '', url)
  }
  const selectedSession = sessions.find((s) => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(
    selectedKey,
    { classification: getResultClassification, drivers: getCachedDrivers },
    { primary: 'classification', optional: ['drivers'], pollMs: { classification: POLL_FAST }, session: selectedSession },
  )
  const rows = useMemo(() => resultRows(data?.classification ?? [], data?.drivers ?? []), [data])
  // Preserve the identity of kept data while a different session loads or
  // fails. Its portrait, session type and circuit must all stay together.
  const displayedSession = sessions.find((s) => s.session_key === dataKey) ?? selectedSession
  const differentSession = dataKey !== null && dataKey !== selectedKey
  const staleLabel = differentSession ? sessionStripLabel(displayedSession ?? undefined) : null

  if (loading) return <div className="results-page results-loading">
    <h1 className="sr-only" data-loading-h1>RESULTS</h1><p className="results-caption">LOADING SESSIONS…</p><div className="results-loading-stage" aria-hidden />
  </div>

  return (
    <div className="results-page">
      <SessionHeader ghost="RESULTS" kicker={`RESULTS${selectedSession ? ` · ${selectedSession.year}` : ''}`} sessions={sessions}
        selectedKey={selectedKey} onSelect={selectSession}
        live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />} />
      <DataStateNotice state={list.state === 'unavailable' ? list.state : state} message={list.message ?? message}
        stale={stale} staleLabel={staleLabel} onRetry={refresh} className="mt-8"
        emptyLabel={selectedKey ? 'RESULTS WILL APPEAR WHEN TIMING IS AVAILABLE FOR THIS SESSION' : 'SELECT A SESSION'} />
      {differentSession && !stale && rows.length > 0 && <p className="results-session-loading" role="status">LOADING SELECTED SESSION · SHOWING {staleLabel}</p>}
      {fetching && rows.length === 0 ? <div className="results-loading-stage" role="status"><span className="sr-only">Loading results</span></div> : rows.length > 0 && displayedSession ? <ResultsExperience key={dataKey} session={displayedSession} rows={rows} /> : <div className="results-awaiting" aria-hidden><span>FINISH LINE</span><div className="results-finish-rule" /></div>}
    </div>
  )
}
