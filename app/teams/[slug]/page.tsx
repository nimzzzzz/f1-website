'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from '@phosphor-icons/react'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import { DRIVER_PHOTOS } from '@/lib/driver-data'
import {
  TEAM_CARS, TEAM_LOGOS, TEAM_COLOURS, DRIVER_AVATARS, slugToTeam, teamToSlug,
} from '@/lib/team-data'

function deduplicateDrivers(drivers: Driver[]): Driver[] {
  const map = new Map<number, Driver>()
  for (const d of drivers) map.set(d.driver_number, d)
  return Array.from(map.values())
}

export default function TeamPage() {
  const params = useParams()
  const slug = params.slug as string
  const [teamDrivers, setTeamDrivers] = useState<Driver[]>([])
  const [teamName, setTeamName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      const unique = deduplicateDrivers(drivers)
      // Match by slug against team names from actual API data
      const found = unique.find((d) => teamToSlug(d.team_name) === slug)
      if (!found) {
        // Try canonical lookup
        const canonical = slugToTeam(slug)
        const team = canonical ? unique.filter((d) => d.team_name === canonical) : []
        if (team.length === 0) { setNotFound(true); return }
        setTeamName(canonical)
        setTeamDrivers(team.sort((a, b) => a.driver_number - b.driver_number))
      } else {
        const name = found.team_name
        setTeamName(name)
        setTeamDrivers(unique.filter((d) => d.team_name === name).sort((a, b) => a.driver_number - b.driver_number))
      }
    }).finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="animate-pulse space-y-4 w-full max-w-2xl px-8">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-12 w-64 bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  if (notFound || !teamName) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-500 text-sm">Team not found</p>
        <Link href="/teams" className="text-red-500 text-sm font-bold hover:text-red-400 transition-colors">
          ← Back to Teams
        </Link>
      </div>
    )
  }

  const colours = TEAM_COLOURS[teamName] ?? { bright: '#ffffff', dark: '#333333' }
  const carUrl = TEAM_CARS[teamName]
  const logoUrl = TEAM_LOGOS[teamName]
  const { bright, dark } = colours

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ backgroundColor: bright, minHeight: 420 }}
      >
        {/* Car image — large, right-anchored, full visibility */}
        {carUrl && (
          <div className="absolute bottom-0 right-0 w-[70%] h-[90%] z-0">
            <Image
              src={carUrl}
              alt={`${teamName} 2026 car`}
              fill
              className="object-contain object-right-bottom"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Left gradient — only covers text area, stops before the car */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to right, ${dark} 28%, ${dark}ee 38%, ${dark}88 48%, transparent 58%)` }}
        />
        {/* Bottom fade into page */}
        <div
          className="absolute bottom-0 left-0 right-0 h-24 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(to bottom, transparent, #09090b)' }}
        />

        {/* Content */}
        <div className="relative z-20 max-w-[1400px] mx-auto px-6 md:px-12 pt-10 pb-16">
          {/* Back link */}
          <Link
            href="/teams"
            className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] uppercase text-white/40 hover:text-white/70 transition-colors mb-10"
          >
            <ArrowLeft size={14} />
            All Teams
          </Link>

          {/* Logo */}
          {logoUrl && (
            <div
              className="relative w-36 h-12 mb-6 rounded-lg flex items-center justify-center p-2"
              style={{ backgroundColor: `${dark}99` }}
            >
              <Image
                src={logoUrl}
                alt={teamName}
                fill
                className="object-contain p-2"
                unoptimized
              />
            </div>
          )}

          {/* Team name */}
          <h1
            className="font-black tracking-tighter text-white leading-[0.85] mb-6"
            style={{ fontSize: 'clamp(2.5rem, 7vw, 7rem)' }}
          >
            {teamName}
          </h1>

          {/* Colour accent pill */}
          <div
            className="inline-block w-12 h-1 rounded-full mb-6"
            style={{ backgroundColor: bright }}
          />

          {/* Driver avatars */}
          <div className="flex gap-4 flex-wrap">
            {teamDrivers.map((driver) => {
              const avatarUrl = DRIVER_AVATARS[driver.name_acronym] ?? driver.headshot_url
              return (
                <Link
                  key={driver.driver_number}
                  href={`/drivers/${driver.name_acronym.toLowerCase()}`}
                  className="flex items-center gap-3 px-4 py-2.5 rounded-xl border transition-colors hover:border-white/30"
                  style={{ backgroundColor: `${dark}cc`, borderColor: `${bright}30` }}
                >
                  <div
                    className="relative w-9 h-9 rounded-full overflow-hidden flex-shrink-0 border"
                    style={{ backgroundColor: bright, borderColor: `${bright}50` }}
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
                    <p className="text-xs font-normal text-white/60 leading-none">{driver.first_name}</p>
                    <p className="text-sm font-black text-white uppercase tracking-wide leading-tight">{driver.last_name}</p>
                  </div>
                  <span
                    className="text-xs font-black tabular-nums ml-2"
                    style={{ color: bright }}
                  >
                    #{driver.driver_number}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </div>

      {/* Driver profiles section */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-6">
          2026 Drivers
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {teamDrivers.map((driver) => {
            const photo = DRIVER_PHOTOS[driver.name_acronym] ?? driver.headshot_url
            return (
              <Link
                key={driver.driver_number}
                href={`/drivers/${driver.name_acronym.toLowerCase()}`}
                className="relative rounded-xl overflow-hidden min-h-[200px] flex flex-col group transition-transform hover:scale-[1.015]"
                style={{ backgroundColor: dark }}
              >
                {/* Colour top bar */}
                <div className="absolute top-0 left-0 right-0 h-0.5 z-20" style={{ backgroundColor: bright }} />

                {/* Driver photo */}
                {photo && (
                  <div className="absolute right-0 top-0 h-full w-[55%] z-0">
                    <Image
                      src={photo}
                      alt={driver.full_name}
                      fill
                      className="object-contain object-top transition-transform duration-300 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                )}

                {/* Gradient */}
                <div
                  className="absolute inset-0 z-10 pointer-events-none"
                  style={{ background: `linear-gradient(to right, ${dark} 40%, ${dark}cc 58%, transparent 78%)` }}
                />

                {/* Text */}
                <div className="relative z-20 p-5 flex-1">
                  <p className="text-sm font-normal text-white/60">{driver.first_name}</p>
                  <p className="text-2xl font-black tracking-tight text-white">{driver.last_name}</p>
                  <p
                    className="text-[11px] font-black tracking-[0.3em] uppercase mt-1"
                    style={{ color: bright }}
                  >
                    #{driver.driver_number}
                  </p>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Divider */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="h-px bg-zinc-800/50" />
      </div>

      {/* About section — placeholder for per-team customisation */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-5">About</p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <p className="text-zinc-400 text-sm leading-relaxed">
            {teamName} is competing in the 2026 Formula 1 World Championship.
          </p>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5">
            <p className="text-[10px] font-bold text-zinc-600 tracking-[0.25em] uppercase mb-4">Team Info</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Constructor</span>
                <span className="text-sm font-bold text-zinc-200">{teamName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Drivers</span>
                <span className="text-sm font-bold text-zinc-200">
                  {teamDrivers.map((d) => d.name_acronym).join(' · ')}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Season</span>
                <span className="text-sm font-bold text-zinc-200">2026</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
