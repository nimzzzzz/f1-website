'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Lap, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { formatDuration } from '@/lib/openf1'
import { getCachedLaps, getCachedDrivers } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

interface FastestLap {
  lap: Lap
  driver: Driver | undefined
}

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

  // Fastest laps overall
  const sortedByTime = [...validLaps].sort(
    (a, b) => (a.lap_duration ?? Infinity) - (b.lap_duration ?? Infinity)
  )
  const top5 = sortedByTime.slice(0, 5)
  const overallFastest = sortedByTime[0]

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

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
          Lap Times
        </h1>
      </div>

      {/* Session picker */}
      <div className="mb-8 max-w-sm">
        <SessionPicker
          sessions={sessions}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          label="Select Session"
        />
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {fetchingLaps ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-24 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
          <div className="h-48 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
        </div>
      ) : laps.length === 0 && selectedKey ? (
        <EmptyState title="No lap data" message="No lap times recorded for this session yet." />
      ) : (
        <>
          {/* Fastest lap highlight */}
          {overallFastest && (
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl p-5 mb-6">
              <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-2">
                Fastest Lap
              </p>
              <div className="flex items-center gap-4">
                <span className="text-2xl font-black tracking-tighter text-purple-400 tabular-nums">
                  {formatDuration(overallFastest.lap_duration!)}
                </span>
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    {driverMap.get(overallFastest.driver_number)?.full_name ?? `#${overallFastest.driver_number}`}
                  </p>
                  <p className="text-[11px] text-zinc-600">
                    Lap {overallFastest.lap_number} ·{' '}
                    {driverMap.get(overallFastest.driver_number)?.team_name}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Top 5 fastest */}
          {top5.length > 0 && (
            <div className="mb-8">
              <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
                Top 5 Fastest Laps
              </p>
              <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/40">
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-10">
                        #
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Driver
                      </th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Lap
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Time
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden lg:table-cell">
                        S1
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden lg:table-cell">
                        S2
                      </th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden lg:table-cell">
                        S3
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {top5.map((lap, idx) => {
                      const driver = driverMap.get(lap.driver_number)
                      return (
                        <tr key={`${lap.driver_number}-${lap.lap_number}`} className="hover:bg-zinc-800/20 transition-colors">
                          <td className="px-5 py-3 text-sm font-black text-zinc-500 tabular-nums">
                            {idx + 1}
                          </td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              {driver && (
                                <div
                                  className="w-0.5 h-4 rounded-full"
                                  style={{ backgroundColor: `#${driver.team_colour}` }}
                                />
                              )}
                              <span className="text-sm text-zinc-300 font-medium">
                                {driver?.full_name ?? `#${lap.driver_number}`}
                              </span>
                            </div>
                          </td>
                          <td className="px-5 py-3 text-sm text-zinc-400 tabular-nums">
                            {lap.lap_number}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <span className={`text-sm font-black tabular-nums ${idx === 0 ? 'text-purple-400' : 'text-zinc-300'}`}>
                              {formatDuration(lap.lap_duration!)}
                            </span>
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-zinc-500 tabular-nums hidden lg:table-cell">
                            {lap.duration_sector_1 != null ? formatDuration(lap.duration_sector_1) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-zinc-500 tabular-nums hidden lg:table-cell">
                            {lap.duration_sector_2 != null ? formatDuration(lap.duration_sector_2) : '—'}
                          </td>
                          <td className="px-5 py-3 text-right text-sm text-zinc-500 tabular-nums hidden lg:table-cell">
                            {lap.duration_sector_3 != null ? formatDuration(lap.duration_sector_3) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Filter by driver */}
          {drivers.length > 0 && validLaps.length > 0 && (
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase">
                  All Laps ({filteredLaps.length})
                </p>
                <div className="relative max-w-[200px]">
                  <select
                    value={filterDriver}
                    onChange={(e) =>
                      setFilterDriver(e.target.value === 'all' ? 'all' : Number(e.target.value))
                    }
                    className="w-full appearance-none bg-zinc-900 border border-zinc-800/50 rounded-lg px-3 py-2 pr-8 text-xs text-zinc-300 focus:outline-none"
                  >
                    <option value="all">All Drivers</option>
                    {drivers.map((d) => (
                      <option key={d.driver_number} value={d.driver_number}>
                        {d.name_acronym} — #{d.driver_number}
                      </option>
                    ))}
                  </select>
                  <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
                    <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                      <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              </div>

              <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
                <div className="max-h-[480px] overflow-y-auto">
                  <table className="w-full">
                    <thead className="sticky top-0 bg-zinc-900 z-10">
                      <tr className="border-b border-zinc-800/40">
                        <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                          Driver
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                          Lap
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                          Time
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                          S1
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                          S2
                        </th>
                        <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                          S3
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800/40">
                      {filteredLaps.slice(0, 200).map((lap) => {
                        const driver = driverMap.get(lap.driver_number)
                        return (
                          <tr
                            key={`${lap.driver_number}-${lap.lap_number}`}
                            className="hover:bg-zinc-800/20 transition-colors"
                          >
                            <td className="px-4 py-2.5">
                              <div className="flex items-center gap-2">
                                {driver && (
                                  <div
                                    className="w-0.5 h-4 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: `#${driver.team_colour}` }}
                                  />
                                )}
                                <span className="text-xs text-zinc-400 font-medium">
                                  {driver?.name_acronym ?? `#${lap.driver_number}`}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-zinc-500 text-right tabular-nums">
                              {lap.lap_number}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs font-bold text-zinc-300 tabular-nums">
                              {formatDuration(lap.lap_duration!)}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-zinc-600 tabular-nums hidden md:table-cell">
                              {lap.duration_sector_1 != null ? formatDuration(lap.duration_sector_1) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-zinc-600 tabular-nums hidden md:table-cell">
                              {lap.duration_sector_2 != null ? formatDuration(lap.duration_sector_2) : '—'}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-zinc-600 tabular-nums hidden md:table-cell">
                              {lap.duration_sector_3 != null ? formatDuration(lap.duration_sector_3) : '—'}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {filteredLaps.length > 200 && (
                  <div className="px-4 py-2 border-t border-zinc-800/40 text-[11px] text-zinc-600">
                    Showing first 200 of {filteredLaps.length} laps
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
