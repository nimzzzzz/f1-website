'use client'

import { useEffect, useState } from 'react'
import type { Session, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { CANCELLED_COUNTRIES, fetchAllSessionResults } from '@/lib/openf1'
import { getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { DRIVER_PHOTOS } from '@/lib/driver-data'

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
        const notCancelled = (s: Session) => !CANCELLED_COUNTRIES.has(s.country_name)

        const completedRaceSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Race' &&
            new Date(s.date_end) < now &&
            notCancelled(s)
        )

        const completedSprintSessions = allSessions.filter(
          (s) =>
            s.session_type === 'Race' &&
            s.session_name === 'Sprint' &&
            new Date(s.date_end) < now &&
            notCancelled(s)
        )

        setCompletedRaces(completedRaceSessions.length)

        const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]

        const driverRefKey = completedRaceSessions.length > 0
          ? [...completedRaceSessions].sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0].session_key
          : allSessions.filter((s) => new Date(s.date_end) < now && notCancelled(s)).sort((a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime())[0]?.session_key

        const [refDrivers, resultsMap] = await Promise.all([
          driverRefKey ? getCachedDrivers(driverRefKey) : Promise.resolve([] as Driver[]),
          fetchAllSessionResults(allPointsSessions.map((s) => s.session_key), getCachedSessionResult),
        ])

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

        for (const session of allPointsSessions) {
          const results = resultsMap.get(session.session_key)
          if (!results) continue
          for (const r of results) {
            const ds = driverMap.get(r.driver_number)
            if (ds) {
              ds.points += r.points ?? 0
              if (r.position === 1) ds.wins++
              if (r.position !== null && r.position <= 3) ds.podiums++

              const ts = teamMap.get(ds.teamName)
              if (ts) {
                ts.points += r.points ?? 0
                if (r.position === 1) ts.wins++
              }
            }
          }
        }

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

  const podiumDrivers = driverStandings.slice(0, 3)
  const restDrivers = driverStandings.slice(3)
  const leaderPoints = driverStandings[0]?.points ?? 1
  const teamLeaderPoints = teamStandings[0]?.points ?? 1

  // Podium display order: P2 (index 1), P1 (index 0), P3 (index 2)
  const podiumOrder = podiumDrivers.length >= 3
    ? [podiumDrivers[1], podiumDrivers[0], podiumDrivers[2]]
    : podiumDrivers

  const podiumPositions = podiumDrivers.length >= 3 ? [2, 1, 3] : podiumDrivers.map((_, i) => i + 1)

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <motion.div
        className="mb-14"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
          2026 Season
        </p>
        <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-zinc-100">
          Standings
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          After {completedRaces} race{completedRaces !== 1 ? 's' : ''}
        </p>
        {/* Animated red gradient line */}
        <div className="relative mt-5 h-px w-full overflow-hidden">
          <motion.div
            className="absolute inset-y-0 left-0 h-full"
            style={{
              background: 'linear-gradient(90deg, transparent, #ef4444, #dc2626, transparent)',
              width: '200%',
            }}
            animate={{ x: ['-50%', '0%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      </motion.div>

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
        <>
          {/* ===== PODIUM HERO ===== */}
          <div className="mb-16">
            <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-8">
              Drivers Championship
            </p>

            {podiumDrivers.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 md:gap-5 items-end max-w-4xl mx-auto">
                {podiumOrder.map((d, i) => {
                  const pos = podiumPositions[i]
                  const isP1 = pos === 1
                  const photo = DRIVER_PHOTOS[d.nameAcronym]
                  return (
                    <motion.div
                      key={d.driverNumber}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: i * 0.1 }}
                      className={`glass rounded-xl overflow-hidden relative ${
                        isP1 ? 'md:-mt-8' : ''
                      }`}
                      style={{ borderTop: `3px solid #${d.teamColour}` }}
                    >
                      {/* Position badge */}
                      <div className="absolute top-3 left-3 z-10">
                        <span
                          className={`font-black tabular-nums ${
                            isP1
                              ? 'text-5xl md:text-6xl text-white/20'
                              : 'text-4xl md:text-5xl text-white/10'
                          }`}
                        >
                          {pos}
                        </span>
                      </div>

                      {/* Driver headshot */}
                      {photo && (
                        <div
                          className={`relative w-full flex justify-center ${
                            isP1 ? 'h-40 md:h-56' : 'h-32 md:h-44'
                          }`}
                        >
                          <Image
                            src={photo}
                            alt={d.fullName}
                            width={280}
                            height={280}
                            unoptimized
                            className="object-cover object-top w-full"
                          />
                          {/* Bottom fade */}
                          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-zinc-950/90 to-transparent" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="px-3 md:px-4 pb-4 pt-2 relative z-10">
                        <p className="text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
                          {d.nameAcronym}
                        </p>
                        <p
                          className={`font-bold tracking-tight text-zinc-100 ${
                            isP1 ? 'text-sm md:text-base' : 'text-xs md:text-sm'
                          }`}
                        >
                          {d.fullName}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{d.teamName}</p>

                        <div className="mt-3 flex items-baseline gap-1">
                          <span
                            className={`font-black tabular-nums text-zinc-100 ${
                              isP1 ? 'text-2xl md:text-3xl' : 'text-xl md:text-2xl'
                            }`}
                          >
                            {Math.floor(d.points)}
                          </span>
                          <span className="text-[10px] text-zinc-600 font-bold uppercase tracking-wider">
                            pts
                          </span>
                        </div>

                        <div className="mt-2 flex gap-3">
                          <div>
                            <span className="text-xs font-bold text-zinc-300 tabular-nums">
                              {d.wins}
                            </span>
                            <span className="text-[9px] text-zinc-600 ml-1 uppercase tracking-wider">
                              wins
                            </span>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-zinc-300 tabular-nums">
                              {d.podiums}
                            </span>
                            <span className="text-[9px] text-zinc-600 ml-1 uppercase tracking-wider">
                              pods
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
            {/* ===== DRIVERS TABLE (P4+) ===== */}
            <div>
              <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
                Rest of the Grid
              </p>
              <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/40">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-12">
                        Pos
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Driver
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-20">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {restDrivers.map((d, idx) => {
                      const barWidth =
                        leaderPoints > 0
                          ? (d.points / leaderPoints) * 100
                          : 0
                      return (
                        <motion.tr
                          key={d.driverNumber}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.4 + idx * 0.03,
                          }}
                          className="relative hover:bg-zinc-800/20 transition-colors group"
                        >
                          <td className="px-4 py-3 text-sm font-black text-zinc-500 tabular-nums relative z-10">
                            {idx + 4}
                          </td>
                          <td className="px-4 py-3 relative">
                            {/* Points bar behind the row content */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-r transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: `#${d.teamColour}`,
                                opacity: 0.1,
                              }}
                            />
                            <div className="flex items-center gap-2.5 relative z-10">
                              <div
                                className="w-0.5 h-5 rounded-full flex-shrink-0"
                                style={{
                                  backgroundColor: `#${d.teamColour}`,
                                }}
                              />
                              <div>
                                <p className="text-sm text-zinc-200 font-medium">
                                  {d.fullName}
                                </p>
                                <p className="text-[10px] text-zinc-600">
                                  {d.teamName}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right relative z-10">
                            <span className="text-sm font-black text-zinc-100 tabular-nums">
                              {Math.floor(d.points)}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ===== CONSTRUCTORS CHAMPIONSHIP ===== */}
            <div>
              <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
                Constructors Championship
              </p>
              <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-zinc-800/40">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-12">
                        Pos
                      </th>
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Constructor
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase w-20">
                        Pts
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {teamStandings.map((t, idx) => {
                      const barWidth =
                        teamLeaderPoints > 0
                          ? (t.points / teamLeaderPoints) * 100
                          : 0
                      // Find drivers belonging to this team
                      const teamDrivers = driverStandings
                        .filter((d) => d.teamName === t.teamName)
                        .map((d) => d.fullName)
                      return (
                        <motion.tr
                          key={t.teamName}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{
                            duration: 0.3,
                            delay: 0.5 + idx * 0.03,
                          }}
                          className="relative hover:bg-zinc-800/20 transition-colors"
                        >
                          <td className="px-4 py-3 text-sm font-black text-zinc-500 tabular-nums relative z-10 align-top pt-4">
                            {idx + 1}
                          </td>
                          <td className="px-4 py-3 relative">
                            {/* Points bar */}
                            <div
                              className="absolute inset-y-0 left-0 rounded-r transition-all duration-500"
                              style={{
                                width: `${barWidth}%`,
                                backgroundColor: `#${t.teamColour}`,
                                opacity: 0.12,
                              }}
                            />
                            <div className="relative z-10">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className="w-1 h-5 rounded-full flex-shrink-0"
                                  style={{
                                    backgroundColor: `#${t.teamColour}`,
                                  }}
                                />
                                <span className="text-sm text-zinc-200 font-medium">
                                  {t.teamName}
                                </span>
                              </div>
                              {teamDrivers.length > 0 && (
                                <p className="text-[10px] text-zinc-600 mt-1 ml-[18px]">
                                  {teamDrivers.join(' / ')}
                                </p>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right relative z-10 align-top pt-4">
                            <span className="text-sm font-black text-zinc-100 tabular-nums">
                              {Math.floor(t.points)}
                            </span>
                          </td>
                        </motion.tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
