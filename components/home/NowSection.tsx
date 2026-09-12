'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import type { Meeting, Session } from '@/lib/openf1'
import NowBackdrop from '@/components/home/NowBackdrop'
import { circuitImageForMeeting } from '@/lib/media-manifest'
import { weekendSessions, weekendState, countdownParts } from '@/lib/race-weekend'
import { TransitionLink } from '@/components/motion/TransitionProvider'

interface Props {
  meeting: Meeting
  sessions: Session[]
  round: number
  totalRounds: number
  isLive: boolean
  onPlayIntro: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')

export default function NowSection({ meeting, sessions, round, totalRounds, isLive, onPlayIntro }: Props) {
  const [now, setNow] = useState(() => Date.now())
  const [localTime, setLocalTime] = useState(false)
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const weekend = useMemo(() => weekendSessions(sessions, meeting.meeting_key), [sessions, meeting.meeting_key])
  const { live, next } = weekendState(weekend, now)
  const clock = next ? countdownParts(next.date_start, now) : null
  const big = meeting.meeting_name.replace(/\s+Grand\s+Prix$/i, '')
  const circuit = circuitImageForMeeting(meeting)
  const range = [meeting.date_start, meeting.date_end].map((date) => new Date(date).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', timeZone: 'UTC',
  })).join(' - ')

  return (
    <>
      <section className="race-hero" aria-labelledby="race-title">
        <div className="race-hero-backdrop" aria-hidden="true">
          <NowBackdrop
            meetingKey={meeting.meeting_key}
            circuitShortName={meeting.circuit_short_name}
            countryName={meeting.country_name}
          />
        </div>
        <div className="race-hero-content home-width">
          <div className="race-hero-kicker">
            <span className="race-round">R{pad(round)}</span>
            <span>{isLive ? 'RACE WEEKEND' : 'UP NEXT'}</span>
            <span className="race-kicker-year">{meeting.year} FORMULA 1</span>
          </div>
          <h1 id="race-title" className={`race-title ${big.length > 13 ? 'race-title-long' : ''}`}>
            <span>{big}</span><span className="race-title-secondary">Grand Prix</span>
          </h1>
          <p className="race-hero-location">{meeting.location || meeting.circuit_short_name}, {meeting.country_name}<span>{range}</span></p>
          <div className="race-hero-actions">
            <a href="#weekend" className="race-button race-button-primary">The weekend <span aria-hidden="true">↗</span></a>
            <button type="button" onClick={onPlayIntro} className="race-text-link">Play the intro <span aria-hidden="true">↗</span></button>
          </div>
        </div>
        <div className="hero-circuit" aria-hidden="true">
          {circuit && <Image src={circuit} alt="" width={200} height={140} sizes="180px" />}
          <span>{meeting.circuit_short_name}</span>
        </div>
        <div className="race-clock-strip">
          <div className="home-width race-clock-inner">
            <div className="race-clock-heading">
              <span className="label-mono">{live ? 'ON TRACK NOW' : next ? 'NEXT SESSION' : 'WEEKEND COMPLETE'}</span>
              <strong>{live?.session_name ?? next?.session_name ?? 'The chequered flag'}</strong>
            </div>
            {live ? <div className="race-on-air"><span />Session in progress</div> : clock ? (
              <div className="race-countdown" role="timer" aria-label={`Time until ${next?.session_name}`}>
                {clock.map((value, i) => <div key={i}><strong suppressHydrationWarning>{pad(value)}</strong><span>{['DAYS', 'HRS', 'MIN', 'SEC'][i]}</span></div>)}
              </div>
            ) : <p className="race-clock-complete">Explore the results and every lap.</p>}
            <TransitionLink href={live ? '/positions' : '/results'} className="race-clock-link">{live ? 'Live timing' : 'Session results'}<span aria-hidden="true">↗</span></TransitionLink>
          </div>
        </div>
      </section>

      <section id="weekend" className="weekend-section home-width" aria-label="Race weekend schedule">
        <div className="weekend-heading"><h2>The weekend.</h2><div className="time-switch" role="group" aria-label="Schedule time zone">
          <button type="button" aria-pressed={!localTime} onClick={() => setLocalTime(false)}>UTC</button>
          <button type="button" aria-pressed={localTime} onClick={() => setLocalTime(true)}>Your time</button>
        </div></div>
        {weekend.length ? <ol className="weekend-sessions">{weekend.map((session) => {
          const past = Date.parse(session.date_end) <= now
          const current = live?.session_key === session.session_key
          const upcoming = !live && next?.session_key === session.session_key
          const date = new Date(session.date_start)
          const zone = localTime ? undefined : 'UTC'
          return <li key={session.session_key} className={current || upcoming ? 'weekend-session is-next' : 'weekend-session'}>
            <div className="weekend-session-top"><span>{date.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', timeZone: zone })}</span><span className="weekend-session-state">{current ? 'IN PROGRESS' : past ? 'COMPLETE' : upcoming ? 'UP NEXT' : ''}</span></div>
            <h3>{session.session_name}</h3>
            <time dateTime={session.date_start}>{date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: zone })}</time>
          </li>
        })}</ol> : <p className="weekend-unavailable">Session times will appear when the schedule is available.</p>}
        <p className="weekend-footnote">Round {pad(round)} of {pad(totalRounds)}<span>{localTime ? 'Times shown in your time zone' : 'All times in UTC'}</span></p>
      </section>
    </>
  )
}
