'use client'

import { useEffect, useState } from 'react'
import type { Session, Driver, Position } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { RACE_POINTS, SPRINT_POINTS } from '@/lib/openf1'
import { getCachedDrivers, getCachedPositions } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'

interface DriverStanding {
  driverNumber: number
  fullName: string
  teamName: string
  teamColour: string
  nameAcronym: string
  points: number
  wins: number
  podiums: number
}

interface TeamStanding {
  teamName: string
  teamColour: string
  points: number
  wins: number
}

function getLatestPositions(positions: Position[]): Map<number, number> {
  const sorted = [...positions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const map = new Map<number, number>()
  for (const p of sorted) {
    if (!map.has(p.driver_number)) map.set(p.driver_number, p.position)
  }
  return map
}

// Fetch positions for multiple sessions in parallel, then retry any that came
// back empty (OpenF1 intermittently returns non-array responses). Parallel first
// pass keeps it fast; retries only fire for the rare failures.
async function fetchAllPositions(sessionKeys: number[]): Promise<Map<number, Position[]>> {
  // First pass: all in parallel
  const results = await Promise.all(
    sessionKeys.map(async (key) => ({ key, data: await getCachedPositions(key) }))
  )

  const map = new Map<number, Position[]>()
  const empties: number[] = []

  for (const { key, data } of results) {
    if (data.length > 0) map.set(key, data)
    else empties.push(key)
  }

  // Second pass: retry empties sequentially with a short delay
  for (const key of empties) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 600))
      const data = await getCachedPositions(key)
      if (data.length > 0) { map.set(key, data); break }
    }
  }

  return map
}

export default function StandingsPage() {
  const [driverStandings, setDriverStandings] = useState<DriverStanding[]>([])
  const [teamStandings, setTeamStandings] = useState<TeamStanding[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [completedRaces, setCompletedRaces] = useState(0)

  useEffect(() => {
    async function compute() {
      try {
        const allSessions = await getCachedSessions()
        const now = new Date()

        const completedRaceSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Race' &&
            new Date(s.date_end) < now
        )

        const completedSprintSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Sprint' &&
            new Date(s.date_end) < now
        )

        setCompletedRaces(completedRaceSessions.length)

        const allRaceSessions = [...completedRaceSessions, ...completedSprintSessions]

        // Fetch driver info and all race positions in parallel
        const driverRefKey = completedRaceSessions.length > 0
          ? [...completedRaceSessions].sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0].session_key
          : allSessions.filter((s) => new Date(s.date_end) < now).sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]?.session_key

        const [refDrivers, positionsMap] = await Promise.all([
          driverRefKey ? getCachedDrivers(driverRefKey) : Promise.resolve([] as Driver[]),
          fetchAllPositions(allRaceSessions.map((s) => s.session_key)),
        ])

        // Maps: driverNumber -> standing data
        const driverMap = new Map<number, DriverStanding>()
        const teamMap = new Map<string, TeamStanding>()

        for (const d of refDrivers) {
          if (!driverMap.has(d.driver_number)) {
            driverMap.set(d.driver_number, {
              driverNumber: d.driver_number,
              fullName: d.full_name,
              teamName: d.team_name,
              teamColour: d.team_colour,
              nameAcronym: d.name_acronym,
              points: 0,
              wins: 0,
              podiums: 0,
            })
          }
          if (!teamMap.has(d.team_name)) {
            teamMap.set(d.team_name, {
              teamName: d.team_name,
              teamColour: d.team_colour,
              points: 0,
              wins: 0,
            })
          }
        }

        const processSessions = (sessionsToProcess: Session[], pointsTable: number[]) => {
          for (const session of sessionsToProcess) {
            const positions = positionsMap.get(session.session_key)
            if (!positions || positions.length === 0) continue

            const latestPos = getLatestPositions(positions)
            latestPos.forEach((pos, driverNum) => {
              const pts = pos >= 1 && pos <= pointsTable.length ? pointsTable[pos - 1] : 0
              const ds = driverMap.get(driverNum)
              if (ds) {
                ds.points += pts
                if (pos === 1) ds.wins++
                if (pos <= 3) ds.podiums++
                driverMap.set(driverNum, ds)

                const ts = teamMap.get(ds.teamName)
                if (ts) {
                  ts.points += pts
                  if (pos === 1) ts.wins++
                  teamMap.set(ds.teamName, ts)
                }
              }
            })
          }
        }

        processSessions(completedRaceSessions, RACE_POINTS)
        processSessions(completedSprintSessions, SPRINT_POINTS)

        const sortedDrivers = Array.from(driverMap.values())
          .sort((a, b) => b.points - a.points || b.wins - a.wins)

        const sortedTeams = Array.from(teamMap.values())
          .sort((a, b) => b.points - a.points || b.wins - a.wins)

        setDriverStandings(sortedDrivers)
        setTeamStandings(sortedTeams)
      } catch {
        setError('Failed to compute standings')
      } finally {
        setLoading(false)
      }
    }
    compute()
  }, [])

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
          <div className="h-64 bg-zinc-900/60 border border-zinc-800/50 rounded-xl mt-6" />
        </div>
        <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-600 mt-6 animate-pulse">
          Computing standings...
        </p>
      </div>
    )
  }

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
          2026 Season
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">
          Standings
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          After {completedRaces} race{completedRaces !== 1 ? 's' : ''}
        </p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {driverStandings.length === 0 ? (
        <EmptyState
          title="No standings yet"
          message="Standings will update as races complete throughout the 2026 season."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Drivers Championship */}
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
              Drivers Championship
            </p>
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/40">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-10">
                      Pos
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                      Driver
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {driverStandings.map((d, idx) => (
                    <tr key={d.driverNumber} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-black text-zinc-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-0.5 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `#${d.teamColour}` }}
                          />
                          <div>
                            <p className="text-sm text-zinc-200 font-medium">{d.fullName}</p>
                            <p className="text-[10px] text-zinc-600">{d.teamName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black text-zinc-100 tabular-nums">
                          {d.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Constructors Championship */}
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
              Constructors Championship
            </p>
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-800/40">
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-10">
                      Pos
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                      Constructor
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                      Pts
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {teamStandings.map((t, idx) => (
                    <tr key={t.teamName} className="hover:bg-zinc-800/20 transition-colors">
                      <td className="px-4 py-3 text-sm font-black text-zinc-400 tabular-nums">
                        {idx + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="w-1 h-5 rounded-full flex-shrink-0"
                            style={{ backgroundColor: `#${t.teamColour}` }}
                          />
                          <span className="text-sm text-zinc-200 font-medium">{t.teamName}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black text-zinc-100 tabular-nums">
                          {t.points}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
