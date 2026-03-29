'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Stint, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedStints, getCachedDrivers } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

const COMPOUND_STYLES: Record<string, { text: string; bg: string; border: string; label: string }> = {
  SOFT:         { text: 'text-red-400',    bg: 'bg-red-950/30',    border: 'border-red-800/40',    label: 'S' },
  MEDIUM:       { text: 'text-yellow-400', bg: 'bg-yellow-950/30', border: 'border-yellow-800/40', label: 'M' },
  HARD:         { text: 'text-zinc-200',   bg: 'bg-zinc-800/40',   border: 'border-zinc-600/40',   label: 'H' },
  INTERMEDIATE: { text: 'text-green-400',  bg: 'bg-green-950/30',  border: 'border-green-800/40',  label: 'I' },
  WET:          { text: 'text-blue-400',   bg: 'bg-blue-950/30',   border: 'border-blue-800/40',   label: 'W' },
}

function getCompoundStyle(compound: string) {
  return COMPOUND_STYLES[compound?.toUpperCase()] ?? {
    text: 'text-zinc-400',
    bg: 'bg-zinc-900/40',
    border: 'border-zinc-800/40',
    label: compound?.[0] ?? '?',
  }
}

interface DriverStints {
  driver: Driver | undefined
  driverNumber: number
  stints: Stint[]
}

export default function StintsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [stints, setStints] = useState<Stint[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        const sorted = all.sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )
        setSessions(sorted)
        // Default to latest completed race
        const latestRace = sorted.find(
          (s) => (s.session_type === 'Race' || s.session_name === 'Sprint') && new Date(s.date_end) < new Date()
        )
        if (latestRace) setSelectedKey(latestRace.session_key)
        else {
          const latest = sorted.find((s) => new Date(s.date_end) < new Date())
          if (latest) setSelectedKey(latest.session_key)
        }
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchData = useCallback(async (sessionKey: number) => {
    setFetching(true)
    setError(null)
    try {
      const [stintData, driverData] = await Promise.all([
        getCachedStints(sessionKey),
        getCachedDrivers(sessionKey),
      ])
      setStints(stintData)
      setDrivers(driverData)
    } catch {
      setError('Failed to load stint data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

  // Group stints by driver, sort by their final position (by last lap_end descending)
  const groupedByDriver: DriverStints[] = []
  const driverNums = [...new Set(stints.map((s) => s.driver_number))]
  for (const num of driverNums) {
    const driverStints = stints
      .filter((s) => s.driver_number === num)
      .sort((a, b) => a.stint_number - b.stint_number)
    groupedByDriver.push({
      driver: driverMap.get(num),
      driverNumber: num,
      stints: driverStints,
    })
  }
  // Sort groups by driver number (proxy for grid order)
  groupedByDriver.sort((a, b) => {
    const aMax = Math.max(...a.stints.map((s) => s.lap_end ?? 0))
    const bMax = Math.max(...b.stints.map((s) => s.lap_end ?? 0))
    return bMax - aMax || a.driverNumber - b.driverNumber
  })

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-36 bg-zinc-800 rounded" />
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
          Tyre Stints
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          Compound strategy and tyre usage per driver
        </p>
      </div>

      {/* Compound legend */}
      <div className="flex flex-wrap gap-2 mb-6">
        {Object.entries(COMPOUND_STYLES).map(([compound, style]) => (
          <span
            key={compound}
            className={`px-2.5 py-1 rounded-md border text-[10px] font-black tracking-widest uppercase ${style.text} ${style.bg} ${style.border}`}
          >
            {compound}
          </span>
        ))}
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

      {fetching ? (
        <div className="space-y-3 animate-pulse">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-20 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
          ))}
        </div>
      ) : stints.length === 0 ? (
        <EmptyState
          title="No stint data"
          message={
            selectedKey
              ? 'No tyre stint data recorded for this session.'
              : 'Select a session to view tyre stints.'
          }
        />
      ) : (
        <div className="space-y-px border border-zinc-800/50 rounded-xl overflow-hidden">
          {groupedByDriver.map(({ driver, driverNumber, stints: driverStints }) => {
            const teamColor = driver?.team_colour ? `#${driver.team_colour}` : '#52525b'
            const totalLaps = Math.max(...driverStints.map((s) => s.lap_end ?? 0))

            return (
              <div
                key={driverNumber}
                className="flex items-center gap-4 px-4 py-3 bg-zinc-900/40 hover:bg-zinc-800/20 transition-colors"
              >
                {/* Driver */}
                <div className="w-32 flex-shrink-0 flex items-center gap-2">
                  <div
                    className="w-0.5 h-5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: teamColor }}
                  />
                  <div>
                    <p className="text-xs font-black tracking-wider uppercase text-zinc-200">
                      {driver?.name_acronym ?? `#${driverNumber}`}
                    </p>
                    <p className="text-[10px] text-zinc-600">
                      #{driverNumber}
                    </p>
                  </div>
                </div>

                {/* Stints */}
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  {driverStints.map((stint) => {
                    const style = getCompoundStyle(stint.compound)
                    const laps = (stint.lap_end ?? stint.lap_start) - stint.lap_start + 1
                    return (
                      <div
                        key={stint.stint_number}
                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border ${style.bg} ${style.border}`}
                        title={`${stint.compound} — Laps ${stint.lap_start}–${stint.lap_end ?? '?'} (${laps} laps, age ${stint.tyre_age_at_start})`}
                      >
                        <span className={`text-[11px] font-black tracking-wider ${style.text}`}>
                          {style.label}
                        </span>
                        <span className="text-[10px] text-zinc-500 tabular-nums">
                          {stint.lap_start}–{stint.lap_end ?? '?'}
                        </span>
                        <span className="text-[10px] text-zinc-700 tabular-nums">
                          ({laps}L)
                        </span>
                        {stint.tyre_age_at_start > 0 && (
                          <span className="text-[9px] text-zinc-700 tabular-nums">
                            +{stint.tyre_age_at_start}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Total laps */}
                <div className="flex-shrink-0 text-right">
                  <span className="text-[11px] text-zinc-600 tabular-nums">
                    {totalLaps} laps
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
