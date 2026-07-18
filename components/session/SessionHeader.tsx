'use client'

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
}: {
  ghost: string
  kicker: string
  sessions: Session[]
  selectedKey: number | null
  onSelect: (key: number) => void
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
        <p className="label-mono mb-6 text-[var(--text-dim)]">{kicker}</p>
        <SessionPicker sessions={sessions} selectedKey={selectedKey} onSelect={onSelect} />
        {selected && (
          <p className="label-mono mt-4 text-[var(--text-dim)]">
            {selected.circuit_short_name.toUpperCase()} ·{' '}
            {new Date(selected.date_start)
              .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              .toUpperCase()}
          </p>
        )}
      </div>
    </header>
  )
}
