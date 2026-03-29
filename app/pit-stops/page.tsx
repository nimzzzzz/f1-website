'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, PitStop, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedPitStops, getCachedDrivers } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

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

  // Stats
  const validStops = pitStops.filter((p) => p.pit_duration !== null)
  const fastestStop = validStops.reduce<PitStop | null>((best, p) => {
    if (!best) return p
    return (p.pit_duration ?? Infinity) < (best.pit_duration ?? Infinity) ? p : best
  }, null)
  const avgDuration =
    validStops.length > 0
      ? validStops.reduce((sum, p) => sum + (p.pit_duration ?? 0), 0) / validStops.length
      : null

  // Stops per driver
  const stopsPerDriver = pitStops.reduce<Record<number, number>>((acc, p) => {
    acc[p.driver_number] = (acc[p.driver_number] ?? 0) + 1
    return acc
  }, {})

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
          2026 Season
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">
          Pit Stops
        </h1>
      </div>

      {/* Session picker */}
      <div className="mb-8 max-w-sm">
        <SessionPicker
          sessions={sessions}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          label="Select Race Session"
        />
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
        </div>
      ) : pitStops.length === 0 ? (
        <EmptyState
          title="No pit stop data"
          message={selectedKey ? 'No pit stops recorded for this session.' : 'Select a race session to view pit stop data.'}
        />
      ) : (
        <>
          {/* Stats strip */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl p-5">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-1">
                Total Stops
              </p>
              <p className="text-3xl font-black text-zinc-100">{pitStops.length}</p>
            </div>
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl p-5">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-1">
                Fastest Stop
              </p>
              <p className="text-3xl font-black text-zinc-100 tabular-nums">
                {fastestStop ? formatPitDuration(fastestStop.pit_duration) : '—'}
              </p>
              {fastestStop && (
                <p className="text-[11px] text-zinc-600 mt-1">
                  {driverMap.get(fastestStop.driver_number)?.name_acronym ?? `#${fastestStop.driver_number}`}
                </p>
              )}
            </div>
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl p-5">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-1">
                Average Stop
              </p>
              <p className="text-3xl font-black text-zinc-100 tabular-nums">
                {avgDuration !== null ? formatPitDuration(avgDuration) : '—'}
              </p>
            </div>
          </div>

          {/* Pit stops table */}
          <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-800/40">
                  <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                    Driver
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                    Lap
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                    Duration
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                    Stop #
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                    Total Stops
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {pitStops.map((stop, idx) => {
                  const driver = driverMap.get(stop.driver_number)
                  const isFastest = fastestStop && stop === fastestStop
                  return (
                    <tr key={idx} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          {driver && (
                            <div
                              className="w-0.5 h-5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: `#${driver.team_colour}` }}
                            />
                          )}
                          <div>
                            <p className="text-sm text-zinc-200 font-medium">
                              {driver?.full_name ?? `#${stop.driver_number}`}
                            </p>
                            <p className="text-[10px] text-zinc-600">
                              {driver?.team_name}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-zinc-400 text-right tabular-nums">
                        {stop.lap_number ?? '—'}
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span
                          className={`text-sm font-bold tabular-nums ${isFastest ? 'text-purple-400' : 'text-zinc-300'}`}
                        >
                          {formatPitDuration(stop.pit_duration)}
                        </span>
                        {isFastest && (
                          <span className="ml-1.5 text-[9px] font-bold tracking-wider text-purple-500 uppercase">
                            Fastest
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-zinc-500 text-right tabular-nums hidden md:table-cell">
                        —
                      </td>
                      <td className="px-5 py-3.5 text-sm text-zinc-500 text-right tabular-nums hidden md:table-cell">
                        {stopsPerDriver[stop.driver_number] ?? 1}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
