'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Stint, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedStints, getCachedDrivers } from '@/lib/client-cache'
import SessionHeader from '@/components/session/SessionHeader'
import { FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

// Compound colours are the dataset here — the page's only non-mono colour.
const COMPOUNDS: Record<string, { colour: string; label: string }> = {
  SOFT: { colour: '#EF4444', label: 'S' },
  MEDIUM: { colour: '#FACC15', label: 'M' },
  HARD: { colour: '#F5F5F3', label: 'H' },
  INTERMEDIATE: { colour: '#4ADE80', label: 'I' },
  WET: { colour: '#60A5FA', label: 'W' },
}

function getCompound(compound: string) {
  return (
    COMPOUNDS[compound?.toUpperCase()] ?? {
      colour: 'rgba(245,245,243,0.4)',
      label: compound?.[0] ?? '?',
    }
  )
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
  const apiBlocked = useApiBlocked()

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

  // Group stints by driver (existing grouping/sorting logic)
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
  groupedByDriver.sort((a, b) => {
    const aMax = Math.max(...a.stints.map((s) => s.lap_end ?? 0))
    const bMax = Math.max(...b.stints.map((s) => s.lap_end ?? 0))
    return bMax - aMax || a.driverNumber - b.driverNumber
  })

  const sessionMaxLap = groupedByDriver.reduce(
    (max, g) => Math.max(max, ...g.stints.map((s) => s.lap_end ?? 0)),
    0
  )

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
        ghost="TYRE"
        kicker="TYRES &amp; STINTS"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* compound key — the dataset's colours, mono glyphs */}
      <div className="label-mono mt-8 flex flex-wrap gap-x-8 gap-y-2 text-[var(--text-dim)]">
        {Object.entries(COMPOUNDS).map(([name, c]) => (
          <span key={name} className="flex items-center gap-2">
            <span className="font-mono" style={{ color: c.colour }}>
              {c.label}
            </span>
            {name}
          </span>
        ))}
      </div>

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetching ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 w-[70%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : stints.length === 0 ? (
        !apiBlocked && (
          <p className="label-mono mt-16 text-[var(--text-dim)]">
            {selectedKey ? 'NO STINT DATA FOR THIS SESSION' : 'SELECT A SESSION'}
          </p>
        )
      ) : (
        <div className="mt-14">
          <FadeUp>
            <p className="label-mono text-[var(--text-dim)]">
              STRATEGY — {String(groupedByDriver.length).padStart(2, '0')} DRIVERS · {sessionMaxLap}{' '}
              LAPS
            </p>
          </FadeUp>
          <div className="mt-6">
            {groupedByDriver.map(({ driver, driverNumber, stints: driverStints }) => {
              const totalLaps = Math.max(...driverStints.map((s) => s.lap_end ?? 0))
              return (
                <div
                  key={driverNumber}
                  className="flex items-center gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                >
                  <span className="label-mono flex w-24 shrink-0 items-center gap-2 text-[var(--text)]">
                    <span
                      aria-hidden
                      className="inline-block h-[2px] w-3"
                      style={{ backgroundColor: `#${driver?.team_colour ?? '444'}` }}
                    />
                    {driver?.name_acronym ?? `#${driverNumber}`}
                  </span>

                  {/* proportional stint track — compound-colour segments */}
                  <div className="flex h-7 min-w-0 flex-1 items-stretch gap-px">
                    {driverStints.map((stint) => {
                      const c = getCompound(stint.compound)
                      const laps = (stint.lap_end ?? stint.lap_start) - stint.lap_start + 1
                      const width = sessionMaxLap > 0 ? (laps / sessionMaxLap) * 100 : 0
                      return (
                        <div
                          key={stint.stint_number}
                          className="label-mono flex items-center gap-1.5 overflow-hidden px-2"
                          style={{
                            width: `${Math.max(width, 4)}%`,
                            backgroundColor: `${c.colour}14`,
                            boxShadow: `inset 0 1px 0 ${c.colour}55, inset 0 -1px 0 ${c.colour}22`,
                          }}
                          title={`${stint.compound} — laps ${stint.lap_start}–${stint.lap_end ?? '?'}${
                            stint.tyre_age_at_start > 0 ? ` (used +${stint.tyre_age_at_start})` : ''
                          }`}
                        >
                          <span className="font-mono" style={{ color: c.colour }}>
                            {c.label}
                          </span>
                          <span className="hidden whitespace-nowrap tabular-nums text-[var(--text-dim)] lg:inline">
                            {laps}L{stint.tyre_age_at_start > 0 ? ` +${stint.tyre_age_at_start}` : ''}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  <span className="label-mono w-16 shrink-0 text-right tabular-nums text-[var(--text-dim)]">
                    {totalLaps} L
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
