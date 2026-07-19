'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Lap, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { formatDuration } from '@/lib/openf1'
import { getCachedLaps, getCachedDrivers } from '@/lib/client-cache'
import SessionHeader from '@/components/session/SessionHeader'
import { FadeUp } from '@/components/motion/reveals'

export default function LapsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [laps, setLaps] = useState<Lap[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchingLaps, setFetchingLaps] = useState(false)
  const [filterDriver, setFilterDriver] = useState<number | 'all'>('all')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        const sorted = all.sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )
        setSessions(sorted)
        const latest = sorted.find((s) => new Date(s.date_end) < new Date())
        if (latest) setSelectedKey(latest.session_key)
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchLapData = useCallback(async (sessionKey: number) => {
    setFetchingLaps(true)
    setError(null)
    try {
      const [lapData, driverData] = await Promise.all([
        getCachedLaps(sessionKey),
        getCachedDrivers(sessionKey),
      ])
      setLaps(lapData)
      setDrivers(driverData)
      setFilterDriver('all')
    } catch {
      setError('Failed to load lap data')
    } finally {
      setFetchingLaps(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchLapData(selectedKey)
  }, [selectedKey, fetchLapData])

  const validLaps = laps.filter((l) => l.lap_duration !== null && !l.is_pit_out_lap)
  const filteredLaps =
    filterDriver === 'all'
      ? validLaps
      : validLaps.filter((l) => l.driver_number === filterDriver)

  const sortedByTime = [...validLaps].sort(
    (a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity)
  )
  const top5 = sortedByTime.slice(0, 5)
  const overallFastest = sortedByTime[0]

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-24 w-[55%] animate-pulse rounded bg-white/5" />
        <p className="label-mono mt-8 text-[var(--text-dim)]">LOADING SESSIONS…</p>
      </div>
    )
  }

  const tick = (d: Driver | undefined) => (
    <span className="flex items-center gap-2">
      <span
        aria-hidden
        className="inline-block h-[2px] w-3"
        style={{ backgroundColor: `#${d?.team_colour ?? '444'}` }}
      />
      {d?.name_acronym ?? '—'}
    </span>
  )

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <SessionHeader
        ghost="LAPS"
        kicker="LAP TIMES"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetchingLaps ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : laps.length === 0 && selectedKey ? (
        (
          <p className="label-mono mt-16 text-[var(--text-dim)]">NO LAP DATA FOR THIS SESSION</p>
        )
      ) : (
        <>
          {/* ─── the fastest lap — the page's one accent moment ─── */}
          {overallFastest && (
            <FadeUp className="mt-16">
              <div className="border-t border-[var(--line)] pt-8">
                <p className="section-header flex items-center gap-2.5 text-[var(--accent)]">
                  FASTEST LAP
                  <span aria-hidden className="inline-block h-[2px] w-8 bg-[var(--accent)]" />
                </p>
                <p
                  className="mt-3 font-mono tabular-nums leading-none text-[var(--text)]"
                  style={{ fontSize: 'clamp(3rem, 8vw, 7.5rem)' }}
                >
                  {formatDuration(overallFastest.lap_duration!)}
                </p>
                <p className="label-mono mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
                  {tick(driverMap.get(overallFastest.driver_number))}
                  <span>LAP {overallFastest.lap_number}</span>
                  <span>{driverMap.get(overallFastest.driver_number)?.team_name?.toUpperCase()}</span>
                </p>
              </div>
            </FadeUp>
          )}

          {/* ─── top 5 ─── */}
          {top5.length > 0 && (
            <div className="mt-20">
              <FadeUp>
                <p className="section-header text-[var(--text-dim)]">TOP 5 FASTEST</p>
              </FadeUp>
              <div className="mt-6">
                {top5.map((lap, idx) => {
                  const driver = driverMap.get(lap.driver_number)
                  return (
                    <div
                      key={`${lap.driver_number}-${lap.lap_number}`}
                      className="label-mono flex items-baseline gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                    >
                      <span className="w-6 shrink-0 tabular-nums text-[var(--text-dim)]">
                        {idx + 1}
                      </span>
                      <span className="w-20 shrink-0 text-[var(--text)]">{tick(driver)}</span>
                      <span className="hidden flex-1 text-[var(--text-dim)] md:block">
                        {driver?.team_name?.toUpperCase()} · LAP {lap.lap_number}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] lg:block">
                        {lap.duration_sector_1 != null ? formatDuration(lap.duration_sector_1) : '—'}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] lg:block">
                        {lap.duration_sector_2 != null ? formatDuration(lap.duration_sector_2) : '—'}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] lg:block">
                        {lap.duration_sector_3 != null ? formatDuration(lap.duration_sector_3) : '—'}
                      </span>
                      <span
                        className="ml-auto shrink-0 text-right font-mono text-base tabular-nums"
                        style={{ color: idx === 0 ? 'var(--accent)' : 'var(--text)' }}
                      >
                        {formatDuration(lap.lap_duration!)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ─── all laps ─── */}
          {drivers.length > 0 && validLaps.length > 0 && (
            <div className="mt-20">
              <div className="flex flex-wrap items-baseline justify-between gap-4">
                <FadeUp>
                  <p className="section-header text-[var(--text-dim)]">
                    ALL LAPS — {filteredLaps.length}
                  </p>
                </FadeUp>
                {/* driver filter, menu grammar */}
                <div className="flex max-w-full flex-wrap gap-x-4 gap-y-2">
                  <button
                    type="button"
                    onClick={() => setFilterDriver('all')}
                    className={`label-mono transition-colors hover:text-[var(--accent)] ${
                      filterDriver === 'all' ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    ALL
                  </button>
                  {drivers.map((d) => (
                    <button
                      key={d.driver_number}
                      type="button"
                      onClick={() => setFilterDriver(d.driver_number)}
                      className={`label-mono transition-colors hover:text-[var(--accent)] ${
                        filterDriver === d.driver_number ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                      }`}
                    >
                      {d.name_acronym}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-6 max-h-[60vh] overflow-y-auto pr-2 [scrollbar-width:thin]">
                {filteredLaps.slice(0, 200).map((lap) => {
                  const driver = driverMap.get(lap.driver_number)
                  return (
                    <div
                      key={`${lap.driver_number}-${lap.lap_number}`}
                      className="label-mono flex items-baseline gap-5 border-t border-[var(--line)] py-2.5 md:gap-8"
                    >
                      <span className="w-20 shrink-0 text-[var(--text)]">{tick(driver)}</span>
                      <span className="w-14 shrink-0 tabular-nums text-[var(--text-dim)]">
                        L{lap.lap_number}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] md:block">
                        {lap.duration_sector_1 != null ? formatDuration(lap.duration_sector_1) : '—'}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] md:block">
                        {lap.duration_sector_2 != null ? formatDuration(lap.duration_sector_2) : '—'}
                      </span>
                      <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] md:block">
                        {lap.duration_sector_3 != null ? formatDuration(lap.duration_sector_3) : '—'}
                      </span>
                      <span className="ml-auto shrink-0 text-right tabular-nums text-[var(--text)]">
                        {formatDuration(lap.lap_duration!)}
                      </span>
                    </div>
                  )
                })}
                {filteredLaps.length > 200 && (
                  <p className="label-mono border-t border-[var(--line)] py-3 text-[var(--text-dim)]">
                    SHOWING FIRST 200 OF {filteredLaps.length}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
