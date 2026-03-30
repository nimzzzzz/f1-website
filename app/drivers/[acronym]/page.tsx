'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from '@phosphor-icons/react'
import type { Driver } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import { DRIVER_PHOTOS, CAREER_STATS, DRIVER_NATIONALITIES } from '@/lib/driver-data'

function darkenHex(hex: string): string {
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return `rgb(${Math.round(r * 0.18)}, ${Math.round(g * 0.18)}, ${Math.round(b * 0.18)})`
}

export default function DriverPage() {
  const params = useParams()
  const acronym = (params.acronym as string).toUpperCase()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      const found = drivers.find((d) => d.name_acronym === acronym)
      if (found) setDriver(found)
      else setNotFound(true)
    }).finally(() => setLoading(false))
  }, [acronym])

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

  if (notFound || !driver) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-500 text-sm">Driver not found</p>
        <Link href="/drivers" className="text-red-500 text-sm font-bold hover:text-red-400 transition-colors">
          ← Back to Drivers
        </Link>
      </div>
    )
  }

  const photo = DRIVER_PHOTOS[acronym] ?? driver.headshot_url
  const stats = CAREER_STATS[acronym]
  const nationality = DRIVER_NATIONALITIES[acronym] ?? ''
  const teamColor = `#${driver.team_colour}`
  const darkBg = darkenHex(driver.team_colour)

  const statItems = stats ? [
    { label: 'Grands Prix', value: stats.grandsPrix },
    { label: 'World Titles', value: stats.championships },
    { label: 'Wins', value: stats.wins },
    { label: 'Podiums', value: stats.podiums },
    { label: 'Pole Positions', value: stats.poles },
    { label: 'Points', value: stats.points },
  ] : []

  return (
    <div className="min-h-screen bg-zinc-950">

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ backgroundColor: darkBg, minHeight: 480 }}>
        {/* Team colour top bar */}
        <div className="absolute top-0 left-0 right-0 h-1 z-20" style={{ backgroundColor: teamColor }} />

        {/* Subtle radial glow behind driver */}
        <div
          className="absolute inset-0 z-0"
          style={{
            background: `radial-gradient(ellipse 60% 80% at 80% 50%, ${teamColor}22, transparent 70%)`,
          }}
        />

        {/* Driver image */}
        {photo && (
          <div className="absolute right-0 top-0 h-full w-[55%] md:w-[45%] z-0">
            <Image
              src={photo}
              alt={driver.full_name}
              fill
              className="object-contain object-top"
              unoptimized
              priority
            />
          </div>
        )}

        {/* Left gradient so text stays readable */}
        <div
          className="absolute inset-0 z-10 pointer-events-none"
          style={{
            background: `linear-gradient(to right, ${darkBg} 42%, ${darkBg}cc 58%, ${darkBg}44 75%, transparent 90%)`,
          }}
        />
        {/* Bottom fade into page */}
        <div className="absolute bottom-0 left-0 right-0 h-32 z-10 pointer-events-none"
          style={{ background: `linear-gradient(to bottom, transparent, #09090b)` }} />

        {/* Content */}
        <div className="relative z-20 max-w-[1400px] mx-auto px-6 md:px-12 pt-10 pb-16">
          {/* Back link */}
          <Link
            href="/drivers"
            className="inline-flex items-center gap-2 text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500 hover:text-zinc-300 transition-colors mb-10"
          >
            <ArrowLeft size={14} />
            All Drivers
          </Link>

          {/* Number watermark */}
          <div
            className="absolute right-[44%] top-8 font-black tabular-nums leading-none select-none pointer-events-none z-0"
            style={{ fontSize: 'clamp(10rem, 22vw, 20rem)', color: 'rgba(255,255,255,0.04)' }}
          >
            {driver.driver_number}
          </div>

          {/* Driver name */}
          <div className="relative z-10">
            <p className="text-[11px] font-bold tracking-[0.35em] uppercase mb-1" style={{ color: teamColor }}>
              {driver.team_name}
            </p>
            <h1
              className="font-black tracking-tighter text-white leading-[0.85] mb-2"
              style={{ fontSize: 'clamp(3rem, 8vw, 8rem)' }}
            >
              {driver.first_name}
              <br />
              {driver.last_name}
            </h1>
            <div className="flex items-center gap-3 mt-4">
              <span
                className="text-[11px] font-black tracking-[0.3em] uppercase px-3 py-1.5 rounded-full border"
                style={{ color: teamColor, borderColor: `${teamColor}40`, backgroundColor: `${teamColor}15` }}
              >
                #{driver.driver_number}
              </span>
              {nationality && (
                <span className="text-[11px] font-bold tracking-[0.25em] uppercase text-zinc-500">
                  {nationality}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      {stats && (
        <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
          <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-5">
            Career Statistics
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {statItems.map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-5 py-4 text-center"
              >
                <p
                  className="text-3xl font-black tabular-nums leading-none"
                  style={{ color: value > 0 ? teamColor : 'rgba(255,255,255,0.25)' }}
                >
                  {value}
                </p>
                <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-600 mt-2">
                  {label}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="h-px bg-zinc-800/50" />
      </div>

      {/* About section — placeholder for per-driver customization */}
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 py-10">
        <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-5">
          About
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-4">
            <p className="text-zinc-400 text-sm leading-relaxed">
              {driver.full_name} is competing in the 2026 Formula 1 World Championship with {driver.team_name}.
            </p>
          </div>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-5">
            <p className="text-[10px] font-bold text-zinc-600 tracking-[0.25em] uppercase mb-4">Driver Info</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Number</span>
                <span className="text-sm font-bold text-zinc-200">#{driver.driver_number}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-500">Team</span>
                <span className="text-sm font-bold text-zinc-200">{driver.team_name}</span>
              </div>
              {nationality && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Nationality</span>
                  <span className="text-sm font-bold text-zinc-200">{nationality}</span>
                </div>
              )}
              {stats && (
                <div className="flex justify-between items-center">
                  <span className="text-xs text-zinc-500">Championships</span>
                  <span className="text-sm font-bold" style={{ color: stats.championships > 0 ? teamColor : undefined }}>
                    {stats.championships > 0 ? `${stats.championships}× World Champion` : '—'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  )
}
