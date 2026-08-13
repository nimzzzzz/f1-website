'use client'

import { useMemo } from 'react'
import type { Session, Weather } from '@/lib/openf1'
import { getCachedWeather } from '@/lib/client-cache'
import { useSessionData, useSessionList, sessionStripLabel } from '@/lib/use-session-data'
import { POLL_SLOW } from '@/lib/session-live'
import SessionHeader from '@/components/session/SessionHeader'
import DataStateNotice from '@/components/session/DataStateNotice'
import LiveBeat from '@/components/session/LiveBeat'
import { FadeUp } from '@/components/motion/reveals'

import { asNum } from '@/lib/format'

const fmt = (v: unknown, digits: number) => {
  const n = asNum(v)
  return n === null ? '—' : n.toFixed(digits)
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

const anySession = () => true
const latestCompleted = (sorted: Session[]) => sorted.find((s) => new Date(s.date_end) < new Date())

export default function WeatherClient() {
  const { sessions, selectedKey, setSelectedKey, loading } = useSessionList(
    anySession,
    latestCompleted
  )
  const selectedSession = sessions.find((s) => s.session_key === selectedKey) ?? null
  const { data, dataKey, state, live, liveFlowing, lastUpdateAt, message, stale, fetching, refresh } = useSessionData(selectedKey, {
    weather: getCachedWeather,
  }, {
    pollMs: { weather: POLL_SLOW },
    session: selectedSession,
  })
  // Rows kept through an outage may belong to a session the user has
  // already navigated away from — name it, so the heading above cannot
  // imply they are its own.
  const staleLabel =
    dataKey !== null && dataKey !== selectedKey
      ? sessionStripLabel(sessions.find((s) => s.session_key === dataKey))
      : null

  const weatherData: Weather[] = useMemo(
    () =>
      [...(data?.weather ?? [])].sort(
        (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
      ),
    [data]
  )

  // Latest reading
  const latest = weatherData[weatherData.length - 1] ?? null

  // Sample for the history list (~20 rows)
  const sampled = weatherData.filter((_, i) => {
    if (weatherData.length <= 20) return true
    const step = Math.floor(weatherData.length / 20)
    return i % step === 0
  })

  if (loading) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col justify-center px-6 md:px-14">
        <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
        <div className="mt-8 h-24 w-[55%] animate-pulse rounded bg-white/5" />
        {/* The skeleton is still a page and still needs its heading —
            without one a visitor landing mid-load has no h1 at all. */}
        <h1 data-loading-h1 className="sr-only">WEATHER</h1>
        <p className="label-mono mt-8 text-[var(--text-dim)]">LOADING SESSIONS…</p>
      </div>
    )
  }

  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <SessionHeader
        ghost="WX"
        kicker="WEATHER"
        sessions={sessions}
        selectedKey={selectedKey}
        onSelect={setSelectedKey}
        live={<LiveBeat live={live} flowing={liveFlowing} updatedAt={lastUpdateAt} message={message} />}
      />

      <DataStateNotice
        state={state}
        message={message}
        stale={stale}
        staleLabel={staleLabel}
        onRetry={refresh}
        emptyLabel={selectedKey ? 'NO WEATHER DATA FOR THIS SESSION' : 'SELECT A SESSION'}
        className="mt-8"
      />

      {fetching && weatherData.length === 0 ? (
        <div className="mt-16 flex flex-wrap gap-14">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 w-40 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : weatherData.length === 0 ? null : (
        <>
          {/* ─── current conditions, huge ─── */}
          {latest && (
            <div className="mt-16">
              <FadeUp>
                <p className="section-header text-[var(--text-dim)]">
                  FINAL READING — {formatTime(latest.date)}
                  {latest.rainfall ? <span className="ml-4 text-[#60A5FA]">RAIN</span> : null}
                </p>
              </FadeUp>
              <div className="mt-8 flex flex-wrap items-baseline gap-x-20 gap-y-10">
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(4rem, 9vw, 8rem)' }}
                  >
                    {fmt(latest.air_temperature, 1)}°
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">AIR</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(4rem, 9vw, 8rem)' }}
                  >
                    {fmt(latest.track_temperature, 1)}°
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">TRACK</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
                  >
                    {fmt(latest.humidity, 0)}%
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">HUMIDITY</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
                  >
                    {fmt(latest.wind_speed, 1)}
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">WIND M/S</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── readings over the session ─── */}
          <div className="mt-20">
            <FadeUp>
              <p className="section-header text-[var(--text-dim)]">
                OVER THE SESSION — {sampled.length} SAMPLES
              </p>
            </FadeUp>
            <div className="mt-6" role="list" aria-label="Weather readings over the session">
              {sampled.map((w, idx) => (
                <div
                  role="listitem"
                  key={idx}
                  className="label-mono flex items-baseline gap-5 border-t border-[var(--line)] py-2.5 md:gap-8"
                >
                  <span className="w-20 shrink-0 tabular-nums text-[var(--text-dim)]">
                    {formatTime(w.date)}
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-[var(--text)]">
                    {fmt(w.air_temperature, 1)}°
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-[var(--text)]">
                    {fmt(w.track_temperature, 1)}°
                  </span>
                  <span className="hidden w-16 shrink-0 text-right tabular-nums text-[var(--text-dim)] sm:block">
                    {fmt(w.humidity, 0)}%
                  </span>
                  <span className="hidden w-20 shrink-0 text-right tabular-nums text-[var(--text-dim)] sm:block">
                    {fmt(w.wind_speed, 1)} M/S
                  </span>
                  <span className="ml-auto shrink-0 text-right">
                    {w.rainfall ? (
                      <span style={{ color: '#60A5FA' }}>RAIN</span>
                    ) : (
                      <span className="text-[var(--text-dim)] opacity-50">—</span>
                    )}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
