'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, TeamRadio, Driver } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedTeamRadio, getCachedDrivers } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

function formatTime(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
}

export default function TeamRadioPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [clips, setClips] = useState<TeamRadio[]>([])
  const [drivers, setDrivers] = useState<Driver[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filterDriver, setFilterDriver] = useState<number | 'all'>('all')

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
      const [radioData, driverData] = await Promise.all([
        getCachedTeamRadio(sessionKey),
        getCachedDrivers(sessionKey),
      ])
      setClips([...radioData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()))
      setDrivers(driverData)
      setFilterDriver('all')
    } catch {
      setError('Failed to load team radio data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

  const driverMap = new Map(drivers.map((d) => [d.driver_number, d]))

  const filtered = filterDriver === 'all'
    ? clips
    : clips.filter((c) => c.driver_number === filterDriver)

  // Drivers that appear in the radio clips
  const driversInClips = drivers.filter((d) =>
    clips.some((c) => c.driver_number === d.driver_number)
  )

  if (loading) {
    return (
      <div className="py-16 md:py-20 max-w-[1400px] mx-auto px-6 md:px-12">
        <div className="animate-pulse space-y-4">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-10 w-48 bg-zinc-800 rounded" />
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
          Team Radio
        </h1>
        <p className="text-zinc-500 text-sm mt-2">
          Driver communications from the pit wall
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

        {/* Driver filter */}
        {driversInClips.length > 0 && (
          <div className="relative max-w-[200px] flex items-end">
            <select
              value={filterDriver}
              onChange={(e) =>
                setFilterDriver(e.target.value === 'all' ? 'all' : Number(e.target.value))
              }
              className="w-full appearance-none bg-zinc-900 border border-zinc-800/50 rounded-lg px-3 py-2 pr-8 text-xs text-zinc-300 focus:outline-none"
            >
              <option value="all">All Drivers</option>
              {driversInClips.map((d) => (
                <option key={d.driver_number} value={d.driver_number}>
                  {d.name_acronym} — #{d.driver_number}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
              <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                <path d="M2 4.5L6 8.5L10 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 bg-zinc-900/60 border border-zinc-800/50 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="No team radio"
          message={
            selectedKey
              ? 'No team radio recordings available for this session.'
              : 'Select a session to view team radio.'
          }
        />
      ) : (
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold text-zinc-600 tracking-[0.25em] uppercase mb-3">
            {filtered.length} clip{filtered.length !== 1 ? 's' : ''} — newest first
          </p>
          {filtered.map((clip, idx) => {
            const driver = driverMap.get(clip.driver_number)
            const teamColor = driver?.team_colour ? `#${driver.team_colour}` : '#52525b'

            return (
              <div
                key={idx}
                className="flex items-center gap-4 px-4 py-3 rounded-lg border border-zinc-800/30 bg-zinc-900/40 hover:bg-zinc-800/30 transition-colors group"
              >
                {/* Team color dot */}
                <div className="flex-shrink-0">
                  <span
                    className="w-2 h-2 rounded-full block"
                    style={{ backgroundColor: teamColor }}
                  />
                </div>

                {/* Time */}
                <span className="text-[11px] text-zinc-600 tabular-nums font-mono flex-shrink-0 min-w-[60px]">
                  {formatTime(clip.date)}
                </span>

                {/* Driver info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-xs font-black tracking-wider uppercase"
                      style={{ color: teamColor }}
                    >
                      {driver?.name_acronym ?? `#${clip.driver_number}`}
                    </span>
                    {driver && (
                      <span className="text-[10px] text-zinc-600 tracking-wide">
                        {driver.team_name}
                      </span>
                    )}
                  </div>
                  {driver && (
                    <p className="text-[11px] text-zinc-600 mt-0.5">
                      {driver.full_name}
                    </p>
                  )}
                </div>

                {/* Play button */}
                <a
                  href={clip.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-700/50 bg-zinc-800/50 text-zinc-400 hover:text-zinc-100 hover:border-zinc-600/50 hover:bg-zinc-700/50 transition-colors text-[11px] font-bold tracking-wider uppercase"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="currentColor">
                    <path d="M2.5 2.5L9.5 6L2.5 9.5V2.5Z" />
                  </svg>
                  Play
                </a>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
