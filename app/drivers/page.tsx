'use client'

import { useEffect, useState } from 'react'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'

// Official F1 driver renders — large version
const DRIVER_PHOTOS: Record<string, string> = {
  RUS: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  ANT: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  LEC: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  HAM: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  NOR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  PIA: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  OCO: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  BEA: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  VER: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  HAD: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  LAW: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  LIN: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  GAS: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  COL: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  HUL: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  BOR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  SAI: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  ALB: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  PER: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  BOT: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
  ALO: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  STR: 'https://media.formula1.com/image/upload/c_fill,w_720/q_auto/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
}

// Career stats from formula1.com
const CAREER_STATS: Record<string, { grandsPrix: number; points: number; podiums: number; poles: number; wins: number; championships: number }> = {
  VER: { grandsPrix: 235, points: 3452.5, podiums: 127, poles: 48, wins: 71,  championships: 4 },
  HAM: { grandsPrix: 382, points: 5051.5, podiums: 203, poles: 104, wins: 105, championships: 7 },
  LEC: { grandsPrix: 173, points: 1706,   podiums: 51,  poles: 27, wins: 8,   championships: 0 },
  NOR: { grandsPrix: 154, points: 1445,   podiums: 44,  poles: 16, wins: 11,  championships: 1 },
  RUS: { grandsPrix: 154, points: 1084,   podiums: 26,  poles: 8,  wins: 6,   championships: 0 },
  ANT: { grandsPrix: 26,  points: 197,    podiums: 5,   poles: 1,  wins: 1,   championships: 0 },
  PIA: { grandsPrix: 72,  points: 802,    podiums: 26,  poles: 6,  wins: 9,   championships: 0 },
  ALO: { grandsPrix: 429, points: 2393,   podiums: 106, poles: 22, wins: 32,  championships: 2 },
  STR: { grandsPrix: 192, points: 325,    podiums: 3,   poles: 1,  wins: 0,   championships: 0 },
  SAI: { grandsPrix: 232, points: 1338.5, podiums: 29,  poles: 6,  wins: 4,   championships: 0 },
  ALB: { grandsPrix: 130, points: 313,    podiums: 2,   poles: 0,  wins: 0,   championships: 0 },
  GAS: { grandsPrix: 179, points: 467,    podiums: 5,   poles: 0,  wins: 1,   championships: 0 },
  COL: { grandsPrix: 29,  points: 6,      podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  HUL: { grandsPrix: 253, points: 622,    podiums: 1,   poles: 1,  wins: 0,   championships: 0 },
  BOR: { grandsPrix: 26,  points: 21,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  BEA: { grandsPrix: 29,  points: 65,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  OCO: { grandsPrix: 182, points: 483,    podiums: 4,   poles: 0,  wins: 1,   championships: 0 },
  LAW: { grandsPrix: 37,  points: 52,     podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
  HAD: { grandsPrix: 25,  points: 55,     podiums: 1,   poles: 0,  wins: 0,   championships: 0 },
  LIN: { grandsPrix: 2,   points: 4,      podiums: 0,   poles: 0,  wins: 0,   championships: 0 },
}

// Darken a hex colour for the card background (simulate F1's --f1-accessible-colour)
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
        <p className="text-zinc-500 text-sm mt-2">{unique.length} drivers</p>
      </div>

      {/* Driver grid — 2 columns on md+, 1 on mobile */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {unique.map((driver) => {
          const photo = DRIVER_PHOTOS[driver.name_acronym] ?? driver.headshot_url
          const stats = CAREER_STATS[driver.name_acronym]
          const teamColor = `#${driver.team_colour}`
          const bgColor = darkenHex(driver.team_colour)

          return (
            <div
              key={driver.driver_number}
              className="relative rounded-2xl overflow-hidden min-h-[260px] flex flex-col"
              style={{ backgroundColor: bgColor }}
            >
              {/* Top team-colour accent line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ backgroundColor: teamColor }} />

              {/* Driver image — right side, anchored to top so head is visible */}
              {photo && (
                <div className="absolute right-0 top-0 h-full w-[58%] z-0">
                  <Image
                    src={photo}
                    alt={driver.full_name}
                    fill
                    className="object-contain object-top"
                    unoptimized
                  />
                </div>
              )}

              {/* Left-to-right gradient to keep text readable over image */}
              <div
                className="absolute inset-0 z-10 pointer-events-none"
                style={{
                  background: `linear-gradient(to right, ${bgColor} 38%, ${bgColor}cc 55%, transparent 75%)`,
                }}
              />

              {/* Content */}
              <div className="relative z-20 flex flex-col h-full p-6">
                {/* Name + team */}
                <div className="flex-1">
                  <p className="text-base font-normal text-white/80 leading-tight">{driver.first_name}</p>
                  <p className="text-3xl font-black tracking-tight text-white leading-tight mb-1">{driver.last_name}</p>
                  <p className="text-[11px] font-semibold text-white/50 uppercase tracking-widest">{driver.team_name}</p>
                </div>

                {/* Driver number — large, bottom left */}
                <div className="mt-4">
                  <span
                    className="text-[5.5rem] font-black tabular-nums leading-none select-none"
                    style={{ color: 'rgba(255,255,255,0.15)' }}
                  >
                    {driver.driver_number}
                  </span>
                </div>
              </div>

              {/* Career stats bar at the bottom */}
              {stats && (
                <div
                  className="relative z-20 grid grid-cols-3 divide-x border-t"
                  style={{
                    borderColor: 'rgba(255,255,255,0.08)',
                    divideColor: 'rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(0,0,0,0.25)',
                  }}
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
                      <p className="text-base font-black tabular-nums text-white leading-none"
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
            </div>
          )
        })}
      </div>
    </div>
  )
}
