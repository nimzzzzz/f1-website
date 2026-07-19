'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import type { Session, Driver, Position, SessionResult } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedDrivers, getCachedPositions, getCachedPitStops, getCachedSessionResult } from '@/lib/client-cache'
import { ClipReveal, FadeUp } from '@/components/motion/reveals'
import SessionHeader from '@/components/session/SessionHeader'

interface DriverResult {
  position: number
  driver: Driver
  pitStops: number
}

function getLatestPositions(positions: Position[]): Map<number, number> {
  const sorted = [...positions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
  const map = new Map<number, number>()
  for (const p of sorted) {
    if (!map.has(p.driver_number)) {
      map.set(p.driver_number, p.position)
    }
  }
  return map
}

const surname = (fullName: string) => {
  const parts = fullName.trim().split(/\s+/)
  return (parts[parts.length - 1] ?? fullName).toUpperCase()
}

function formatWinnerTime(duration: SessionResult['duration'] | null): string | null {
  if (typeof duration !== 'number' || !isFinite(duration)) return null
  const h = Math.floor(duration / 3600)
  const m = Math.floor((duration % 3600) / 60)
  const s = (duration % 60).toFixed(3).padStart(6, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

function gapLabel(r: SessionResult | undefined): string {
  if (!r) return '—'
  if (r.dnf) return 'DNF'
  if (r.dns) return 'DNS'
  if (r.dsq) return 'DSQ'
  const gap = r.gap_to_leader
  if (gap === null || gap === undefined) return '—'
  if (Array.isArray(gap)) {
    const laps = gap[0] ?? 1
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`
  }
  return `+${gap.toFixed(3)}S`
}

const isOut = (r: SessionResult | undefined) => Boolean(r && (r.dnf || r.dns || r.dsq))

export default function ResultsPage() {
  const allSessionsRef = useRef<Session[]>([])
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [results, setResults] = useState<DriverResult[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchingResults, setFetchingResults] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Gap/time/status enrichment per driver — same cached fetcher family,
  // fetched alongside (not inside) the untouched fetchResults flow.
  const [resultDetail, setResultDetail] = useState<Map<number, SessionResult> | null>(null)

  useEffect(() => {
    getCachedSessions()
      .then((all) => {
        allSessionsRef.current = all
        const allSorted = [...all].sort(
          (a, b) => new Date(b.date_start).getTime() - new Date(a.date_start).getTime()
        )
        setSessions(allSorted)

        const latest = allSorted.find((s) => new Date(s.date_end) < new Date())
        if (latest) setSelectedKey(latest.session_key)
      })
      .catch(() => setError('Failed to load sessions'))
      .finally(() => setLoading(false))
  }, [])

  const fetchResults = useCallback(async (sessionKey: number) => {
    setFetchingResults(true)
    setError(null)

    try {
      const [driverList, positions, pitStops] = await Promise.all([
        getCachedDrivers(sessionKey),
        getCachedPositions(sessionKey),
        getCachedPitStops(sessionKey),
      ])

      const latestPos = getLatestPositions(positions)
      const pitCount = pitStops.reduce<Record<number, number>>((acc, p) => {
        acc[p.driver_number] = (acc[p.driver_number] ?? 0) + 1
        return acc
      }, {})
      const driverMap = new Map(driverList.map((d) => [d.driver_number, d]))

      const resultRows: DriverResult[] = []
      latestPos.forEach((pos, driverNum) => {
        const driver = driverMap.get(driverNum)
        if (driver) {
          resultRows.push({ position: pos, driver, pitStops: pitCount[driverNum] ?? 0 })
        }
      })
      resultRows.sort((a, b) => a.position - b.position)
      setResults(resultRows)

    } catch {
      setError('Failed to load results')
    } finally {
      setFetchingResults(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchResults(selectedKey)
  }, [selectedKey, fetchResults])

  useEffect(() => {
    if (!selectedKey) return
    let alive = true
    setResultDetail(null)
    getCachedSessionResult(selectedKey)
      .then((rows: SessionResult[]) => {
        if (!alive || rows.length === 0) return
        setResultDetail(new Map(rows.map((r) => [r.driver_number, r])))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [selectedKey])

  const selectedSession = sessions.find((s) => s.session_key === selectedKey)

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-36 animate-pulse rounded bg-white/5" />
        <div className="mt-10 h-40 w-[60%] animate-pulse rounded bg-white/5" />
        <p className="label-mono mt-10 text-[var(--text-dim)]">LOADING SESSIONS…</p>
      </div>
    )
  }

  const winner = results.find((r) => r.position === 1)
  const p2 = results.find((r) => r.position === 2)
  const p3 = results.find((r) => r.position === 3)
  const field = results.filter((r) => r.position > 3)
  const winnerTime = winner
    ? formatWinnerTime(resultDetail?.get(winner.driver.driver_number)?.duration ?? null)
    : null

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <FadeUp>
        <SessionHeader
          ghost="RESULTS"
          kicker={`RESULTS${selectedSession ? ` — ${String(selectedSession.year)}` : ''}`}
          sessions={sessions}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
        />
      </FadeUp>

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetchingResults ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : results.length === 0 ? (
        (
          <p className="label-mono mt-16 text-[var(--text-dim)]">
            {selectedKey ? 'NO POSITION DATA FOR THIS SESSION' : 'SELECT A SESSION'}
          </p>
        )
      ) : (
        <>
          {/* ─── the winner, monumental ─── */}
          {winner && (
            <ClipReveal className="mt-14">
              <div className="border-t border-[var(--line)] pt-10">
                <p className="label-mono flex items-center gap-2.5 text-[var(--accent)]">
                  P1
                  <span aria-hidden className="inline-block h-[2px] w-8 bg-[var(--accent)]" />
                </p>
                <p
                  className="mt-4 uppercase leading-[0.85] text-[var(--text)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4.5rem, 13vw, 13rem)' }}
                  title={winner.driver.full_name}
                >
                  {surname(winner.driver.full_name)}
                </p>
                <p className="label-mono mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
                  <span className="flex items-center gap-2">
                    <span
                      aria-hidden
                      className="inline-block h-[2px] w-3"
                      style={{ backgroundColor: `#${winner.driver.team_colour}` }}
                    />
                    {winner.driver.team_name?.toUpperCase()}
                  </span>
                  {winnerTime && <span className="tabular-nums text-[var(--text)]">{winnerTime}</span>}
                </p>
              </div>
            </ClipReveal>
          )}

          {/* ─── P2 / P3 — the gaps are the story ─── */}
          {(p2 || p3) && (
            <div className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-2">
              {[p2, p3].filter(Boolean).map((r, i) => {
                const row = r as DriverResult
                const detail = resultDetail?.get(row.driver.driver_number)
                return (
                  <FadeUp key={row.driver.driver_number} delay={0.12 + i * 0.1}>
                    <div className="border-t border-[var(--line)] pt-6">
                      <p className="label-mono text-[var(--text-dim)]">P{row.position}</p>
                      <p
                        className="mt-2 uppercase leading-none text-[var(--text)]"
                        style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 5vw, 4.5rem)' }}
                        title={row.driver.full_name}
                      >
                        {surname(row.driver.full_name)}
                      </p>
                      <p className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1">
                        <span
                          className="font-mono tabular-nums text-[var(--text)]"
                          style={{ fontSize: 'clamp(1.2rem, 2.4vw, 2rem)' }}
                        >
                          {gapLabel(detail)}
                        </span>
                        <span className="label-mono text-[var(--text-dim)]">
                          {row.driver.team_name?.toUpperCase()}
                        </span>
                      </p>
                    </div>
                  </FadeUp>
                )
              })}
            </div>
          )}

          {/* ─── the field ─── */}
          {field.length > 0 && (
            <div className="mt-20">
              <FadeUp>
                <p className="label-mono text-[var(--text-dim)]">THE FIELD</p>
              </FadeUp>
              <div className="mt-6">
                {field.map((row) => {
                  const detail = resultDetail?.get(row.driver.driver_number)
                  const out = isOut(detail)
                  return (
                    <ClipReveal key={row.driver.driver_number}>
                      <div
                        className="flex items-baseline gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                        style={out ? { opacity: 0.35 } : undefined}
                      >
                        <span className="label-mono w-8 shrink-0 tabular-nums text-[var(--text-dim)]">
                          P{row.position}
                        </span>
                        <p
                          className="min-w-0 flex-1 truncate uppercase leading-none text-[var(--text)]"
                          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.6vw, 2.2rem)' }}
                          title={row.driver.full_name}
                        >
                          {surname(row.driver.full_name)}
                        </p>
                        <span className="label-mono hidden text-[var(--text-dim)] md:block">
                          {row.driver.team_name?.toUpperCase()}
                        </span>
                        <span className="label-mono w-28 shrink-0 text-right tabular-nums text-[var(--text)]">
                          {gapLabel(detail)}
                        </span>
                      </div>
                    </ClipReveal>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
