'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, RaceControl } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedRaceControl } from '@/lib/client-cache'
import SessionHeader from '@/components/session/SessionHeader'
import { FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

// Flag colours are the dataset here (like compounds on /stints).
const FLAG_COLOURS: Record<string, string> = {
  'GREEN': '#4ADE80',
  'YELLOW': '#FACC15',
  'DOUBLE YELLOW': '#FACC15',
  'RED': '#EF4444',
  'CHEQUERED': '#F5F5F3',
  'BLUE': '#60A5FA',
  'SC DEPLOYED': '#FACC15',
  'VSC DEPLOYED': '#FB923C',
  'VSC ENDING': '#FB923C',
  'SC ENDING': '#FACC15',
}

function flagColour(flag: string | null): string {
  if (!flag) return 'rgba(245,245,243,0.25)'
  return FLAG_COLOURS[flag.toUpperCase()] ?? 'rgba(245,245,243,0.25)'
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const CATEGORIES = ['All', 'Flag', 'SafetyCar', 'DRS', 'Other'] as const

export default function RaceControlPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [messages, setMessages] = useState<RaceControl[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterCat, setFilterCat] = useState<string>('All')
  const apiBlocked = useApiBlocked()

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        const sorted = all.sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )
        setSessions(sorted)
        const latest = sorted.find((s) => new Date(s.date_end) < new Date())
        if (latest) setSelectedKey(latest.session_key)
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchData = useCallback(async (sessionKey: number) => {
    setFetching(true)
    setError(null)
    try {
      const data = await getCachedRaceControl(sessionKey)
      // Newest first
      setMessages([...data].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
    } catch {
      setError('Failed to load race control data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

  const filtered = filterCat === 'All'
    ? messages
    : messages.filter((m) => {
        if (filterCat === 'Flag') return m.flag !== null
        if (filterCat === 'Other') return !m.flag && m.category !== 'SafetyCar' && m.category !== 'Drs'
        return m.category?.toLowerCase().includes(filterCat.toLowerCase())
      })

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-24 w-[55%] animate-pulse rounded bg-white/5" />
        <p className="label-mono mt-8 text-[var(--text-dim)]">LOADING SESSIONS…</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <SessionHeader
        ghost="RC"
        kicker="RACE CONTROL"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
      />

      {/* category filter — menu grammar */}
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(cat)}
            className={`label-mono transition-colors hover:text-[var(--accent)] ${
              filterCat === cat ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetching ? (
        <div className="mt-16 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-[70%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        !apiBlocked && (
          <p className="label-mono mt-16 text-[var(--text-dim)]">
            {selectedKey ? 'NO MESSAGES FOR THIS FILTER' : 'SELECT A SESSION'}
          </p>
        )
      ) : (
        <div className="mt-14">
          <FadeUp>
            <p className="label-mono text-[var(--text-dim)]">
              FEED — {filtered.length} MESSAGE{filtered.length !== 1 ? 'S' : ''} · NEWEST FIRST
            </p>
          </FadeUp>
          {/* the feed: a terminal in the site's mono register */}
          <div className="mt-6 font-mono text-[12px] leading-relaxed">
            {filtered.map((msg, idx) => (
              <div key={idx} className="flex items-baseline gap-4 border-t border-[var(--line)] py-2.5">
                {/* flag colour as the leading tick */}
                <span
                  aria-hidden
                  className="inline-block h-3 w-[3px] shrink-0 self-center"
                  style={{ backgroundColor: flagColour(msg.flag) }}
                />
                <span className="shrink-0 tabular-nums text-[var(--text-dim)]">
                  {formatTime(msg.date)}
                </span>
                {msg.lap_number != null && (
                  <span className="hidden shrink-0 tabular-nums text-[var(--text-dim)] sm:inline">
                    L{msg.lap_number}
                  </span>
                )}
                <span className="min-w-0 flex-1 text-[var(--text)]">
                  {msg.flag && (
                    <span className="mr-3" style={{ color: flagColour(msg.flag) }}>
                      [{msg.flag.toUpperCase()}]
                    </span>
                  )}
                  {msg.message}
                </span>
                {msg.driver_number != null && (
                  <span className="hidden shrink-0 text-[var(--text-dim)] md:inline">
                    #{msg.driver_number}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
