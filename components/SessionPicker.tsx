'use client'

import type { Session } from '@/lib/openf1'

interface Props {
  sessions: Session[]
  selectedKey: number | null
  onSelect: (key: number) => void
  label?: string
}

function getSessionStatus(session: Session): 'live' | 'completed' | 'upcoming' {
  const now = new Date()
  const start = new Date(session.date_start)
  const end = new Date(session.date_end)
  if (start <= now && now < end) return 'live'
  if (end < now) return 'completed'
  return 'upcoming'
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export default function SessionPicker({ sessions, selectedKey, onSelect, label = 'Session' }: Props) {
  // Group sessions by meeting
  const grouped = sessions.reduce<Record<number, Session[]>>((acc, s) => {
    if (!acc[s.meeting_key]) acc[s.meeting_key] = []
    acc[s.meeting_key].push(s)
    return acc
  }, {})

  const sortedMeetingKeys = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => {
      const aFirst = grouped[a][0]
      const bFirst = grouped[b][0]
      return new Date(aFirst.date_start).getTime() - new Date(bFirst.date_start).getTime()
    })

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-500">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          value={selectedKey ?? ''}
          onChange={(e) => onSelect(Number(e.target.value))}
          className="w-full appearance-none bg-zinc-900 border border-zinc-800/50 rounded-lg px-4 py-2.5 pr-10 text-sm text-zinc-200 font-medium focus:outline-none focus:border-zinc-600 cursor-pointer"
        >
          <option value="" disabled>
            Select a session...
          </option>
          {sortedMeetingKeys.map((meetingKey) => {
            const meetingSessions = grouped[meetingKey].sort(
              (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
            )
            const firstName = meetingSessions[0]
            return (
              <optgroup
                key={meetingKey}
                label={`${firstName.location} — ${firstName.country_name}`}
              >
                {meetingSessions.map((s) => {
                  const status = getSessionStatus(s)
                  const statusLabel =
                    status === 'live' ? ' [LIVE]' : status === 'completed' ? '' : ' [Upcoming]'
                  return (
                    <option key={s.session_key} value={s.session_key}>
                      {s.session_name} — {formatSessionDate(s.date_start)}
                      {statusLabel}
                    </option>
                  )
                })}
              </optgroup>
            )
          })}
        </select>
        {/* Chevron */}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </div>

      {/* Status indicator for selected session */}
      {selectedKey && (() => {
        const sel = sessions.find((s) => s.session_key === selectedKey)
        if (!sel) return null
        const status = getSessionStatus(sel)
        return (
          <div className="flex items-center gap-2 mt-1">
            {status === 'live' && (
              <span className="flex items-center gap-1.5 text-red-500 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Live Session
              </span>
            )}
            {status === 'completed' && (
              <span className="flex items-center gap-1.5 text-zinc-600 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                Completed
              </span>
            )}
            {status === 'upcoming' && (
              <span className="flex items-center gap-1.5 text-zinc-400 text-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-500" />
                Upcoming
              </span>
            )}
          </div>
        )
      })()}
    </div>
  )
}
