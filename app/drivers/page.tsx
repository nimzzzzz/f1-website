'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'
import { DRIVER_PHOTOS, CAREER_STATS } from '@/lib/driver-data'

function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgb(${Math.round(r * 0.25)}, ${Math.round(g * 0.25)}, ${Math.round(b * 0.25)})`
}

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

export default function DriversPage() {
  const [unique, setUnique] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      setUnique(
        deduplicateDrivers(drivers).sort((a, b) => {
          if (a.team_name !== b.team_name) return a.team_name.localeCompare(b.team_name)
          return a.driver_number - b.driver_number
        })
      )
    }).finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-zinc-900/60 border border-zinc-800/50 rounded-2xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (unique.length === 0) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <EmptyState title="No driver data" message="Driver information is not yet available for the 2026 season." />
      </div>
    )
  }

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-10">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">2026 Season</p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">2026 Drivers</h1>
        <p className="text-zinc-500 text-sm mt-2">{unique.length} drivers · click a card to view profile</p>
      </div>

      {/* Driver grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {unique.map((driver) => {
          const photo = DRIVER_PHOTOS[driver.name_acronym] ?? driver.headshot_url
          const stats = CAREER_STATS[driver.name_acronym]
          const teamColor = `#${driver.team_colour}`
          const bgColor = darkenHex(driver.team_colour)

          return (
            <Link
              key={driver.driver_number}
              href={`/drivers/${driver.name_acronym.toLowerCase()}`}
              className="relative rounded-2xl overflow-hidden min-h-[260px] flex flex-col group cursor-pointer transition-transform duration-200 hover:scale-[1.015] hover:shadow-2xl"
              style={{ backgroundColor: bgColor }}
            >

              {/* Top team-colour accent line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ backgroundColor: teamColor }} />

              {/* Driver image */}
              {photo && (
                <div className="absolute right-0 top-0 h-full w-[58%] z-0">
                  <Image
                    src={photo}
                    alt={driver.full_name}
                    fill
                    className="object-contain object-top transition-transform duration-300 group-hover:scale-105"
                    unoptimized
                  />
                </div>
              )}

              {/* Gradient overlay */}
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, ${bgColor} 38%, ${bgColor}cc 55%, transparent 75%)`,
                }}
              />

              {/* Content */}
              <div className="relative z-20 flex flex-col h-full p-6">
                <div className="flex-1">
                  <p className="text-base font-normal text-white/80 leading-tight">{driver.first_name}</p>
                  <p className="text-3xl font-black tracking-tight text-white leading-tight mb-1">{driver.last_name}</p>
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{driver.team_name}</p>
                </div>
                <div className="mt-4">
                  <span
                    className="text-[5.5rem] font-black tabular-nums leading-none select-none"
                    style={{ color: 'rgba(255,255,255,0.15)' }}
                  >
                    {driver.driver_number}
                  </span>
                </div>
              </div>

              {/* Career stats bar */}
              {stats && (
                <div
                  className="relative z-20 grid grid-cols-3 divide-x border-t"
                  style={{ borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(0,0,0,0.25)' }}
                >
                  {[
                    { label: 'Grands Prix', value: stats.grandsPrix },
                    { label: 'Wins', value: stats.wins },
                    { label: 'Podiums', value: stats.podiums },
                    { label: 'Poles', value: stats.poles },
                    { label: 'Points', value: stats.points },
                    { label: 'WDC', value: stats.championships },
                  ].map(({ label, value }) => (
                    <div key={label} className="px-3 py-2.5 text-center" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                      <p className="text-base font-black tabular-nums leading-none"
                        style={{ color: value > 0 ? teamColor : 'rgba(255,255,255,0.4)' }}>
                        {value}
                      </p>
                      <p className="text-[9px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'rgba(255,255,255,0.35)' }}>
                        {label}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              {/* View profile arrow — appears on hover */}
              <div className="absolute top-4 right-4 z-30 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black"
                  style={{ backgroundColor: teamColor, color: '#000' }}
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
