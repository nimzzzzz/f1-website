'use client'

import React, { memo, useEffect, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import type { Meeting, Session } from '@/lib/openf1'
import { getRaceMeetings, getCurrentMeeting, getNextMeeting, isMeetingCompleted } from '@/lib/openf1'

const HERO_IMAGE =
  'https://upload.wikimedia.org/wikipedia/commons/b/bc/2024-08-24_Motorsport%2C_Formel_1%2C_Gro%C3%9Fer_Preis_der_Niederlande_2024_STP_3272_by_Stepro.jpg'

interface Props {
  meetings: Meeting[]
  sessions: Session[]
}

interface TimeLeft {
  days: number
  hours: number
  mins: number
  secs: number
  total: number
}

function calcTimeLeft(target: Date): TimeLeft {
  const diff = target.getTime() - Date.now()
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0, total: 0 }
  const total = Math.floor(diff / 1000)
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  return { days, hours, mins, secs, total }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function formatRaceDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatRaceTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const opts: Intl.DateTimeFormatOptions = { month: 'long', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', { ...opts, year: 'numeric' })}`
}

function formatSessionDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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

const Countdown = memo(function Countdown({ meetings, sessions }: Props) {
  const raceMeetings = getRaceMeetings(meetings).sort(
    (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
  )

  const currentMeeting = getCurrentMeeting(meetings)
  const nextMeeting = getNextMeeting(meetings)
  const targetMeeting = currentMeeting ?? nextMeeting
  const isLive = currentMeeting !== null

  const completedCount = raceMeetings.filter((m) => isMeetingCompleted(m)).length
  const progressPct = raceMeetings.length > 0 ? (completedCount / raceMeetings.length) * 100 : 0

  const roundNumber = targetMeeting
    ? raceMeetings.findIndex((m) => m.meeting_key === targetMeeting.meeting_key) + 1
    : null

  const raceSession = targetMeeting
    ? sessions.find(
        (s) =>
          s.meeting_key === targetMeeting.meeting_key &&
          s.session_name === 'Race'
      )
    : null

  const meetingSessions = targetMeeting
    ? sessions
        .filter((s) => s.meeting_key === targetMeeting.meeting_key)
        .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
    : []

  const countdownTarget = raceSession
    ? new Date(raceSession.date_start)
    : targetMeeting
    ? new Date(targetMeeting.date_start)
    : null

  const countdownLabel = raceSession ? 'Race starts in' : 'Race weekend starts in'

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => {
    if (!countdownTarget || isLive) return { days: 0, hours: 0, mins: 0, secs: 0, total: 0 }
    return calcTimeLeft(countdownTarget)
  })

  useEffect(() => {
    if (isLive || !countdownTarget) return
    const id = setInterval(() => setTimeLeft(calcTimeLeft(countdownTarget)), 1000)
    return () => clearInterval(id)
  }, [isLive, countdownTarget])

  if (!targetMeeting) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center px-6">
        <p className="text-4xl font-black tracking-tighter text-zinc-100">Season Complete</p>
      </div>
    )
  }

  // Split "Bahrain Grand Prix" → "BAHRAIN" + "GRAND PRIX" for editorial typography
  const nameMatch = targetMeeting.meeting_name.match(/^(.*?)\s+(Grand\s+Prix)$/i)
  const locationName = nameMatch ? nameMatch[1].toUpperCase() : targetMeeting.meeting_name.toUpperCase()
  const grandPrixSuffix = nameMatch ? nameMatch[2].toUpperCase() : ''

  return (
    <div className="relative min-h-[100dvh] flex flex-col overflow-hidden">

      {/* Background image */}
      <div className="absolute inset-0">
        <Image
          src={HERO_IMAGE}
          alt="Formula 1 race"
          fill
          className="object-cover object-center"
          unoptimized
          priority
        />
        <div className="absolute inset-0 bg-black/55" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/92 via-black/55 to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-black/20" />
      </div>

      {/* Decorative oversized round number */}
      {roundNumber !== null && (
        <div
          className="absolute bottom-0 right-0 font-black text-white select-none pointer-events-none tabular-nums leading-none"
          style={{
            fontSize: 'clamp(18rem, 32vw, 44rem)',
            opacity: 0.038,
            transform: 'translate(6%, 22%)',
          }}
        >
          {String(roundNumber).padStart(2, '0')}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col justify-between px-8 md:px-14 py-10 md:py-14 max-w-[1400px] w-full mx-auto">

        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-px h-4 rounded-full bg-red-500" />
            <span className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase">
              {isLive ? 'Race Weekend' : `Round ${roundNumber ?? '—'} of ${raceMeetings.length}`}
            </span>
            {isLive && (
              <span className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[11px] font-bold text-red-500 tracking-[0.2em] uppercase">Live</span>
              </span>
            )}
          </div>
        </div>

        {/* Center */}
        <div className="my-auto py-8">

          <div className="mb-8">

              {/* Label */}
              <motion.p
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="flex items-center gap-2.5 text-[11px] font-bold tracking-[0.4em] uppercase text-zinc-400 mb-5"
              >
                <span className="inline-block w-5 h-px bg-zinc-600" />
                {isLive ? 'On Now' : 'Next Race'}
              </motion.p>

              {/* Editorial split race name */}
              <motion.div
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.65, delay: 0.1 }}
                className="mb-6"
              >
                <h1
                  className="font-black tracking-tighter text-white leading-[0.85]"
                  style={{ fontSize: 'clamp(3rem, 7.5vw, 8.5rem)' }}
                >
                  {locationName}
                </h1>
                {grandPrixSuffix && (
                  <p
                    className="font-black text-white/35 leading-[1.05] mt-1 tracking-[0.04em]"
                    style={{ fontSize: 'clamp(1.5rem, 3.8vw, 4.2rem)' }}
                  >
                    {grandPrixSuffix}
                  </p>
                )}
              </motion.div>

              {/* Animated red separator */}
              <motion.div
                initial={{ scaleX: 0, opacity: 0 }}
                animate={{ scaleX: 1, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3, ease: 'easeOut' }}
                className="h-px mb-5 origin-left rounded-full"
                style={{
                  maxWidth: 460,
                  background: 'linear-gradient(to right, rgba(220,38,38,0.8), rgba(220,38,38,0.15), transparent)',
                }}
              />

              {/* Circuit info — flag inline with circuit name */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-3">
                  {targetMeeting.country_flag && (
                    <div
                      className="relative flex-shrink-0 rounded overflow-hidden border border-white/15 shadow-lg"
                      style={{ width: 'clamp(28px, 3vw, 40px)', height: 'clamp(18px, 2vw, 26px)' }}
                    >
                      <Image
                        src={targetMeeting.country_flag}
                        alt={targetMeeting.country_name}
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    </div>
                  )}
                  <p className="text-zinc-300 text-base md:text-lg font-medium">
                    {targetMeeting.circuit_short_name}
                    <span className="text-zinc-600 mx-2">·</span>
                    {targetMeeting.country_name}
                  </p>
                </div>
                <p className="text-zinc-500 text-sm">
                  {formatDateRange(targetMeeting.date_start, targetMeeting.date_end)}
                </p>
                {raceSession && !isLive && (
                  <p className="text-zinc-500 text-sm mt-0.5">
                    Race:{' '}
                    <span className="text-zinc-300">
                      {formatRaceDate(raceSession.date_start)}
                    </span>
                    <span className="text-zinc-600 mx-1.5">@</span>
                    <span className="text-zinc-400">{formatRaceTime(raceSession.date_start)}</span>
                  </p>
                )}
              </div>
          </div>

          {/* Session schedule pills */}
          {meetingSessions.length > 0 && !isLive && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap gap-2 mb-8"
            >
              {meetingSessions.map((s) => {
                const isRace = s.session_key === raceSession?.session_key
                const short = SESSION_SHORT[s.session_name] ?? s.session_name
                return (
                  <div
                    key={s.session_key}
                    className={[
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold tracking-wider uppercase',
                      isRace
                        ? 'bg-red-600/20 border-red-500/40 text-red-400'
                        : 'bg-white/[0.04] border-white/[0.07] text-zinc-500',
                    ].join(' ')}
                  >
                    <span>{short}</span>
                    <span className={isRace ? 'text-red-600/60' : 'text-zinc-700'}>
                      {formatSessionDate(s.date_start)}
                    </span>
                  </div>
                )
              })}
            </motion.div>
          )}

          {/* Countdown or Live */}
          {isLive ? (
            <div className="inline-flex items-center gap-3 px-6 py-4 rounded-2xl bg-red-600/15 border border-red-500/30 backdrop-blur-sm">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse flex-shrink-0" />
              <span className="text-red-400 font-black tracking-wide text-xl md:text-3xl uppercase">
                Race Weekend is Live
              </span>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.42 }}
            >
              <p className="text-[10px] font-bold tracking-[0.35em] uppercase text-zinc-500 mb-4">
                {countdownLabel}
              </p>
              <div className="flex items-end gap-2 md:gap-3">
                {[
                  { value: timeLeft.days, label: 'Days' },
                  { value: timeLeft.hours, label: 'Hrs' },
                  { value: timeLeft.mins, label: 'Min' },
                  { value: timeLeft.secs, label: 'Sec' },
                ].map(({ value, label }, i) => (
                  <React.Fragment key={label}>
                    {i > 0 && (
                      <span
                        className="text-white/15 font-black tabular-nums select-none pb-7"
                        style={{ fontSize: 'clamp(1.4rem, 2.8vw, 3.2rem)' }}
                      >
                        :
                      </span>
                    )}
                    <div className="relative flex flex-col items-center rounded-2xl overflow-hidden bg-white/[0.05] border border-white/[0.07] backdrop-blur-sm px-3 md:px-6 pt-0.5 pb-3 min-w-[62px] md:min-w-[96px]">
                      {/* Red top accent line */}
                      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-red-600 via-red-500 to-transparent" />
                      <span
                        className="font-black tabular-nums text-white leading-none mt-4"
                        style={{ fontSize: 'clamp(2rem, 5vw, 6.5rem)' }}
                      >
                        {pad(value)}
                      </span>
                      <span className="text-[9px] md:text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-500 mt-2">
                        {label}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            </motion.div>
          )}
        </div>

        {/* Bottom: season progress */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600">
              2026 Season
            </span>
            <span className="text-[10px] font-bold text-zinc-600 tabular-nums">
              {completedCount} / {raceMeetings.length} races
            </span>
          </div>
          <div className="h-[2px] w-full bg-white/[0.05] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-1000"
              style={{
                width: `${progressPct}%`,
                background: 'linear-gradient(to right, #dc2626, #ef4444)',
              }}
            />
          </div>
        </div>

      </div>
    </div>
  )
})

export default Countdown
