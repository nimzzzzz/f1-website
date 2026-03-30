'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Meeting, Session, Position } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import Countdown from '@/components/Countdown'
import { getRaceMeetings, isMeetingCompleted, getCurrentMeeting, getNextMeeting, RACE_POINTS, SPRINT_POINTS } from '@/lib/openf1'
import { ShaderAnimation } from '@/components/ui/shader-animation'
import { getCachedDrivers, getCachedPositions } from '@/lib/client-cache'
import { DRIVER_PHOTOS } from '@/lib/driver-data'

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

async function fetchAllPositions(sessionKeys: number[]): Promise<Map<number, Position[]>> {
  const results = await Promise.all(
    sessionKeys.map(async (key) => ({ key, data: await getCachedPositions(key) }))
  )
  const map = new Map<number, Position[]>()
  const empties: number[] = []
  for (const { key, data } of results) {
    if (data.length > 0) map.set(key, data)
    else empties.push(key)
  }
  for (const key of empties) {
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 600))
      const data = await getCachedPositions(key)
      if (data.length > 0) { map.set(key, data); break }
    }
  }
  return map
}

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

// Races cancelled for 2026
const CANCELLED_COUNTRIES = new Set(['Bahrain', 'Saudi Arabia'])

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

  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([m, s]) => { setMeetings(m); setSessions(s); return s })
      .then(async (s) => {
        const now = new Date()

        const completedRaceSessions = s.filter(
          x => x.session_type === 'Race' && x.session_name === 'Race' && new Date(x.date_end) < now
        )
        const completedSprintSessions = s.filter(
          x => x.session_type === 'Race' && x.session_name === 'Sprint' && new Date(x.date_end) < now
        )
        const completedQualSessions = s.filter(
          x => x.session_name === 'Qualifying' && new Date(x.date_end) < now
        )
        if (completedRaceSessions.length === 0) return

        // Most recent completed race session for driver info
        const driverRefKey = [...completedRaceSessions].sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )[0].session_key

        const allPointsSessions = [...completedRaceSessions, ...completedSprintSessions]
        const allSessionKeys = [
          ...allPointsSessions.map(x => x.session_key),
          ...completedQualSessions.map(x => x.session_key),
        ]

        const [drivers, positionsMap] = await Promise.all([
          getCachedDrivers(driverRefKey),
          fetchAllPositions(allSessionKeys),
        ])

        const driverMap = new Map(drivers.map(d => [d.driver_number, d]))
        const standings = new Map<number, { points: number; wins: number; poles: number }>()

        const processSessions = (sessions: Session[], pointsTable: number[]) => {
          for (const session of sessions) {
            const positions = positionsMap.get(session.session_key)
            if (!positions || positions.length === 0) continue
            const latestPos = getLatestPositions(positions)
            latestPos.forEach((pos, driverNum) => {
              const pts = pos >= 1 && pos <= pointsTable.length ? pointsTable[pos - 1] : 0
              const cur = standings.get(driverNum) ?? { points: 0, wins: 0, poles: 0 }
              cur.points += pts
              if (pos === 1) cur.wins++
              standings.set(driverNum, cur)
            })
          }
        }

        processSessions(completedRaceSessions, RACE_POINTS)
        processSessions(completedSprintSessions, SPRINT_POINTS)

        // Compute poles from qualifying
        for (const session of completedQualSessions) {
          const positions = positionsMap.get(session.session_key)
          if (!positions || positions.length === 0) continue
          const latestPos = getLatestPositions(positions)
          latestPos.forEach((pos, driverNum) => {
            if (pos === 1) {
              const cur = standings.get(driverNum) ?? { points: 0, wins: 0, poles: 0 }
              cur.poles++
              standings.set(driverNum, cur)
            }
          })
        }

        // Find leader
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
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="min-h-[100dvh] bg-black" />

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
            {/* Team-colour left accent + ambient glow */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ backgroundColor: teamColor }} />
            <div
              className="absolute left-0 top-0 bottom-0 w-[600px] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at left center, ${teamColor}10, transparent 70%)` }}
            />
            {/* Right-side headshot glow */}
            <div
              className="absolute right-0 top-0 bottom-0 w-[500px] pointer-events-none"
              style={{ background: `radial-gradient(ellipse at right center, ${teamColor}08, transparent 60%)` }}
            />

            <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 py-4 md:py-5">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-center">

                {/* Left — identity + stats */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-px" style={{ backgroundColor: teamColor }} />
                    <span className="text-[10px] font-black tracking-[0.4em] uppercase" style={{ color: teamColor }}>
                      Championship Leader · 2026
                    </span>
                  </div>

                  <div className="mb-3">
                    <h2
                      className="font-black text-white tracking-tighter leading-[0.85]"
                      style={{ fontSize: 'clamp(1.5rem, 2.5vw, 2.5rem)' }}
                    >
                      {lastName}
                    </h2>
                    {firstName && (
                      <p
                        className="font-black tracking-tight leading-none mt-0.5"
                        style={{ fontSize: 'clamp(0.8rem, 1.3vw, 1.3rem)', color: 'rgba(255,255,255,0.18)' }}
                      >
                        {firstName}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor }} />
                    <span className="text-zinc-400 text-xs font-medium">{leader.teamName}</span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'Points', value: leader.points },
                      { label: 'Wins', value: leader.wins },
                      { label: 'Poles', value: leader.poles },
                    ].map(({ label, value }) => (
                      <div
                        key={label}
                        className="relative rounded-lg border border-zinc-800/50 bg-zinc-900/40 p-3 overflow-hidden"
                      >
                        <div
                          className="absolute top-0 left-0 right-0 h-px"
                          style={{ background: `linear-gradient(to right, ${teamColor}60, transparent)` }}
                        />
                        <p className="text-[9px] font-black text-zinc-600 tracking-[0.25em] uppercase mb-1">{label}</p>
                        <p
                          className="font-black tabular-nums leading-none"
                          style={{ fontSize: 'clamp(1rem, 1.5vw, 1.4rem)', color: teamColor }}
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
                      {/* Glow behind image */}
                      <div
                        className="absolute -inset-8 rounded-full blur-3xl opacity-20 pointer-events-none"
                        style={{ backgroundColor: teamColor }}
                      />
                      <Image
                        src={leader.headshot}
                        alt={leader.name}
                        width={384}
                        height={480}
                        className="relative object-contain drop-shadow-2xl"
                        style={{ filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.8))', width: 'clamp(7rem, 9vw, 11rem)', height: 'auto' }}
                        unoptimized
                      />
                    </div>
                  ) : (
                    <div className="w-64 h-64 rounded-full bg-zinc-900 border border-zinc-800/40 flex items-center justify-center">
                      <span className="text-6xl font-black text-zinc-700">{leader.acronym}</span>
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
                      isCancelled
                        ? 'border-zinc-800/20 opacity-50'
                        : isTarget
                        ? 'border-red-500/60 shadow-[0_0_30px_-6px_rgba(239,68,68,0.4)] scale-[1.02]'
                        : isCompleted
                        ? 'border-zinc-900/40 opacity-50 hover:opacity-75'
                        : 'border-zinc-800/50 hover:border-zinc-600/50 hover:scale-[1.02]',
                    ].join(' ')}
                  >
                    {/* Photo thumbnail */}
                    <div className="relative h-[80px] overflow-hidden">
                      {photo ? (
                        <Image
                          src={photo}
                          alt={meeting.country_name}
                          fill
                          className={[
                            'object-cover transition-transform duration-700 group-hover:scale-110',
                            isCompleted ? 'grayscale brightness-50' : '',
                          ].join(' ')}
                          unoptimized
                        />
                      ) : (
                        <div className="w-full h-full bg-zinc-900" />
                      )}

                      {/* Gradient overlay */}
                      <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

                      {/* Round number — top left ghost */}
                      <span className="absolute top-1.5 left-2.5 text-[9px] font-black text-white/30 tabular-nums select-none">
                        {String(idx + 1).padStart(2, '0')}
                      </span>

                      {/* Flag — top right */}
                      {meeting.country_flag && (
                        <div className="absolute top-1.5 right-1.5 w-[18px] h-[13px] rounded-sm overflow-hidden border border-white/15 shadow">
                          <Image src={meeting.country_flag} alt="" fill className="object-cover" unoptimized />
                        </div>
                      )}

                      {/* Cancelled overlay */}
                      {isCancelled && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <span className="text-[9px] font-black tracking-[0.2em] uppercase text-red-500 border border-red-500/40 px-2 py-0.5 rounded bg-black/60">
                            Cancelled
                          </span>
                        </div>
                      )}

                      {/* Live / Next badge */}
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
                      isTarget ? 'bg-zinc-900' : 'bg-zinc-950',
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

                    {/* Red bottom stripe on target */}
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
