'use client'

import type { Meeting, Session } from '@/lib/openf1'
import { isCancelled } from '@/lib/openf1'
import { circuitImageForMeeting } from '@/lib/media-manifest'
import { formatScheduleDates, formatScheduleTime, trackTimeLabel, type ScheduleTimeMode } from '@/lib/schedule-time'
import TreatedImage from '@/components/media/TreatedImage'
import CircuitBackdrop from '@/components/media/CircuitBackdrop'

const SESSION_SHORT: Record<string, string> = {
  'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3',
  'Sprint Shootout': 'SQ', 'Sprint Qualifying': 'SQ', Sprint: 'SPRINT', Qualifying: 'QUALI', Race: 'RACE',
}

export default function ScheduleRound({ meeting, sessions, winner, roundNo, index, isTarget, now, timeMode, localZone }: {
  meeting: Meeting
  sessions: Session[]
  winner?: string
  roundNo: number
  index: number
  isTarget: boolean
  now: number
  timeMode: ScheduleTimeMode
  localZone: string
}) {
  const cancelled = isCancelled(meeting)
  const past = Date.parse(meeting.date_end) < now
  const current = Date.parse(meeting.date_start) <= now && !past
  const status = cancelled ? 'cancelled' : isTarget ? 'current' : past ? 'past' : 'upcoming'
  const icon = circuitImageForMeeting(meeting)
  const headingId = `round-title-${meeting.meeting_key}`
  const visibleSessions = sessions.filter((session) => !isCancelled(session))

  return (
    <article
      id={`round-${meeting.meeting_key}`}
      aria-labelledby={headingId}
      tabIndex={-1}
      className={`schedule-round ${index % 2 ? 'schedule-round-right' : 'schedule-round-left'}`}
      data-status={status}
    >
      <div className="schedule-photo-frame" aria-hidden="true">
        <div className="schedule-photo-reveal">
          <div className="schedule-photo-focus">
            <CircuitBackdrop
              meetingKey={meeting.meeting_key}
              circuitShortName={meeting.circuit_short_name}
              countryName={meeting.country_name}
              eager={index < 2 || isTarget}
              presence={cancelled ? 0.25 : 1}
              lift={isTarget}
            />
          </div>
        </div>
      </div>

      <span className="schedule-node" aria-hidden="true"><span className="schedule-node-core" /></span>

      <div className="schedule-round-content">
        <div className="schedule-round-heading">
          {icon && (
            <TreatedImage src={icon} treatment="line" fade={false}
              position={index % 2 ? 'left center' : 'right center'} sizes="120px"
              className="schedule-circuit-icon" />
          )}
          <div className="schedule-round-number-line">
            <span className="schedule-round-number" aria-label={cancelled ? 'Cancelled round' : `Round ${roundNo}`}>
              {cancelled ? '—' : String(roundNo).padStart(2, '0')}
            </span>
            {isTarget && <span className="schedule-weekend-label">{current ? 'THIS WEEKEND' : 'UP NEXT'}</span>}
          </div>
          <h2 id={headingId} className="schedule-circuit-name">{meeting.circuit_short_name}</h2>
        </div>

        <p className="schedule-round-meta">
          {meeting.country_name.toUpperCase()} · {formatScheduleDates(meeting.date_start, meeting.date_end, timeMode, meeting.gmt_offset, localZone)}
          {cancelled ? ' · CANCELLED' : ''}
        </p>
        {winner && !cancelled && <p className="schedule-winner">P1 · {winner}</p>}

        {!cancelled && visibleSessions.length > 0 && (
          <div className="schedule-sessions">
            <p className="schedule-session-zone">
              {timeMode === 'track' ? `TRACK TIME · ${trackTimeLabel(meeting.gmt_offset)}` : 'YOUR TIME'}
            </p>
            <dl>
              {visibleSessions.map((session) => {
                const live = Date.parse(session.date_start) <= now && now < Date.parse(session.date_end)
                return (
                  <div key={session.session_key} className="schedule-session"
                    data-race={session.session_name === 'Race' || undefined} data-live={live || undefined}>
                    <dt>
                      {SESSION_SHORT[session.session_name] ?? session.session_name.toUpperCase()}
                      {live && <span className="schedule-live-label">LIVE</span>}
                    </dt>
                    <dd><time dateTime={session.date_start}
                      title={timeMode === 'track' ? trackTimeLabel(session.gmt_offset) : localZone}>
                      {formatScheduleTime(session.date_start, timeMode, session.gmt_offset, localZone)}
                    </time></dd>
                  </div>
                )
              })}
            </dl>
          </div>
        )}
      </div>
    </article>
  )
}
