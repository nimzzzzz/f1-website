'use client'

import { useMemo } from 'react'
import type { Session, Driver, Position, SessionResult } from '@/lib/openf1'
import { asNum } from '@/lib/format'
import { getCachedDrivers, getCachedPositions, getCachedPitStops, getCachedSessionResult } from '@/lib/client-cache'
import { useSessionData, useSessionList } from '@/lib/use-session-data'
import { ClipReveal, FadeUp } from '@/components/motion/reveals'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'

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

function formatWinnerTime(rawDuration: SessionResult['duration'] | null): string | null {
  const duration = asNum(rawDuration)
  if (duration === null) return null
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
    const laps = asNum(gap[0]) ?? 1
    return `+${laps} LAP${laps > 1 ? 'S' : ''}`
  }
  const n = asNum(gap)
  return n === null ? '—' : `+${n.toFixed(3)}S`
}

const isOut = (r: SessionResult | undefined) => Boolean(r && (r.dnf || r.dns || r.dsq))

const anySession = () => true
const latestCompleted = (sorted: Session[]) => sorted.find((s) => new Date(s.date_end) < new Date())

export default function ResultsPage() {
  const { sessions, selectedKey, setSelectedKey, loading } = useSessionList(
    anySession,
    latestCompleted
  )
  // All four endpoints move together now. The gap/time/status detail used to
  // load in its own effect with its own `alive` flag, which meant the two
  // could disagree about which session was on screen.
  const {
    data,
    state,
    message,
    stale,
    fetching: fetchingResults,
    refresh,
  } = useSessionData(
    selectedKey,
    {
      positions: getCachedPositions,
      drivers: getCachedDrivers,
      pitStops: getCachedPitStops,
      detail: getCachedSessionResult,
    },
    // drivers and pitStops are REQUIRED: result rows are keyed on the
    // roster, and a missing pit count would render "0 STOPS" — a false
    // claim rather than a blank. detail is pure enrichment (gap, winner
    // time) and renders "—" when absent, so its frequent 429s must not
    // take the classification off the page.
    { primary: 'positions', optional: ['detail'] }
  )

  const results: DriverResult[] = useMemo(() => {
    const positions: Position[] = data?.positions ?? []
    const driverList: Driver[] = data?.drivers ?? []
    const latestPos = getLatestPositions(positions)
    const pitCount = (data?.pitStops ?? []).reduce<Record<number, number>>((acc, p) => {
      acc[p.driver_number] = (acc[p.driver_number] ?? 0) + 1
      return acc
    }, {})
    const driverMap = new Map(driverList.map((d) => [d.driver_number, d]))

    const rows: DriverResult[] = []
    latestPos.forEach((pos, driverNum) => {
      const driver = driverMap.get(driverNum)
      if (driver) rows.push({ position: pos, driver, pitStops: pitCount[driverNum] ?? 0 })
    })
    rows.sort((a, b) => a.position - b.position)
    return rows
  }, [data])

  // Gap/time/status enrichment per driver.
  const resultDetail: Map<number, SessionResult> | null = useMemo(() => {
    const rows = data?.detail ?? []
    return rows.length === 0 ? null : new Map(rows.map((r) => [r.driver_number, r]))
  }, [data])

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

      <DataStateNotice
        state={state}
        message={message}
        stale={stale}
        onRetry={refresh}
        emptyLabel={selectedKey ? 'NO POSITION DATA FOR THIS SESSION' : 'SELECT A SESSION'}
        className="mt-8"
      />

      {fetchingResults && results.length === 0 ? (
        <div className="mt-16 space-y-5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 w-[55%] animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : results.length === 0 ? null : (
        <>
          {/* ─── the winner, monumental ─── */}
          {winner && (
            <ClipReveal className="mt-14">
              <div className="border-t border-[var(--line)] pt-10">
                <p className="section-header flex items-center gap-2.5 text-[var(--accent)]">
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
