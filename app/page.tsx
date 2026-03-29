'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { Meeting, Session } from '@/lib/openf1'
import { getCachedMeetings, getCachedSessions } from '@/lib/client-cache'
import Countdown from '@/components/Countdown'
import { getRaceMeetings, isMeetingCompleted, getCurrentMeeting, getNextMeeting } from '@/lib/openf1'

const CIRCUIT_PHOTOS: Record<string, string> = {
  Sakhir: 'https://upload.wikimedia.org/wikipedia/commons/b/bc/Bahrain_International_Circuit%2C_November_2%2C_2017_SkySat_%28cropped%29.jpg',
  Jeddah: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/bd/Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff/lossy-page1-1280px-Saudi_Arabia_F1_GP_%282024-03-09-06-37-08_UMBRA-05%29.tiff.jpg',
  Melbourne: 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  'Albert Park': 'https://upload.wikimedia.org/wikipedia/commons/8/8e/Melbourne_Grand_Prix_Circuit%2C_March_22%2C_2018_SkySat_%28cropped%29.jpg',
  Suzuka: 'https://upload.wikimedia.org/wikipedia/commons/9/9a/Suzuka_International_Racing_Course%2C_July_10%2C_2018_SkySat_%28cropped%29.jpg',
  Shanghai: 'https://upload.wikimedia.org/wikipedia/commons/d/d6/Shanghai_International_Circuit%2C_April_7%2C_2018_SkySat_%28rotated%29.jpg',
  Miami: 'https://upload.wikimedia.org/wikipedia/commons/9/97/Sun_Life_Stadium_aerial_2012.jpg',
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

  useEffect(() => {
    Promise.all([getCachedMeetings(), getCachedSessions()])
      .then(([m, s]) => { setMeetings(m); setSessions(s) })
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

      {/* ─── Race Weekend — cinematic full-bleed ─── */}
      {targetMeeting && (
        <section className="relative overflow-hidden bg-black">
          {/* Full-bleed circuit aerial */}
          {circuitPhoto && (
            <div className="absolute inset-0">
              <Image
                src={circuitPhoto}
                alt={targetMeeting.circuit_short_name}
                fill
                className="object-cover scale-105"
                unoptimized
                priority
              />
              {/* Layered overlays for drama */}
              <div className="absolute inset-0 bg-black/70" />
              <div className="absolute inset-0 bg-gradient-to-r from-black via-black/60 to-transparent" />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/30" />
              {/* Red light leak from left edge */}
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
              <div
                className="absolute left-0 top-0 bottom-0 w-64 opacity-10"
                style={{ background: 'radial-gradient(ellipse at left, #dc2626, transparent)' }}
              />
            </div>
          )}
          {!circuitPhoto && (
            <div className="absolute inset-0 bg-zinc-950">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-600" />
            </div>
          )}

          {/* Giant ghosted round number */}
          {roundNumber !== null && (
            <div
              className="absolute right-0 top-1/2 -translate-y-1/2 font-black text-white select-none pointer-events-none tabular-nums leading-none"
              style={{ fontSize: 'clamp(14rem, 28vw, 36rem)', opacity: 0.04, transform: 'translateY(-50%) translateX(8%)' }}
            >
              {String(roundNumber).padStart(2, '0')}
            </div>
          )}

          <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 py-20 md:py-28">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">

              {/* Left — editorial info */}
              <div>
                {/* Label */}
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-8 h-px bg-red-500" />
                  <span className="text-[11px] font-black text-red-500 tracking-[0.4em] uppercase">
                    {isLiveWeekend ? (
                      <span className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block" />
                        Live Weekend
                      </span>
                    ) : `Round ${roundNumber} of ${raceMeetings.length}`}
                  </span>
                </div>

                {/* Giant location name */}
                <div className="mb-6">
                  <h2
                    className="font-black text-white tracking-tighter leading-[0.82]"
                    style={{ fontSize: 'clamp(3.5rem, 8vw, 9rem)' }}
                  >
                    {locationPart}
                  </h2>
                  {gpPart && (
                    <p
                      className="font-black text-white/25 tracking-tight leading-none mt-2"
                      style={{ fontSize: 'clamp(1.8rem, 4vw, 4.5rem)' }}
                    >
                      {gpPart}
                    </p>
                  )}
                </div>

                {/* Circuit + country */}
                <div className="flex items-center gap-3 mb-8">
                  {targetMeeting.country_flag && (
                    <div className="relative w-8 h-5 rounded overflow-hidden border border-white/10 flex-shrink-0">
                      <Image src={targetMeeting.country_flag} alt="" fill className="object-cover" unoptimized />
                    </div>
                  )}
                  <p className="text-zinc-400 text-base">
                    {targetMeeting.circuit_short_name}
                    <span className="text-zinc-700 mx-2">·</span>
                    {targetMeeting.country_name}
                  </p>
                </div>

                {/* Dates */}
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-zinc-800 bg-zinc-900/50 backdrop-blur-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-zinc-600" />
                  <span className="text-xs text-zinc-400">
                    {new Date(targetMeeting.date_start).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                    {' — '}
                    {new Date(targetMeeting.date_end).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              </div>

              {/* Right — session timetable */}
              <div>
                <p className="text-[10px] font-black text-zinc-600 tracking-[0.35em] uppercase mb-4">
                  Session Schedule
                </p>
                <div className="space-y-1.5">
                  {meetingSessions.map((session) => {
                    const now = new Date()
                    const start = new Date(session.date_start)
                    const end = new Date(session.date_end)
                    const live = start <= now && now < end
                    const done = end < now
                    const short = SESSION_SHORT[session.session_name] ?? session.session_name
                    const isRace = session.session_name === 'Race'

                    return (
                      <div
                        key={session.session_key}
                        className={[
                          'relative flex items-center gap-4 px-5 py-3.5 rounded-xl border backdrop-blur-sm overflow-hidden',
                          live
                            ? 'border-red-500/50 bg-red-950/30'
                            : done
                            ? 'border-zinc-800/20 bg-black/30'
                            : isRace
                            ? 'border-zinc-700/50 bg-zinc-900/60'
                            : 'border-zinc-800/40 bg-zinc-900/40',
                        ].join(' ')}
                      >
                        {/* Left accent */}
                        {live && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-red-500 rounded-l-xl" />}
                        {isRace && !live && !done && <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-zinc-600 rounded-l-xl" />}

                        {/* Compound tag */}
                        <span className={[
                          'text-[10px] font-black tracking-widest w-12 flex-shrink-0 text-center py-1 rounded',
                          live ? 'text-red-400 bg-red-950/50' : done ? 'text-zinc-800 bg-zinc-900/30' : isRace ? 'text-zinc-300 bg-zinc-800/50' : 'text-zinc-600 bg-zinc-900/50',
                        ].join(' ')}>
                          {short}
                        </span>

                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-semibold truncate ${live ? 'text-red-300' : done ? 'text-zinc-700' : 'text-zinc-200'}`}>
                            {session.session_name}
                          </p>
                          <p className={`text-[10px] mt-0.5 ${done ? 'text-zinc-800' : 'text-zinc-600'}`}>
                            {start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>

                        <div className="text-right flex-shrink-0">
                          <p className={`text-xs tabular-nums ${done ? 'text-zinc-800' : 'text-zinc-400'}`}>
                            {start.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })}
                          </p>
                          {live && (
                            <div className="flex items-center justify-end gap-1 mt-0.5">
                              <span className="w-1 h-1 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-[10px] font-black text-red-500 uppercase tracking-widest">Live</span>
                            </div>
                          )}
                          {done && <p className="text-[10px] text-zinc-800 uppercase tracking-wider mt-0.5">Done</p>}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Bottom fade into next section */}
          <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-zinc-950 to-transparent" />
        </section>
      )}

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
        </section>
      )}
    </>
  )
}
