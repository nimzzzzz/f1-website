'use client'

import type { ReactNode } from 'react'
import type { Session } from '@/lib/openf1'
import SessionPicker from '@/components/SessionPicker'

// Shared header for the six session-workspace pages: the route name as a
// dim outline ghost, the picker's Bebas title as the page title, and the
// session metadata in mono beneath.
export default function SessionHeader({
  ghost,
  kicker,
  sessions,
  selectedKey,
  onSelect,
  live,
}: {
  ghost: string
  kicker: string
  sessions: Session[]
  selectedKey: number | null
  onSelect: (key: number) => void
  /** Freshness indicator, shown beside the session metadata during a live window. */
  live?: ReactNode
}) {
  const selected = sessions.find((s) => s.session_key === selectedKey) ?? null
  return (
    <header className="relative">
      <span
        aria-hidden
        className="outline-numeral pointer-events-none absolute -right-[2vw] -top-8 z-0 leading-none"
        style={{ fontSize: 'clamp(5rem, 12vw, 13rem)', WebkitTextStroke: '1px rgba(245,245,243,0.06)' }}
      >
        {ghost}
      </span>
      <div className="relative z-10">
        {/* The route's h1. Tailwind preflight strips UA heading styles, so
            this is a semantics change only — the type is unchanged. */}
        <h1 className="strip-header mb-6 text-[var(--text-dim)]">{kicker}</h1>
        <SessionPicker sessions={sessions} selectedKey={selectedKey} onSelect={onSelect} />
        {selected && (
          <div className="mt-4 flex flex-wrap items-baseline gap-x-5 gap-y-2">
            <p className="strip-header text-[var(--text-dim)]">
              {selected.circuit_short_name.toUpperCase()} —{' '}
              {new Date(selected.date_start)
                .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
                .toUpperCase()}
            </p>
            {live}
          </div>
        )}
      </div>
    </header>
  )
}
