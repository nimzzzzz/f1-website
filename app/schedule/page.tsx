'use client'

import { useEffect, useState } from 'react'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import EmptyState from '@/components/EmptyState'
import Image from 'next/image'

// Verified aerial satellite photographs from Wikimedia Commons (Planet Labs SkySat & other sources)
const CIRCUIT_PHOTOS: Record<string, string> = {
  // Bahrain
  Sakhir: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Bahrain_International_Circuit%2C_November_2%2C_2017_SkySat_%28cropped%29.jpg',
  // Saudi Arabia — SAR satellite image of Jeddah Corniche Circuit
  Jeddah: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff/lossy-page1-1280px-Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff.jpg',
  // Australia
  Melbourne: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Albert Park': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  // Japan
  Suzuka: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Suzuka_International_Racing_Course%2C_July_10%2C_2018_SkySat_%28cropped%29.jpg',
  // China
  Shanghai: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Shanghai_International_Circuit%2C_April_7%2C_2018_SkySat_%28rotated%29.jpg',
  // Miami — aerial of Miami International Autodrome
  Miami: '/miami-circuit.avif',
  // Emilia Romagna
  Imola: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Autodromo_aerea_poster.jpg',
  // Monaco
  Monaco: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Circuit_de_Monaco%2C_April_1%2C_2018_SkySat_%28cropped%29.jpg',
  // Canada
  Montreal: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Circuit_Gilles-Villeneuve%2C_May_29%2C_2018_SkySat_%28cropped%29.jpg',
  // Spain (Barcelona GP) — SkySat satellite image
  Barcelona: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Catalunya: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  // Spain (Madrid GP / Madring) — using Barcelona circuit aerial (no Madrid circuit aerial exists yet)
  Madring: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Madrid: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  // Austria
  Spielberg: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Luftaufnahme_%28c%29Red_Bull_Ring.jpg',
  // Britain
  Silverstone: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Silverstone_Circuit%2C_July_2%2C_2018_SkySat_%28cropped%29.jpg',
  // Hungary
  Budapest: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  Hungaroring: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  // Belgium
  Spa: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Spa-Francorchamps': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  // Netherlands
  Zandvoort: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Circuit_Park_Zandvoort_from_air_2016-08-24.jpg',
  // Italy
  Monza: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Autodromo_Nazionale_Monza%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  // Azerbaijan
  Baku: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Baku_City_Circuit%2C_April_9%2C_2018_SkySat.jpg',
  // Singapore
  Singapore: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  'Marina Bay': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  // USA
  Austin: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Circuit_of_the_Americas%2C_April_22%2C_2018_SkySat_%28cropped2%29.jpg',
  // Mexico
  'Mexico City': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez%2C_June_4%2C_2018_SkySat_%28cropped%29.jpg',
  // Brazil
  Interlagos: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  'São Paulo': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  // Las Vegas — aerial of the Strip area (Jan 2024)
  'Las Vegas': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Aerial_view_of_Las_Vegas_Strip_%28Jan_5%2C_2024%29.jpg',
  // Qatar — race photo of Lusail circuit
  Lusail: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  Qatar: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  // Abu Dhabi
  'Yas Marina': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Yas Marina Circuit': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Abu Dhabi': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
}

// Races cancelled for 2026
const CANCELLED_COUNTRIES = new Set(['Bahrain', 'Saudi Arabia'])

function getCircuitPhoto(meeting: { circuit_short_name: string; location: string; country_name: string }): string | null {
  return (
    CIRCUIT_PHOTOS[meeting.circuit_short_name] ??
    CIRCUIT_PHOTOS[meeting.location] ??
    CIRCUIT_PHOTOS[meeting.country_name] ??
    null
  )
}

function getSessionStatus(session: Session): 'live' | 'completed' | 'upcoming' {
  const now = new Date()
  const start = new Date(session.date_start)
  const end = new Date(session.date_end)
  if (start <= now && now < end) return 'live'
  if (end < now) return 'completed'
  return 'upcoming'
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatMeetingDates(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

export default function SchedulePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessionsByMeeting, setSessionsByMeeting] = useState<Record<number, Session[]>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()]).then(([mtgs, sessions]) => {
      setMeetings(mtgs)
      setSessionsByMeeting(
        sessions.reduce<Record<number, Session[]>>((acc, s) => {
          if (!acc[s.meeting_key]) acc[s.meeting_key] = []
          acc[s.meeting_key].push(s)
          return acc
        }, {})
      )
    }).finally(() => setLoading(false))
  }, [])

  const testingMeetings = meetings.filter(
    (m) =>
      m.meeting_name.toLowerCase().includes('testing') ||
      m.meeting_name.toLowerCase().includes('pre-season')
  )
  const raceMeetings = meetings
    .filter(
      (m) =>
        !m.meeting_name.toLowerCase().includes('testing') &&
        !m.meeting_name.toLowerCase().includes('pre-season')
    )
    .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (meetings.length === 0) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <EmptyState title="No schedule data" message="Season schedule is not yet available." />
      </div>
    )
  }

  const MeetingBlock = ({
    meeting,
    roundNumber,
  }: {
    meeting: Meeting
    roundNumber?: number
  }) => {
    const meetingSessions = (sessionsByMeeting[meeting.meeting_key] ?? []).sort(
      (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    )
    const photo = getCircuitPhoto(meeting)
    const isCancelled = CANCELLED_COUNTRIES.has(meeting.country_name)

    return (
      <div className={`border rounded-xl overflow-hidden ${isCancelled ? 'border-zinc-800/30 opacity-60' : 'border-zinc-800/50 bg-zinc-900/40'}`}>

        {/* Hero image */}
        {photo ? (
          <div className="relative h-52 overflow-hidden">
            <Image
              src={photo}
              alt={`${meeting.circuit_short_name} aerial`}
              fill
              className="object-cover"
              unoptimized
            />
            {/* Bottom gradient so text is readable */}
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/50 to-black/10" />
            {/* Top-left accent line */}
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-red-600/60 via-red-500/20 to-transparent" />

            {/* Cancelled overlay */}
            {isCancelled && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-xs font-black tracking-[0.3em] uppercase text-red-500 border border-red-500/50 px-3 py-1 rounded bg-black/70">
                    Cancelled
                  </span>
                </div>
              </div>
            )}

            {/* Info overlaid at bottom of image */}
            <div className="absolute bottom-0 left-0 right-0 px-5 pb-4 pt-8">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                {roundNumber && (
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-red-500">
                    Round {roundNumber}
                  </span>
                )}
                {meeting.country_flag && (
                  <div className="relative w-7 h-[18px] rounded-sm overflow-hidden border border-white/20 flex-shrink-0">
                    <Image
                      src={meeting.country_flag}
                      alt={meeting.country_name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                )}
              </div>
              <h2 className="text-lg font-black text-white leading-tight">{meeting.meeting_name}</h2>
              <p className="text-[11px] text-zinc-400 mt-0.5">
                {meeting.circuit_short_name}
                <span className="text-zinc-600 mx-1.5">·</span>
                {formatMeetingDates(meeting.date_start, meeting.date_end)}
              </p>
            </div>
          </div>
        ) : (
          /* Fallback header when no photo is available */
          <div className="px-5 py-4 border-b border-zinc-800/40 flex items-center gap-4">
            {meeting.country_flag && (
              <div className="relative w-10 h-6 rounded overflow-hidden border border-zinc-800/50 flex-shrink-0">
                <Image
                  src={meeting.country_flag}
                  alt={meeting.country_name}
                  fill
                  className="object-cover"
                  unoptimized
                />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {roundNumber && (
                  <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600">
                    Round {roundNumber}
                  </span>
                )}
                <h2 className="text-sm font-bold text-zinc-100 truncate">{meeting.meeting_name}</h2>
              </div>
              <p className="text-xs text-zinc-500">
                {meeting.circuit_short_name} — {formatMeetingDates(meeting.date_start, meeting.date_end)}
              </p>
            </div>
          </div>
        )}

        {/* Sessions */}
        {meetingSessions.length === 0 ? (
          <div className="px-5 py-4 text-xs text-zinc-600">No session data available</div>
        ) : (
          <div className="divide-y divide-zinc-800/40">
            {meetingSessions.map((session) => {
              const status = getSessionStatus(session)
              return (
                <div key={session.session_key} className="px-5 py-3 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm text-zinc-300 font-medium">{session.session_name}</p>
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {formatDate(session.date_start)} · {formatTime(session.date_start)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {status === 'live' && (
                      <span className="flex items-center gap-1.5 text-red-500 text-[10px] font-bold tracking-[0.2em] uppercase">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                        Live
                      </span>
                    )}
                    {status === 'completed' && (
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-600">
                        Completed
                      </span>
                    )}
                    {status === 'upcoming' && (
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-zinc-400">
                        Upcoming
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
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
          Season Schedule
        </h1>
      </div>

      {/* Race weekends */}
      <div className="mb-12">
        <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-6">
          Race Weekends — {raceMeetings.length} rounds
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {raceMeetings.map((meeting, idx) => (
            <MeetingBlock key={meeting.meeting_key} meeting={meeting} roundNumber={idx + 1} />
          ))}
        </div>
      </div>

      {/* Pre-season testing */}
      {testingMeetings.length > 0 && (
        <div>
          <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-6">
            Pre-Season Testing
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {testingMeetings.map((meeting) => (
              <MeetingBlock key={meeting.meeting_key} meeting={meeting} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
