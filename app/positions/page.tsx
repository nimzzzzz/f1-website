'use client'

import { useEffect, useState, useMemo } from 'react'
import type { Session, Position, Driver } from '@/lib/openf1'
import { getCachedPositions, getCachedDrivers } from '@/lib/client-cache'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_FAST } from '@/lib/session-live'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import { FadeUp } from '@/components/motion/reveals'

interface DriverPosition {
  driverNumber: number
  driver: Driver | undefined
  currentPosition: number
  startPosition: number | null
  positionChange: number | null
}

const isRace = (s: Session) => s.session_type === 'Race'
const latestCompleted = (sorted: Session[]) => sorted.find((s) => new Date(s.date_end) < new Date())

export default function PositionsPage() {
  const { sessions, selectedKey, setSelectedKey, loading } = useSessionList(isRace, latestCompleted)
  const selectedSession = sessions.find((s) => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(
    selectedKey,
    { positions: getCachedPositions, drivers: getCachedDrivers },
    // drivers only supplies acronym + team colour; without it a row reads
    // "#44" instead of "VER", which is degraded but not untrue.
    { primary: 'positions', optional: ['drivers'],
      pollMs: { positions: POLL_FAST },
      session: selectedSession,
    }
  )
  // Rows kept through an outage may belong to a session the user has
  // already navigated away from — name it, so the heading above cannot
  // imply they are its own.
  const staleLabel =
    dataKey !== null && dataKey !== selectedKey
      ? sessionStripLabel(sessions.find((s) => s.session_key === dataKey))
      : null

  const rawPositions: Position[] = data?.positions ?? []
  const driverList: Driver[] = data?.drivers ?? []

  // scrub through the session's position timeline (1 = final classification)
  const [scrub, setScrub] = useState(1)
  useEffect(() => setScrub(1), [selectedKey])

  // Final classification, derived from the fetched timeline.
  const driverPositions: DriverPosition[] = useMemo(() => {
    const driverMap = new Map(driverList.map((d) => [d.driver_number, d]))

    // Start positions (earliest entry per driver)
    const startPositions = new Map<number, number>()
    const sorted = [...rawPositions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    for (const p of sorted) {
      if (!startPositions.has(p.driver_number)) startPositions.set(p.driver_number, p.position)
    }

    // Final positions (latest entry per driver)
    const finalPositions = new Map<number, number>()
    const sortedDesc = [...rawPositions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
    for (const p of sortedDesc) {
      if (!finalPositions.has(p.driver_number)) finalPositions.set(p.driver_number, p.position)
    }

    const rows: DriverPosition[] = []
    finalPositions.forEach((finalPos, driverNum) => {
      const startPos = startPositions.get(driverNum) ?? null
      rows.push({
        driverNumber: driverNum,
        driver: driverMap.get(driverNum),
        currentPosition: finalPos,
        startPosition: startPos,
        positionChange: startPos !== null ? startPos - finalPos : null,
      })
    })
    rows.sort((a, b) => a.currentPosition - b.currentPosition)
    return rows
  }, [rawPositions, driverList])

  // Rows at the scrub point, derived from the already-fetched timeline.
  const { rows: scrubRows, scrubClock } = useMemo(() => {
    if (scrub >= 1 || rawPositions.length === 0) {
      return { rows: driverPositions, scrubClock: null as string | null }
    }
    const times = rawPositions.map((p) => new Date(p.date).getTime())
    const t0 = Math.min(...times)
    const t1 = Math.max(...times)
    const at = t0 + scrub * (t1 - t0)
    const driverMap = new Map(driverList.map((d) => [d.driver_number, d]))

    const asc = [...rawPositions].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )
    const startPositions = new Map<number, number>()
    const atPositions = new Map<number, number>()
    for (const p of asc) {
      if (!startPositions.has(p.driver_number)) startPositions.set(p.driver_number, p.position)
      if (new Date(p.date).getTime() <= at) atPositions.set(p.driver_number, p.position)
    }
    const rows: DriverPosition[] = []
    startPositions.forEach((startPos, driverNum) => {
      const cur = atPositions.get(driverNum) ?? startPos
      rows.push({
        driverNumber: driverNum,
        driver: driverMap.get(driverNum),
        currentPosition: cur,
        startPosition: startPos,
        positionChange: startPos - cur,
      })
    })
    rows.sort((a, b) => a.currentPosition - b.currentPosition)
    const clock = new Date(at).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    return { rows, scrubClock: clock }
  }, [scrub, rawPositions, driverPositions, driverList])

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-24 w-[55%] animate-pulse rounded bg-white/5" />
        <p className="label-mono mt-8 text-[var(--text-dim)]">LOADING SESSIONS…</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <SessionHeader
        ghost="POS"
        kicker="POSITIONS"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />}
      />

      <DataStateNotice
        state={state}
        message={message}
        stale={stale}
        staleLabel={staleLabel}
        onRetry={refresh}
        emptyLabel={selectedKey ? 'NO POSITION DATA FOR THIS SESSION' : 'SELECT A RACE SESSION'}
        className="mt-8"
      />

      {fetching && driverPositions.length === 0 ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : driverPositions.length === 0 ? null : (
        <>
          {/* ─── the scrubber: replay the session on a red rail ─── */}
          <FadeUp className="mt-14">
            <div className="border-t border-[var(--line)] pt-8">
              <div className="section-header flex items-baseline justify-between gap-6 text-[var(--text-dim)]">
                <span>SESSION SCRUB</span>
                <span className="tabular-nums">
                  {scrub >= 1 ? 'FINAL CLASSIFICATION' : scrubClock ?? '—'}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1000}
                value={Math.round(scrub * 1000)}
                onChange={(e) => setScrub(Number(e.target.value) / 1000)}
                aria-label="Scrub through session positions"
                className="mt-4 h-[2px] w-full cursor-pointer appearance-none rounded-none bg-[var(--line)]"
                style={{ accentColor: 'var(--accent)' }}
              />
            </div>
          </FadeUp>

          {/* ─── the order at the scrub point ─── */}
          <div className="mt-10">
            {scrubRows.map((row) => {
              const gained = row.positionChange !== null && row.positionChange > 0
              const lost = row.positionChange !== null && row.positionChange < 0
              return (
                <div
                  key={row.driverNumber}
                  className="flex items-baseline gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                >
                  <span
                    className="label-mono w-10 shrink-0 tabular-nums"
                    style={{ color: row.currentPosition === 1 ? 'var(--accent)' : 'var(--text)' }}
                  >
                    P{row.currentPosition}
                  </span>
                  <span className="label-mono flex w-24 shrink-0 items-center gap-2 text-[var(--text)]">
                    <span
                      aria-hidden
                      className="inline-block h-[2px] w-3"
                      style={{ backgroundColor: `#${row.driver?.team_colour ?? '444'}` }}
                    />
                    {row.driver?.name_acronym ?? `#${row.driverNumber}`}
                  </span>
                  <span
                    className="hidden min-w-0 flex-1 truncate uppercase leading-none text-[var(--text)] md:block"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}
                  >
                    {row.driver?.last_name ?? ''}
                  </span>
                  <span className="label-mono hidden shrink-0 text-[var(--text-dim)] lg:block">
                    {row.driver?.team_name?.toUpperCase()}
                  </span>
                  <span className="label-mono w-16 shrink-0 text-right tabular-nums text-[var(--text-dim)]">
                    GRID {row.startPosition ?? '—'}
                  </span>
                  <span
                    className={`label-mono w-12 shrink-0 text-right tabular-nums ${
                      gained ? 'text-[var(--text)]' : lost ? 'text-[var(--text-dim)]' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    {row.positionChange === null || row.positionChange === 0
                      ? '—'
                      : `${gained ? '+' : '−'}${Math.abs(row.positionChange)}`}
                  </span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
