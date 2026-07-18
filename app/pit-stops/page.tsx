'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, PitStop, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedPitStops, getCachedDrivers } from '@/lib/client-cache'
import SessionHeader from '@/components/session/SessionHeader'
import { FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

function formatPitDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return '—'
  return `${seconds.toFixed(2)}s`
}

export default function PitStopsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [pitStops, setPitStops] = useState<PitStop[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const apiBlocked = useApiBlocked()

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        const raceSessions = all
          .filter((s) => s.session_type === 'Race')
          .sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())
        setSessions(raceSessions)
        const latest = raceSessions.find((s) => new Date(s.date_end) < new Date())
        if (latest) setSelectedKey(latest.session_key)
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchData = useCallback(async (sessionKey: number) => {
    setFetching(true)
    setError(null)
    try {
      const [pits, driverList] = await Promise.all([
        getCachedPitStops(sessionKey),
        getCachedDrivers(sessionKey),
      ])
      setPitStops(pits.sort((a, b) => (a.lap_number ?? 0) - (b.lap_number ?? 0)))
      setDrivers(driverList)
    } catch {
      setError('Failed to load pit stop data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

  const validStops = pitStops.filter((p) => p.pit_duration !== null)
  const fastestStop = validStops.reduce<PitStop | null>((best, p) => {
    if (!best) return p
    return (p.pit_duration ?? Infinity) < (best.pit_duration ?? Infinity) ? p : best
  }, null)
  const avgDuration =
    validStops.length > 0
      ? validStops.reduce((sum, p) => sum + (p.pit_duration ?? 0), 0) / validStops.length
      : null

  const stopsPerDriver = pitStops.reduce<Record<number, number>>((acc, p) => {
    acc[p.driver_number] = (acc[p.driver_number] ?? 0) + 1
    return acc
  }, {})

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
        ghost="PIT"
        kicker="PIT STOPS"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetching ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : pitStops.length === 0 ? (
        !apiBlocked && (
          <p className="label-mono mt-16 text-[var(--text-dim)]">
            {selectedKey ? 'NO PIT STOPS RECORDED' : 'SELECT A RACE SESSION'}
          </p>
        )
      ) : (
        <>
          {/* ─── the stationary time IS the drama ─── */}
          <div className="mt-16 flex flex-wrap items-baseline gap-x-20 gap-y-10">
            {fastestStop && (
              <FadeUp>
                <p className="label-mono flex items-center gap-2.5 text-[var(--accent)]">
                  FASTEST STOP
                  <span aria-hidden className="inline-block h-[2px] w-8 bg-[var(--accent)]" />
                </p>
                <p
                  className="mt-3 font-mono tabular-nums leading-none text-[var(--text)]"
                  style={{ fontSize: 'clamp(4rem, 10vw, 9rem)' }}
                >
                  {formatPitDuration(fastestStop.pit_duration)}
                </p>
                <p className="label-mono mt-4 flex items-center gap-2 text-[var(--text-dim)]">
                  <span
                    aria-hidden
                    className="inline-block h-[2px] w-3"
                    style={{
                      backgroundColor: `#${driverMap.get(fastestStop.driver_number)?.team_colour ?? '444'}`,
                    }}
                  />
                  {driverMap.get(fastestStop.driver_number)?.name_acronym ?? `#${fastestStop.driver_number}`}
                  <span>· LAP {fastestStop.lap_number ?? '—'}</span>
                </p>
              </FadeUp>
            )}
            <FadeUp delay={0.1}>
              <p
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
              >
                {avgDuration !== null ? formatPitDuration(avgDuration) : '—'}
              </p>
              <p className="label-mono mt-3 text-[var(--text-dim)]">AVERAGE</p>
            </FadeUp>
            <FadeUp delay={0.18}>
              <p
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
              >
                {pitStops.length}
              </p>
              <p className="label-mono mt-3 text-[var(--text-dim)]">TOTAL STOPS</p>
            </FadeUp>
          </div>

          {/* ─── every stop ─── */}
          <div className="mt-20">
            <FadeUp>
              <p className="label-mono text-[var(--text-dim)]">EVERY STOP — IN LAP ORDER</p>
            </FadeUp>
            <div className="mt-6">
              {pitStops.map((stop, idx) => {
                const driver = driverMap.get(stop.driver_number)
                const isFastest = fastestStop !== null && stop === fastestStop
                return (
                  <div
                    key={idx}
                    className="label-mono flex items-baseline gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                  >
                    <span className="w-14 shrink-0 tabular-nums text-[var(--text-dim)]">
                      L{stop.lap_number ?? '—'}
                    </span>
                    <span className="flex w-24 shrink-0 items-center gap-2 text-[var(--text)]">
                      <span
                        aria-hidden
                        className="inline-block h-[2px] w-3"
                        style={{ backgroundColor: `#${driver?.team_colour ?? '444'}` }}
                      />
                      {driver?.name_acronym ?? `#${stop.driver_number}`}
                    </span>
                    <span className="hidden min-w-0 flex-1 truncate text-[var(--text-dim)] md:block">
                      {driver?.team_name?.toUpperCase()}
                    </span>
                    <span className="hidden w-24 shrink-0 text-right tabular-nums text-[var(--text-dim)] md:block">
                      STOP {stopsPerDriver[stop.driver_number] > 1 ? `OF ${stopsPerDriver[stop.driver_number]}` : '1'}
                    </span>
                    <span
                      className="ml-auto shrink-0 text-right font-mono text-lg tabular-nums"
                      style={{ color: isFastest ? 'var(--accent)' : 'var(--text)' }}
                    >
                      {formatPitDuration(stop.pit_duration)}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
