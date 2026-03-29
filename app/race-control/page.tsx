'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, RaceControl } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedRaceControl } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

const FLAG_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  'GREEN':         { bg: 'bg-green-950/40',  text: 'text-green-400',  dot: 'bg-green-500'  },
  'YELLOW':        { bg: 'bg-yellow-950/40', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  'DOUBLE YELLOW': { bg: 'bg-yellow-950/40', text: 'text-yellow-400', dot: 'bg-yellow-500' },
  'RED':           { bg: 'bg-red-950/40',    text: 'text-red-400',    dot: 'bg-red-500'    },
  'CHEQUERED':     { bg: 'bg-zinc-800/40',   text: 'text-zinc-300',   dot: 'bg-zinc-400'   },
  'BLUE':          { bg: 'bg-blue-950/40',   text: 'text-blue-400',   dot: 'bg-blue-500'   },
  'SC DEPLOYED':   { bg: 'bg-yellow-950/40', text: 'text-yellow-300', dot: 'bg-yellow-400' },
  'VSC DEPLOYED':  { bg: 'bg-orange-950/40', text: 'text-orange-400', dot: 'bg-orange-500' },
  'VSC ENDING':    { bg: 'bg-orange-950/30', text: 'text-orange-300', dot: 'bg-orange-400' },
  'SC ENDING':     { bg: 'bg-yellow-950/30', text: 'text-yellow-300', dot: 'bg-yellow-400' },
}

function getFlagStyle(flag: string | null) {
  if (!flag) return { bg: 'bg-zinc-900/40', text: 'text-zinc-400', dot: 'bg-zinc-600' }
  return FLAG_STYLES[flag.toUpperCase()] ?? { bg: 'bg-zinc-900/40', text: 'text-zinc-400', dot: 'bg-zinc-600' }
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
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
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-56 bg-zinc-800 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Header */}
      <div className="mb-8">
        <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
          2026 Season
        </p>
        <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-zinc-100">
          Race Control
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          Flags, safety car deployments, and official messages
        </p>
      </div>

      {/* Controls row */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="max-w-sm w-full">
          <SessionPicker
            sessions={sessions}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            label="Select Session"
          />
        </div>

        {/* Category filter */}
        <div className="flex items-end gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCat(cat)}
              className={[
                'px-3 py-2 text-xs font-bold tracking-wider uppercase rounded-lg border transition-colors',
                filterCat === cat
                  ? 'border-red-600/50 bg-red-600/15 text-red-400'
                  : 'border-zinc-800/50 bg-zinc-900/40 text-zinc-500 hover:text-zinc-300',
              ].join(' ')}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 bg-zinc-900/60 border border-zinc-800/50 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No messages"
          message={
            selectedKey
              ? 'No race control messages recorded for this session.'
              : 'Select a session to view race control messages.'
          }
        />
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-600 tracking-[0.25em] uppercase mb-3">
            {filtered.length} message{filtered.length !== 1 ? 's' : ''} — newest first
          </p>
          {filtered.map((msg, idx) => {
            const style = getFlagStyle(msg.flag)
            return (
              <div
                key={idx}
                className={`flex items-start gap-4 px-4 py-3 rounded-lg border border-zinc-800/30 ${style.bg} transition-colors`}
              >
                {/* Flag dot */}
                <div className="flex-shrink-0 mt-1.5">
                  <span className={`w-2 h-2 rounded-full block ${style.dot}`} />
                </div>

                {/* Time */}
                <span className="text-[11px] text-zinc-600 tabular-nums font-mono flex-shrink-0 mt-0.5 min-w-[60px]">
                  {formatTime(msg.date)}
                </span>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    {msg.flag && (
                      <span className={`text-[10px] font-black tracking-[0.2em] uppercase ${style.text}`}>
                        {msg.flag}
                      </span>
                    )}
                    {msg.category && (
                      <span className="text-[10px] text-zinc-600 tracking-wider uppercase">
                        {msg.category}
                      </span>
                    )}
                    {msg.lap_number && (
                      <span className="text-[10px] text-zinc-700">
                        Lap {msg.lap_number}
                      </span>
                    )}
                    {msg.driver_number && (
                      <span className="text-[10px] text-zinc-700">
                        #{msg.driver_number}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-zinc-300 leading-snug">{msg.message}</p>
                </div>

                {/* Scope */}
                {msg.scope && (
                  <span className="text-[10px] text-zinc-700 flex-shrink-0 mt-0.5 capitalize">
                    {msg.scope}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
