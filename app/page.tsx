'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import Countdown from '@/components/Countdown'
import { getRaceMeetings, isMeetingCompleted, getCurrentMeeting, getNextMeeting, CANCELLED_COUNTRIES, fetchAllSessionResults } from '@/lib/openf1'
import { ShaderAnimation } from '@/components/ui/shader-animation'
import { getCachedDrivers, getCachedSessionResult } from '@/lib/client-cache'
import { DRIVER_PHOTOS } from '@/lib/driver-data'

const CIRCUIT_PHOTOS: Record<string, string> = {
  Sakhir: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Bahrain_International_Circuit%2C_November_2%2C_2017_SkySat_%28cropped%29.jpg',
  Jeddah: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff/lossy-page1-1280px-Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff.jpg',
  Melbourne: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Albert Park': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  Suzuka: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Suzuka_International_Racing_Course%2C_July_10%2C_2018_SkySat_%28cropped%29.jpg',
  Shanghai: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Shanghai_International_Circuit%2C_April_7%2C_2018_SkySat_%28rotated%29.jpg',
  Miami: '/miami-circuit.avif',
  Imola: 'https://upload.wikimedia.org/wikipedia/commons/f/fc/Autodromo_aerea_poster.jpg',
  Monaco: 'https://upload.wikimedia.org/wikipedia/commons/c/c7/Circuit_de_Monaco%2C_April_1%2C_2018_SkySat_%28cropped%29.jpg',
  Montreal: 'https://upload.wikimedia.org/wikipedia/commons/6/65/Circuit_Gilles-Villeneuve%2C_May_29%2C_2018_SkySat_%28cropped%29.jpg',
  Barcelona: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Catalunya: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Madring: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Madrid: 'https://upload.wikimedia.org/wikipedia/commons/4/42/Circuit_de_Barcelona-Catalunya%2C_April_19%2C_2018_SkySat.jpg',
  Spielberg: 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Luftaufnahme_%28c%29Red_Bull_Ring.jpg',
  Silverstone: 'https://upload.wikimedia.org/wikipedia/commons/8/8d/Silverstone_Circuit%2C_July_2%2C_2018_SkySat_%28cropped%29.jpg',
  Budapest: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  Hungaroring: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/Hungaroring%2C_April_28%2C_2018_SkySat_%28cropped%29.jpg',
  Spa: 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Spa-Francorchamps': 'https://upload.wikimedia.org/wikipedia/commons/7/77/Circuit_de_Spa-Francorchamps%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  Zandvoort: 'https://upload.wikimedia.org/wikipedia/commons/4/49/Circuit_Park_Zandvoort_from_air_2016-08-24.jpg',
  Monza: 'https://upload.wikimedia.org/wikipedia/commons/6/6f/Autodromo_Nazionale_Monza%2C_April_22%2C_2018_SkySat_%28cropped%29.jpg',
  Baku: 'https://upload.wikimedia.org/wikipedia/commons/6/6d/Baku_City_Circuit%2C_April_9%2C_2018_SkySat.jpg',
  Singapore: 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  'Marina Bay': 'https://upload.wikimedia.org/wikipedia/commons/b/bb/Marina_Bay_Street_Circuit%2C_May_8%2C_2018_SkySat_%28cropped%29.jpg',
  Austin: 'https://upload.wikimedia.org/wikipedia/commons/7/78/Circuit_of_the_Americas%2C_April_22%2C_2018_SkySat_%28cropped2%29.jpg',
  'Mexico City': 'https://upload.wikimedia.org/wikipedia/commons/f/f6/Aut%C3%B3dromo_Hermanos_Rodr%C3%ADguez%2C_June_4%2C_2018_SkySat_%28cropped%29.jpg',
  Interlagos: 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  'São Paulo': 'https://upload.wikimedia.org/wikipedia/commons/7/70/Aut%C3%B3dromo_Jos%C3%A9_Carlos_Pace%2C_July_3%2C_2018_SkySat_%28cropped%29.jpg',
  'Las Vegas': 'https://upload.wikimedia.org/wikipedia/commons/a/a5/Aerial_view_of_Las_Vegas_Strip_%28Jan_5%2C_2024%29.jpg',
  Lusail: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  Qatar: 'https://upload.wikimedia.org/wikipedia/commons/8/85/Qatar_MotoGP_2010.jpg',
  'Yas Marina': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Yas Marina Circuit': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
  'Abu Dhabi': 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Yas_Marina_Circuit%2C_October_12%2C_2018_SkySat_%28cropped%29.jpg',
}


function getCircuitPhoto(meeting: Meeting): string | null {
  return (
    CIRCUIT_PHOTOS[meeting.circuit_short_name] ??
    CIRCUIT_PHOTOS[meeting.location] ??
    CIRCUIT_PHOTOS[meeting.country_name] ??
    null
  )
}

interface LeaderStats {
  name: string
  acronym: string
  teamName: string
  teamColour: string
  headshot: string | null
  points: number
  wins: number
  poles: number
}

const SESSION_SHORT: Record<string, string> = {
  'Practice 1': 'P1',
  'Practice 2': 'P2',
  'Practice 3': 'P3',
  'Sprint Shootout': 'SQ',
  'Sprint': 'SPR',
  'Qualifying': 'QUALI',
  'Race': 'RACE',
}

export default function HomePage() {
  const [meetings, setMeetings] = useState<Meeting[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [leader, setLeader] = useState<LeaderStats | null>(null)

  // Phase 1: fetch meetings + sessions, then show the page immediately
  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([m, s]) => { setMeetings(m); setSessions(s); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Phase 2: compute championship leader in the background (doesn't block render)
  useEffect(() => {
    if (sessions.length === 0) return
    const now = new Date()
    const notCancelled = (x: Session) => !CANCELLED_COUNTRIES.has(x.country_name)

    const completedRaceSessions = sessions.filter(
      x => x.session_type === 'Race' && x.session_name === 'Race' && new Date(x.date_end) < now && notCancelled(x)
    )
    const completedSprintSessions = sessions.filter(
      x => x.session_type === 'Race' && x.session_name === 'Sprint' && new Date(x.date_end) < now && notCancelled(x)
    )
    const completedQualSessions = sessions.filter(
      x => x.session_name === 'Qualifying' && new Date(x.date_end) < now && notCancelled(x)
    )
    if (completedRaceSessions.length === 0) return

    const driverRefKey = [...completedRaceSessions].sort(
      (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
    )[0].session_key

    const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]
    const allSessionKeys = [
      ...allPointsSessions.map(x => x.session_key),
      ...completedQualSessions.map(x => x.session_key),
    ]

    Promise.all([
      getCachedDrivers(driverRefKey),
      fetchAllSessionResults(allSessionKeys, getCachedSessionResult),
    ]).then(([drivers, resultsMap]) => {
      const driverMap = new Map(drivers.map(d => [d.driver_number, d]))
      const standings = new Map<number, { points: number; wins: number; poles: number }>()

      for (const session of allPointsSessions) {
        const results = resultsMap.get(session.session_key)
        if (!results) continue
        for (const r of results) {
          const cur = standings.get(r.driver_number) ?? { points: 0, wins: 0, poles: 0 }
          cur.points += r.points ?? 0
          if (r.position === 1) cur.wins++
          standings.set(r.driver_number, cur)
        }
      }

      for (const session of completedQualSessions) {
        const results = resultsMap.get(session.session_key)
        if (!results) continue
        for (const r of results) {
          if (r.position === 1) {
            const cur = standings.get(r.driver_number) ?? { points: 0, wins: 0, poles: 0 }
            cur.poles++
            standings.set(r.driver_number, cur)
          }
        }
      }

      let leaderId = -1, maxPts = -1
      for (const [id, { points }] of standings) {
        if (points > maxPts) { maxPts = points; leaderId = id }
      }
      if (leaderId === -1) return

      const info = driverMap.get(leaderId)
      const s2 = standings.get(leaderId)!
      const acronym = info?.name_acronym ?? '---'
      setLeader({
        name: info?.full_name ?? `Driver #${leaderId}`,
        acronym,
        teamName: info?.team_name ?? '',
        teamColour: info?.team_colour ?? '6B7280',
        headshot: DRIVER_PHOTOS[acronym] ?? info?.headshot_url ?? null,
        points: s2.points,
        wins: s2.wins,
        poles: s2.poles,
      })
    })
  }, [sessions])

  if (loading) return (
    <div className="min-h-[100dvh] bg-zinc-950 flex flex-col">
      {/* Hero skeleton */}
      <div className="relative flex-1 flex flex-col justify-between px-8 md:px-14 py-10 md:py-14 max-w-[1400px] w-full mx-auto">
        <div className="flex items-center gap-3">
          <span className="w-px h-4 rounded-full bg-zinc-800" />
          <span className="h-3 w-32 bg-zinc-800/60 rounded animate-pulse" />
        </div>
        <div className="my-auto py-8 space-y-6">
          <div className="h-3 w-24 bg-zinc-800/40 rounded animate-pulse" />
          <div className="h-16 w-80 bg-zinc-800/30 rounded animate-pulse" />
          <div className="h-6 w-48 bg-zinc-800/20 rounded animate-pulse" />
          <div className="h-px w-64 bg-zinc-800/30 rounded animate-pulse" />
          <div className="flex gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="w-24 h-28 rounded-2xl bg-zinc-900/50 border border-zinc-800/30 animate-pulse" />
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <div className="h-2 w-full bg-zinc-900/50 rounded-full" />
        </div>
      </div>
    </div>
  )

  const raceMeetings = getRaceMeetings(meetings).sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )
  // Exclude cancelled races from countdown + race weekend logic
  const activeMeetings = meetings.filter((m) => !CANCELLED_COUNTRIES.has(m.country_name))
  const currentMeeting = getCurrentMeeting(activeMeetings)
  const nextMeeting = getNextMeeting(activeMeetings)
  const targetMeeting = currentMeeting ?? nextMeeting
  const isLiveWeekend = currentMeeting !== null

  const meetingSessions = targetMeeting
    ? sessions
        .filter((s) => s.meeting_key === targetMeeting.meeting_key)
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
    : []

  const circuitPhoto = targetMeeting ? getCircuitPhoto(targetMeeting) : null
  const completedCount = raceMeetings.filter((m) => isMeetingCompleted(m)).length
  const roundNumber = targetMeeting
    ? raceMeetings.findIndex((m) => m.meeting_key === targetMeeting.meeting_key) + 1
    : null

  // Split name for editorial typography
  const nameMatch = targetMeeting?.meeting_name.match(/^(.*?)\s+(Grand\s+Prix)$/i)
  const locationPart = nameMatch ? nameMatch[1].toUpperCase() : (targetMeeting?.meeting_name.toUpperCase() ?? '')
  const gpPart = nameMatch ? nameMatch[2].toUpperCase() : ''

  return (
    <>
      {/* ─── Hero countdown ─── */}
      <Countdown meetings={activeMeetings} sessions={sessions} />

      {/* ─── Championship Leader ─── */}
      {leader && (() => {
        const teamColor = `#${leader.teamColour}`
        const nameParts = leader.name.split(' ')
        const lastName = nameParts[nameParts.length - 1].toUpperCase()
        const firstName = nameParts.slice(0, -1).join(' ').toUpperCase()
        return (
          <section className="relative overflow-hidden bg-zinc-950">
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: teamColor }} />
            <div
              className="absolute left-0 top-0 bottom-0 w-[600px] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at left center, ${teamColor}12, transparent 70%)` }}
            />
            <div
              className="absolute right-0 top-0 bottom-0 w-[500px] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at right center, ${teamColor}0a, transparent 60%)` }}
            />

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 py-6 md:py-8">
              <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-center">

                <div>
                  <div className="flex items-center gap-2.5 mb-4">
                    <div className="w-8 h-px" style={{ backgroundColor: teamColor }} />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase" style={{ color: teamColor }}>
                      Championship Leader · 2026
                    </span>
                  </div>

                  <div className="mb-4">
                    <h2
                      className="font-black text-white tracking-tighter leading-[0.85]"
                      style={{ fontSize: 'clamp(2rem, 3.5vw, 3.5rem)' }}
                    >
                      {lastName}
                    </h2>
                    {firstName && (
                      <p
                        className="font-black tracking-tight leading-none mt-1"
                        style={{ fontSize: 'clamp(0.9rem, 1.5vw, 1.5rem)', color: 'rgba(255,255,255,0.12)' }}
                      >
                        {firstName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-5">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
                    <span className="text-zinc-400 text-xs font-medium">{leader.teamName}</span>
                  </div>

                  {/* Stats — glassmorphism cards */}
                  <div className="grid grid-cols-3 gap-2.5">
                    {[
                      { label: 'Points', value: leader.points },
                      { label: 'Wins', value: leader.wins },
                      { label: 'Poles', value: leader.poles },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="glass relative rounded-xl p-3.5 overflow-hidden group"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-px"
                          style={{ background: `linear-gradient(to right, ${teamColor}80, transparent 70%)` }}
                        />
                        <p className="text-[9px] font-bold text-zinc-500 tracking-[0.25em] uppercase mb-1.5">{label}</p>
                        <p
                          className="font-black tabular-nums leading-none"
                          style={{ fontSize: 'clamp(1.2rem, 1.8vw, 1.6rem)', color: teamColor }}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Right — driver headshot */}
                <div className="flex items-end justify-center lg:justify-end">
                  {leader.headshot ? (
                    <div className="relative">
                      <div
                        className="absolute -inset-12 rounded-full blur-3xl opacity-25 pointer-events-none"
                        style={{ backgroundColor: teamColor }}
                      />
                      <Image
                        src={leader.headshot}
                        alt={leader.name}
                        width={384}
                        height={480}
                        className="relative object-contain"
                        style={{
                          filter: `drop-shadow(0 20px 60px rgba(0,0,0,0.8)) drop-shadow(0 0 40px ${teamColor}15)`,
                          width: 'clamp(8rem, 12vw, 14rem)',
                          height: 'auto',
                        }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-48 h-48 rounded-full bg-zinc-900/50 border border-zinc-800/40 flex items-center justify-center backdrop-blur-sm">
                      <span className="text-5xl font-black text-zinc-700">{leader.acronym}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 h-px bg-zinc-800/40" />
          </section>
        )
      })()}

      {/* ─── Season Calendar ─── */}
      {raceMeetings.length > 0 && (
        <section className="bg-zinc-950">
          <div className="max-w-[1400px] mx-auto px-6 md:px-12 pt-4 pb-20 md:pb-28">

            {/* Header row */}
            <div className="flex items-end justify-between mb-8">
              <div>
                <p className="text-[11px] font-black text-red-500 tracking-[0.3em] uppercase mb-3">2026 Season</p>
                <h2 className="text-3xl md:text-5xl font-black tracking-tighter text-white">Race Calendar</h2>
              </div>
              <div className="text-right hidden sm:block">
                <p className="text-4xl font-black text-white tabular-nums">
                  {completedCount}
                  <span className="text-zinc-800 text-2xl">/{raceMeetings.length}</span>
                </p>
                <p className="text-[10px] text-zinc-600 tracking-[0.3em] uppercase mt-1">Completed</p>
              </div>
            </div>

            {/* Thin red progress bar */}
            <div className="relative mb-10 h-[2px] bg-zinc-900 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${raceMeetings.length > 0 ? (completedCount / raceMeetings.length) * 100 : 0}%`,
                  background: 'linear-gradient(to right, #7f1d1d, #dc2626, #ef4444)',
                }}
              />
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
              {raceMeetings.map((meeting, idx) => {
                const isTarget = targetMeeting?.meeting_key === meeting.meeting_key
                const isCompleted = isMeetingCompleted(meeting)
                const isCancelled = CANCELLED_COUNTRIES.has(meeting.country_name)
                const now = new Date()
                const isLive = new Date(meeting.date_start) <= now && new Date(meeting.date_end) >= now
                const photo = getCircuitPhoto(meeting)

                return (
                  <div
                    key={meeting.meeting_key}
                    className={[
                      'relative group rounded-xl overflow-hidden border transition-all duration-300',
                      isTarget ? 'col-span-2 row-span-1 sm:col-span-1' : '',
                      isCancelled
                        ? 'border-zinc-800/20 opacity-40'
                        : isTarget
                        ? 'border-red-500/50 shadow-[0_0_40px_-8px_rgba(239,68,68,0.35)]'
                        : isCompleted
                        ? 'border-zinc-800/30 opacity-45 hover:opacity-70 hover:border-zinc-700/40'
                        : 'border-zinc-800/40 hover:border-zinc-600/60 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.6)] hover:-translate-y-0.5',
                    ].join(' ')}
                  >
                    {/* Photo thumbnail */}
                    <div className={['relative overflow-hidden', isTarget ? 'h-[100px]' : 'h-[80px]'].join(' ')}>
                      {photo ? (
                        <Image
                          src={photo}
                          alt={meeting.country_name}
                          fill
                          className={[
                            'object-cover transition-transform duration-700 group-hover:scale-110',
                            isCompleted ? 'grayscale brightness-[0.35]' : '',
                          ].join(' ')}
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-900" />
                      )}

                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

                      <span className="absolute top-1.5 left-2.5 text-[9px] font-black text-white/25 tabular-nums select-none">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {meeting.country_flag && (
                        <div className="absolute top-1.5 right-1.5 w-[18px] h-[13px] rounded-sm overflow-hidden border border-white/15 shadow">
                          <Image src={meeting.country_flag} alt="" fill className="object-cover" unoptimized />
                        </div>
                      )}

                      {isCancelled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-red-500/80 border border-red-500/30 px-2 py-0.5 rounded bg-black/60">
                            Cancelled
                          </span>
                        </div>
                      )}

                      {isLive && (
                        <div className="absolute bottom-1.5 left-2 flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
                          <span className="text-[9px] font-black text-red-400 tracking-widest uppercase">Live</span>
                        </div>
                      )}
                      {isTarget && !isLive && (
                        <div className="absolute bottom-1.5 left-2">
                          <span className="text-[9px] font-black text-red-500 tracking-widest uppercase">Next</span>
                        </div>
                      )}
                    </div>

                    {/* Info row */}
                    <div className={[
                      'px-3 py-2.5',
                      isTarget ? 'bg-zinc-900/80' : 'bg-zinc-950',
                    ].join(' ')}>
                      <p className={[
                        'text-[11px] font-black tracking-tight truncate',
                        isCompleted ? 'text-zinc-600' : isTarget ? 'text-white' : 'text-zinc-300',
                      ].join(' ')}>
                        {meeting.country_name}
                      </p>
                      <p className={`text-[10px] tabular-nums mt-0.5 ${isCompleted ? 'text-zinc-800' : 'text-zinc-600'}`}>
                        {new Date(meeting.date_start).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {' – '}
                        {new Date(meeting.date_end).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                    </div>

                    {isTarget && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px]" style={{ background: 'linear-gradient(to right, #dc2626, #ef444440)' }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Shader animation banner */}
          <div className="relative -mx-6 md:-mx-12">
            <ShaderAnimation />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[11px] font-black text-red-500 tracking-[0.4em] uppercase mb-3">2026 Formula 1</p>
              <h3 className="text-4xl md:text-6xl font-black tracking-tighter text-white text-center">
                World Championship
              </h3>
            </div>
          </div>

        </section>
      )}
    </>
  )
}
