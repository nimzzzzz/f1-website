'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Position, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedPositions, getCachedDrivers } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

interface DriverPosition {
  driverNumber: number
  driver: Driver | undefined
  currentPosition: number
  startPosition: number | null
  positionChange: number | null
}

export default function PositionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [driverPositions, setDriverPositions] = useState<DriverPosition[]>([])
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
      const [positions, drivers] = await Promise.all([
        getCachedPositions(sessionKey),
        getCachedDrivers(sessionKey),
      ])

      const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

      // Get start positions (earliest entry per driver)
      const startPositions = new Map<number, number>()
      const sorted = [...positions].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      for (const p of sorted) {
        if (!startPositions.has(p.driver_number)) startPositions.set(p.driver_number, p.position)
      }

      // Get final positions (latest entry per driver)
      const finalPositions = new Map<number, number>()
      const sortedDesc = [...positions].sort(
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
      setDriverPositions(rows)
    } catch {
      setError('Failed to load position data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

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
          Positions
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
        <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-zinc-800/40 last:border-0" />
          ))}
        </div>
      ) : driverPositions.length === 0 ? (
        <EmptyState
          title="No position data"
          message={selectedKey ? 'Position data not yet available for this session.' : 'Select a race session to view positions.'}
        />
      ) : (
        <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/40">
                <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-12">
                  Pos
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                  Driver
                </th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">
                  Team
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                  Start
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                  Change
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/40">
              {driverPositions.map((row) => {
                const gained = row.positionChange !== null && row.positionChange > 0
                const lost = row.positionChange !== null && row.positionChange < 0
                return (
                  <tr
                    key={row.driverNumber}
                    className="hover:bg-zinc-800/20 transition-colors"
                  >
                    <td className="px-5 py-3.5 text-sm font-black tabular-nums">
                      <span
                        className={
                          row.currentPosition === 1
                            ? 'text-yellow-400'
                            : row.currentPosition === 2
                            ? 'text-zinc-300'
                            : row.currentPosition === 3
                            ? 'text-amber-600'
                            : 'text-zinc-400'
                        }
                      >
                        {row.currentPosition}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        {row.driver && (
                          <div
                            className="w-0.5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `#${row.driver.team_colour}` }}
                          />
                        )}
                        <div>
                          <p className="text-sm text-zinc-200 font-medium">
                            {row.driver?.full_name ?? `#${row.driverNumber}`}
                          </p>
                          <p className="text-[10px] text-zinc-600">
                            #{row.driverNumber} · {row.driver?.name_acronym}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-400 hidden md:table-cell">
                      {row.driver?.team_name ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-zinc-500 text-right tabular-nums">
                      {row.startPosition ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right tabular-nums">
                      {row.positionChange === null ? (
                        <span className="text-zinc-600 text-sm">—</span>
                      ) : row.positionChange === 0 ? (
                        <span className="text-zinc-600 text-sm">—</span>
                      ) : (
                        <span
                          className={`text-sm font-bold ${gained ? 'text-green-500' : 'text-red-500'}`}
                        >
                          {gained ? '+' : ''}{row.positionChange}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
