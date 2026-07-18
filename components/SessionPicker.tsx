'use client'

import { useEffect, useRef, useState } from 'react'
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
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

// The session picker in the design language: the selected session IS the
// page title (Bebas button), and the list opens as a compact overlay in
// menu grammar — mono, dim, hover accent. Same props as the old native
// select, so every consumer upgrades in place.
export default function SessionPicker({ sessions, selectedKey, onSelect, label }: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const selected = sessions.find((s) => s.session_key === selectedKey) ?? null
  const selectedStatus = selected ? getSessionStatus(selected) : null

  // Group sessions by meeting (existing grouping logic preserved)
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
      return new Date(bFirst.date_start).getTime() - new Date(aFirst.date_start).getTime()
    })

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onClick)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onClick)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      {label && <p className="label-mono mb-2 text-[var(--text-dim)]">{label.toUpperCase()}</p>}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 text-left"
      >
        <span
          className="uppercase leading-[0.9] text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4.6vw, 4rem)' }}
        >
          {selected ? `${selected.location} — ${selected.session_name}` : 'Select session'}
        </span>
        <span className="flex items-center gap-3">
          {selectedStatus === 'live' && (
            <span className="label-mono flex items-center gap-1.5 text-[var(--accent)]">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
              LIVE
            </span>
          )}
          <span
            aria-hidden
            className={`label-mono inline-block text-[var(--text-dim)] transition-transform duration-200 group-hover:text-[var(--accent)] motion-reduce:transition-none ${
              open ? 'rotate-180' : ''
            }`}
          >
            ▾
          </span>
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 top-full z-[140] mt-5 max-h-[62vh] w-[min(92vw,540px)] overflow-y-auto border border-[var(--line)] bg-[rgba(10,10,10,0.98)] py-2 backdrop-blur-sm"
        >
          {sortedMeetingKeys.map((meetingKey) => {
            const meetingSessions = grouped[meetingKey].sort(
              (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
            )
            const first = meetingSessions[0]
            return (
              <div key={meetingKey} className="border-b border-[var(--line)] py-2 last:border-b-0">
                <p className="label-mono px-5 py-2 text-[var(--text-dim)] opacity-70">
                  {first.location.toUpperCase()} — {first.country_name.toUpperCase()}
                </p>
                {meetingSessions.map((s) => {
                  const status = getSessionStatus(s)
                  const isSelected = s.session_key === selectedKey
                  return (
                    <button
                      key={s.session_key}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => {
                        onSelect(s.session_key)
                        setOpen(false)
                      }}
                      className={`label-mono flex w-full items-center justify-between gap-6 px-5 py-2.5 text-left transition-[color,transform] duration-200 hover:translate-x-1 hover:text-[var(--accent)] motion-reduce:transition-none ${
                        isSelected ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        {isSelected && (
                          <span aria-hidden className="inline-block h-[2px] w-3 bg-[var(--accent)]" />
                        )}
                        {s.session_name.toUpperCase()}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 tabular-nums">
                        {formatSessionDate(s.date_start)}
                        {status === 'live' && (
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
                        )}
                        {status === 'upcoming' && <span className="opacity-60">SOON</span>}
                      </span>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
