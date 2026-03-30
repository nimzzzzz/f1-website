'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'
import { TEAM_CARS, DRIVER_AVATARS, TEAM_LOGOS, TEAM_COLOURS, TEAM_ORDER, teamToSlug } from '@/lib/team-data'

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

export default function TeamsPage() {
  const [sortedTeams, setSortedTeams] = useState<string[]>([])
  const [byTeam, setByTeam] = useState<Record<string, Driver[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      const unique = deduplicateDrivers(drivers)
      const grouped = unique.reduce<Record<string, Driver[]>>((acc, d) => {
        if (!acc[d.team_name]) acc[d.team_name] = []
        acc[d.team_name].push(d)
        return acc
      }, {})
      const sorted = Object.keys(grouped).sort((a, b) => {
        const ia = TEAM_ORDER.indexOf(a), ib = TEAM_ORDER.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      })
      setByTeam(grouped)
      setSortedTeams(sorted)
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-72 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (sortedTeams.length === 0) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <EmptyState title="No constructor data" message="Constructor information is not yet available for the 2026 season." />
      </div>
    )
  }

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">2026 Season</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">2026 Constructors</h1>
        <p className="text-zinc-500 text-sm mt-2">{sortedTeams.length} teams · click a card to view profile</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sortedTeams.map((teamName) => {
          const teamDrivers = byTeam[teamName].sort((a, b) => a.driver_number - b.driver_number)
          const colours = TEAM_COLOURS[teamName] ?? { bright: '#ffffff', dark: '#333333' }
          const carUrl = TEAM_CARS[teamName]
          const logoUrl = TEAM_LOGOS[teamName]
          const { bright, dark } = colours

          return (
            <Link
              key={teamName}
              href={`/teams/${teamToSlug(teamName)}`}
              className="relative rounded-2xl overflow-hidden min-h-[280px] flex flex-col group cursor-pointer transition-transform duration-200 hover:scale-[1.015] hover:shadow-2xl"
              style={{ backgroundColor: bright }}
            >
              {/* Diagonal dark gradient overlay */}
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{ background: `linear-gradient(315deg, ${dark}00 0%, ${dark} 100%)` }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col flex-1 p-6">
                {/* Top row: team name left, logo right */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-black text-white leading-tight">{teamName}</h2>
                  {logoUrl && (
                    <div
                      className="relative h-9 w-24 flex-shrink-0 rounded-lg flex items-center justify-center p-1.5"
                      style={{ backgroundColor: dark }}
                    >
                      <Image
                        src={logoUrl}
                        alt={teamName}
                        fill
                        className="object-contain p-1.5"
                        unoptimized
                      />
                    </div>
                  )}
                </div>

                {/* Driver rows */}
                <div className="flex flex-col gap-2 mb-4">
                  {teamDrivers.map((driver) => {
                    const avatarUrl = DRIVER_AVATARS[driver.name_acronym] ?? driver.headshot_url
                    return (
                      <div key={driver.driver_number} className="flex items-center gap-3">
                        <div
                          className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2"
                          style={{ backgroundColor: bright, borderColor: `${dark}80` }}
                        >
                          {avatarUrl && (
                            <Image
                              src={avatarUrl}
                              alt={driver.full_name}
                              fill
                              className="object-contain object-bottom"
                              unoptimized
                            />
                          )}
                        </div>
                        <div>
                          <span className="text-sm font-normal text-white/70">{driver.first_name} </span>
                          <span className="text-sm font-black text-white uppercase tracking-wide">{driver.last_name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="flex-1" />
              </div>

              {/* Car image */}
              {carUrl && (
                <div className="relative z-10 h-32 w-full overflow-visible">
                  <div className="absolute bottom-0 left-0 right-0 h-32">
                    <Image
                      src={carUrl}
                      alt={`${teamName} 2026 car`}
                      fill
                      className="object-contain object-left-bottom transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                </div>
              )}

              {/* View profile arrow */}
              <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ backgroundColor: bright, color: dark }}
                >
                  →
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
