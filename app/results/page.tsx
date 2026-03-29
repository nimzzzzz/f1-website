'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Session, Driver, Position } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedDrivers, getCachedPositions, getCachedPitStops } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

interface DriverResult {
  position: number
  driver: Driver
  pitStops: number
}

function getLatestPositions(positions: Position[]): Map<number, number> {
  const sorted = [...positions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const map = new Map<number, number>()
  for (const p of sorted) {
    if (!map.has(p.driver_number)) {
      map.set(p.driver_number, p.position)
    }
  }
  return map
}

export default function ResultsPage() {
  const allSessionsRef = useRef<Session[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [results, setResults] = useState<DriverResult[]>([])
const [loading, setLoading] = useState(true)
  const [fetchingResults, setFetchingResults] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        allSessionsRef.current = all
        const allSorted = [...all].sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )
        setSessions(allSorted)

        const latest = allSorted.find((s) => new Date(s.date_end) < new Date())
        if (latest) setSelectedKey(latest.session_key)
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchResults = useCallback(async (sessionKey: number) => {
    setFetchingResults(true)
    setError(null)

    try {
      const [driverList, positions, pitStops] = await Promise.all([
        getCachedDrivers(sessionKey),
        getCachedPositions(sessionKey),
        getCachedPitStops(sessionKey),
      ])

      const latestPos = getLatestPositions(positions)
      const pitCount = pitStops.reduce<Record<number, number>>((acc, p) => {
        acc[p.driver_number] = (acc[p.driver_number] ?? 0) + 1
        return acc
      }, {})
      const driverMap = new Map(driverList.map((d) => [d.driver_number, d]))

      const resultRows: DriverResult[] = []
      latestPos.forEach((pos, driverNum) => {
        const driver = driverMap.get(driverNum)
        if (driver) {
          resultRows.push({ position: pos, driver, pitStops: pitCount[driverNum] ?? 0 })
        }
      })
      resultRows.sort((a, b) => a.position - b.position)
      setResults(resultRows)

    } catch {
      setError('Failed to load results')
    } finally {
      setFetchingResults(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchResults(selectedKey)
  }, [selectedKey, fetchResults])

  const selectedSession = sessions.find((s) => s.session_key === selectedKey)

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
          <div className="h-48 bg-zinc-900/60 border border-zinc-800/50 rounded-xl mt-6" />
        </div>
      </div>
    )
  }

  const ResultTable = ({ rows, showPits }: { rows: (DriverResult | QualifyingResult)[], showPits: boolean }) => (
    <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-800/40">
            <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-12">Pos</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Driver</th>
            <th className="px-5 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase hidden md:table-cell">Team</th>
            {showPits && (
              <th className="px-5 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">Pit Stops</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/40">
          {rows.map((row) => (
            <tr key={row.driver.driver_number} className="hover:bg-zinc-800/20 transition-colors">
              <td className="px-5 py-3.5 text-sm font-black text-zinc-100 tabular-nums">
                {row.position <= 3 ? (
                  <span className={row.position === 1 ? 'text-yellow-400' : row.position === 2 ? 'text-zinc-300' : 'text-amber-600'}>
                    {row.position}
                  </span>
                ) : (
                  row.position
                )}
              </td>
              <td className="px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className="w-0.5 h-5 rounded-full flex-shrink-0" style={{ backgroundColor: `#${row.driver.team_colour}` }} />
                  <div>
                    <p className="text-sm text-zinc-200 font-medium">{row.driver.full_name}</p>
                    <p className="text-[10px] text-zinc-600 font-bold tracking-wider">#{row.driver.driver_number} · {row.driver.name_acronym}</p>
                  </div>
                </div>
              </td>
              <td className="px-5 py-3.5 text-sm text-zinc-400 hidden md:table-cell">{row.driver.team_name}</td>
              {showPits && (
                <td className="px-5 py-3.5 text-sm text-zinc-400 text-right tabular-nums">{'pitStops' in row ? row.pitStops : 0}</td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
          2026 Season
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">
          Race Results
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

      {selectedSession && (
        <div className="mb-6">
          <h2 className="text-xl font-bold text-zinc-100">
            {selectedSession.location} — {selectedSession.session_name}
          </h2>
          <p className="text-sm text-zinc-500 mt-0.5">
            {new Date(selectedSession.date_start).toLocaleDateString('en-US', {
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </p>
        </div>
      )}

      {fetchingResults ? (
        <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden animate-pulse">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-12 border-b border-zinc-800/40 last:border-0" />
          ))}
        </div>
      ) : results.length === 0 ? (
        <EmptyState
          title="No results available"
          message={
            selectedKey
              ? 'Position data has not been recorded for this session yet.'
              : 'Select a race session to view results.'
          }
        />
      ) : (
        <ResultTable rows={results} showPits={true} />
      )}
    </div>
  )
}
