'use client'

import { useEffect, useMemo, useState } from 'react'
import type { Session, RaceControl } from '@/lib/openf1'
import { getCachedRaceControl } from '@/lib/client-cache'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_FAST } from '@/lib/session-live'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import { FadeUp } from '@/components/motion/reveals'

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
  // The no-flag colour is a LABEL, not decoration — at 12px it needs the
  // 4.5:1 floor. It was rgba(...,0.25) = 2.06:1, effectively unreadable.
  if (!flag) return 'var(--text-muted)'
  return FLAG_COLOURS[flag.toUpperCase()] ?? 'var(--text-muted)'
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

const anySession = () => true
const latestCompleted = (sorted: Session[]) => sorted.find((s) => new Date(s.date_end) < new Date())

export default function RaceControlPage() {
  const { sessions, selectedKey, setSelectedKey, loading } = useSessionList(
    anySession,
    latestCompleted
  )
  const selectedSession = sessions.find((s) => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(selectedKey, {
    messages: getCachedRaceControl,
  }, {
    pollMs: { messages: POLL_FAST },
    session: selectedSession,
  })
  // Rows kept through an outage may belong to a session the user has
  // already navigated away from — name it, so the heading above cannot
  // imply they are its own.
  const staleLabel =
    dataKey !== null && dataKey !== selectedKey
      ? sessionStripLabel(sessions.find((s) => s.session_key === dataKey))
      : null

  // Newest first
  const messages: RaceControl[] = useMemo(
    () =>
      [...(data?.messages ?? [])].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    [data]
  )

  const [filterCat, setFilterCat] = useState<string>('All')
  useEffect(() => setFilterCat('All'), [selectedKey])

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
        {/* The skeleton is still a page and still needs its heading —
            without one a visitor landing mid-load has no h1 at all. */}
        <h1 data-loading-h1 className="sr-only">RACE CONTROL</h1>
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
        live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />}
      />

      {/* category filter — menu grammar */}
      <div className="mt-8 flex flex-wrap gap-x-6 gap-y-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilterCat(cat)}
            className={`tap-44 label-mono transition-colors hover:text-[var(--accent)] ${
              filterCat === cat ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
            }`}
          >
            {cat.toUpperCase()}
          </button>
        ))}
      </div>

      <DataStateNotice
        state={state}
        message={message}
        stale={stale}
        staleLabel={staleLabel}
        onRetry={refresh}
        emptyLabel={selectedKey ? 'NO RACE CONTROL DATA FOR THIS SESSION' : 'SELECT A SESSION'}
        className="mt-8"
      />

      {fetching && messages.length === 0 ? (
        <div className="mt-16 space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-8 w-[70%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        // A filter that matches nothing is NOT the same as a session with no
        // messages — the notice above covers the latter.
        messages.length > 0 ? (
          <p className="label-mono mt-16 text-[var(--text-dim)]">NO MESSAGES FOR THIS FILTER</p>
        ) : null
      ) : (
        <div className="mt-14">
          <FadeUp>
            <p className="section-header text-[var(--text-dim)]">
              FEED — {filtered.length} MESSAGE{filtered.length !== 1 ? 'S' : ''} · NEWEST FIRST
            </p>
          </FadeUp>
          {/* The feed is a LIST of messages. role="list"/"listitem" gives a
              screen reader the count and lets it navigate item by item,
              without changing a single style — restructuring these flex rows
              into a real <ul> would. */}
          <div className="mt-6 font-mono text-[12px] leading-relaxed" role="list">
            {filtered.map((msg, idx) => (
              <div
                key={idx}
                role="listitem"
                className="flex items-baseline gap-4 border-t border-[var(--line)] py-2.5"
              >
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
