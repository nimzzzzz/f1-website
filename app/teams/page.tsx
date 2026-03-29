'use client'

import { useEffect, useState } from 'react'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'

// Official F1 car renders from formula1.com (2026 season, right-facing)
const TEAM_CARS: Record<string, string> = {
  'Red Bull Racing':             'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/redbullracing/2026redbullracingcarright.webp',
  Ferrari:                       'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/ferrari/2026ferraricarright.webp',
  'Scuderia Ferrari':            'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/ferrari/2026ferraricarright.webp',
  McLaren:                       'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/mclaren/2026mclarencarright.webp',
  Mercedes:                      'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedescarright.webp',
  'Mercedes-AMG Petronas F1 Team': 'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/mercedes/2026mercedescarright.webp',
  'Aston Martin':                'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartincarright.webp',
  'Aston Martin Aramco F1 Team': 'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/astonmartin/2026astonmartincarright.webp',
  Alpine:                        'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/alpine/2026alpinecarright.webp',
  'BWT Alpine F1 Team':          'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/alpine/2026alpinecarright.webp',
  Williams:                      'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/williams/2026williamscarright.webp',
  'Williams Racing':             'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/williams/2026williamscarright.webp',
  'Racing Bulls':                'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/racingbulls/2026racingbullscarright.webp',
  'Haas F1 Team':                'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/haas/2026haascarright.webp',
  Haas:                          'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/haas/2026haascarright.webp',
  Audi:                          'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/audi/2026audicarright.webp',
  'Audi F1 Team':                'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/audi/2026audicarright.webp',
  Cadillac:                      'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaccarright.webp',
  'Cadillac Formula One Team':   'https://media.formula1.com/image/upload/c_lfill,w_3392/q_auto/v1740000001/common/f1/2026/cadillac/2026cadillaccarright.webp',
}

// Driver portrait images keyed by acronym — small crop for circles
const DRIVER_AVATARS: Record<string, string> = {
  RUS: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mercedes/georus01/2026mercedesgeorus01right.webp',
  ANT: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mercedes/andant01/2026mercedesandant01right.webp',
  LEC: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/ferrari/chalec01/2026ferrarichalec01right.webp',
  HAM: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/ferrari/lewham01/2026ferrarilewham01right.webp',
  NOR: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mclaren/lannor01/2026mclarenlannor01right.webp',
  PIA: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/mclaren/oscpia01/2026mclarenoscpia01right.webp',
  OCO: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/haasf1team/estoco01/2026haasf1teamestoco01right.webp',
  BEA: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/haasf1team/olibea01/2026haasf1teamolibea01right.webp',
  VER: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/redbullracing/maxver01/2026redbullracingmaxver01right.webp',
  HAD: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/redbullracing/isahad01/2026redbullracingisahad01right.webp',
  LAW: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/racingbulls/lialaw01/2026racingbullslialaw01right.webp',
  LIN: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/racingbulls/arvlin01/2026racingbullsarvlin01right.webp',
  GAS: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/alpine/piegas01/2026alpinepiegas01right.webp',
  COL: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/alpine/fracol01/2026alpinefracol01right.webp',
  HUL: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/audi/nichul01/2026audinichul01right.webp',
  BOR: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/audi/gabbor01/2026audigabbor01right.webp',
  SAI: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/williams/carsai01/2026williamscarsai01right.webp',
  ALB: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/williams/alealb01/2026williamsalealb01right.webp',
  PER: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/cadillac/serper01/2026cadillacserper01right.webp',
  BOT: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/cadillac/valbot01/2026cadillacvalbot01right.webp',
  ALO: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/astonmartin/feralo01/2026astonmartinferalo01right.webp',
  STR: 'https://media.formula1.com/image/upload/c_lfill,w_160/q_auto/v1740000001/common/f1/2026/astonmartin/lanstr01/2026astonmartinlanstr01right.webp',
}

// Team logo URLs
const TEAM_LOGOS: Record<string, string> = {
  McLaren:                       'https://upload.wikimedia.org/wikipedia/en/6/66/McLaren_Racing_logo.svg',
  Ferrari:                       'https://upload.wikimedia.org/wikipedia/en/d/df/Scuderia_Ferrari_HP_logo_24.svg',
  'Scuderia Ferrari':            'https://upload.wikimedia.org/wikipedia/en/d/df/Scuderia_Ferrari_HP_logo_24.svg',
  'Red Bull Racing':             'https://upload.wikimedia.org/wikipedia/en/f/fa/Red_Bull_Racing_Logo_2026.svg',
  'Oracle Red Bull Racing':      'https://upload.wikimedia.org/wikipedia/en/f/fa/Red_Bull_Racing_Logo_2026.svg',
  Mercedes:                      'https://upload.wikimedia.org/wikipedia/commons/f/fc/Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg',
  'Mercedes-AMG Petronas F1 Team': 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Mercedes-AMG_Petronas_F1_Team_logo_%282026%29.svg',
  'Aston Martin':                'https://upload.wikimedia.org/wikipedia/en/1/15/Aston_Martin_Aramco_2024_logo.png',
  'Aston Martin Aramco F1 Team': 'https://upload.wikimedia.org/wikipedia/en/1/15/Aston_Martin_Aramco_2024_logo.png',
  Alpine:                        'https://upload.wikimedia.org/wikipedia/commons/4/4a/BWT_Alpine_F1_Team_Logo.png',
  'BWT Alpine F1 Team':          'https://upload.wikimedia.org/wikipedia/commons/4/4a/BWT_Alpine_F1_Team_Logo.png',
  Williams:                      'https://upload.wikimedia.org/wikipedia/commons/1/12/Atlassian_Williams_F1_Team_logo.svg',
  'Williams Racing':             'https://upload.wikimedia.org/wikipedia/commons/1/12/Atlassian_Williams_F1_Team_logo.svg',
  'Racing Bulls':                'https://upload.wikimedia.org/wikipedia/en/2/2b/VCARB_F1_logo.svg',
  'Haas F1 Team':                'https://upload.wikimedia.org/wikipedia/commons/1/18/TGR_Haas_F1_Team_Logo_%282026%29.svg',
  Haas:                          'https://upload.wikimedia.org/wikipedia/commons/1/18/TGR_Haas_F1_Team_Logo_%282026%29.svg',
  Audi:                          'https://upload.wikimedia.org/wikipedia/commons/0/03/Audif1.com_logo17_%28cropped%29.svg',
  'Audi F1 Team':                'https://upload.wikimedia.org/wikipedia/commons/0/03/Audif1.com_logo17_%28cropped%29.svg',
  Cadillac:                      'https://upload.wikimedia.org/wikipedia/en/b/bc/Cadillac_Formula_1_Team_Logo_%282025%29.svg',
  'Cadillac Formula One Team':   'https://upload.wikimedia.org/wikipedia/en/b/bc/Cadillac_Formula_1_Team_Logo_%282025%29.svg',
}

// Exact team colours from F1.com --f1-team-colour and --f1-accessible-colour
const TEAM_COLOURS: Record<string, { bright: string; dark: string }> = {
  McLaren:             { bright: '#ff8000', dark: '#804000' },
  Ferrari:             { bright: '#e8002d', dark: '#5c0012' },
  'Scuderia Ferrari':  { bright: '#e8002d', dark: '#5c0012' },
  'Red Bull Racing':   { bright: '#3671c6', dark: '#142948' },
  Mercedes:            { bright: '#27f4d2', dark: '#067e6a' },
  'Mercedes-AMG Petronas F1 Team': { bright: '#27f4d2', dark: '#067e6a' },
  'Aston Martin':      { bright: '#00704a', dark: '#002d1f' },
  'Aston Martin Aramco F1 Team': { bright: '#00704a', dark: '#002d1f' },
  Alpine:              { bright: '#00a1e8', dark: '#004e70' },
  'BWT Alpine F1 Team':{ bright: '#00a1e8', dark: '#004e70' },
  Williams:            { bright: '#0082fa', dark: '#002d5c' },
  'Williams Racing':   { bright: '#0082fa', dark: '#002d5c' },
  'Racing Bulls':      { bright: '#6692ff', dark: '#0038c2' },
  'Haas F1 Team':      { bright: '#dee1e2', dark: '#667175' },
  Haas:                { bright: '#dee1e2', dark: '#667175' },
  Audi:                { bright: '#da291c', dark: '#6b0f06' },
  'Audi F1 Team':      { bright: '#da291c', dark: '#6b0f06' },
  Cadillac:            { bright: '#ffb81c', dark: '#7f5c0a' },
  'Cadillac Formula One Team': { bright: '#ffb81c', dark: '#7f5c0a' },
}

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

const TEAM_ORDER = [
  'McLaren', 'Ferrari', 'Red Bull Racing', 'Mercedes', 'Aston Martin',
  'Alpine', 'Williams', 'Racing Bulls', 'Haas F1 Team', 'Audi', 'Cadillac',
]

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
        <p className="text-zinc-500 text-sm mt-2">{sortedTeams.length} teams</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {sortedTeams.map((teamName) => {
          const teamDrivers = byTeam[teamName].sort((a, b) => a.driver_number - b.driver_number)
          const colours = TEAM_COLOURS[teamName] ?? { bright: '#ffffff', dark: '#333333' }
          const carUrl = TEAM_CARS[teamName]
          const logoUrl = TEAM_LOGOS[teamName]

          return (
            <div
              key={teamName}
              className="relative rounded-2xl overflow-hidden min-h-[280px] flex flex-col"
              style={{ backgroundColor: colours.bright }}
            >
              {/* Diagonal dark gradient overlay (matches F1.com) */}
              <div
                className="absolute inset-0 z-0 pointer-events-none"
                style={{
                  background: `linear-gradient(315deg, ${colours.dark}00 0%, ${colours.dark} 100%)`,
                }}
              />

              {/* Content */}
              <div className="relative z-10 flex flex-col flex-1 p-6">

                {/* Top row: team name left, logo right */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <h2 className="text-2xl font-black text-white leading-tight">{teamName}</h2>
                  {logoUrl && (
                    <div
                      className="relative h-9 w-24 flex-shrink-0 rounded-lg flex items-center justify-center p-1.5"
                      style={{ backgroundColor: colours.dark }}
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

                {/* Driver rows with avatar circles */}
                <div className="flex flex-col gap-2 mb-4">
                  {teamDrivers.map((driver) => {
                    const avatarUrl = DRIVER_AVATARS[driver.name_acronym] ?? driver.headshot_url
                    return (
                      <div key={driver.driver_number} className="flex items-center gap-3">
                        {/* Circle avatar */}
                        <div
                          className="relative w-10 h-10 rounded-full overflow-hidden flex-shrink-0 border-2"
                          style={{ backgroundColor: colours.bright, borderColor: `${colours.dark}80` }}
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
                        {/* Driver name */}
                        <div>
                          <span className="text-sm font-normal text-white/70">{driver.first_name} </span>
                          <span className="text-sm font-black text-white uppercase tracking-wide">{driver.last_name}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Spacer to push car to bottom */}
                <div className="flex-1" />
              </div>

              {/* Car image — anchored bottom, bleeds left */}
              {carUrl && (
                <div className="relative z-10 h-32 w-full overflow-visible">
                  <div className="absolute bottom-0 left-0 right-0 h-32">
                    <Image
                      src={carUrl}
                      alt={`${teamName} 2026 car`}
                      fill
                      className="object-contain object-left-bottom"
                      unoptimized
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
