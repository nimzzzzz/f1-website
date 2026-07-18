'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Weather } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedWeather } from '@/lib/client-cache'
import SessionHeader from '@/components/session/SessionHeader'
import { FadeUp } from '@/components/motion/reveals'
import { useApiBlocked } from '@/components/shell/useApiBlocked'

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

export default function WeatherPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selectedKey, setSelectedKey] = useState<number | null>(null)
  const [weatherData, setWeatherData] = useState<Weather[]>([])
  const [loading, setLoading] = useState(true)
  const [fetching, setFetching] = useState(false)
  const [error, setError] = useState<string | null>(null)
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
      const data = await getCachedWeather(sessionKey)
      setWeatherData(data.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()))
    } catch {
      setError('Failed to load weather data')
    } finally {
      setFetching(false)
    }
  }, [])

  useEffect(() => {
    if (selectedKey) fetchData(selectedKey)
  }, [selectedKey, fetchData])

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
      />

      {error && <p className="label-mono mt-8 text-[var(--accent)]">{error}</p>}

      {fetching ? (
        <div className="mt-16 flex flex-wrap gap-14">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 w-40 animate-pulse rounded bg-white/5" />
          ))}
        </div>
      ) : weatherData.length === 0 ? (
        !apiBlocked && (
          <p className="label-mono mt-16 text-[var(--text-dim)]">
            {selectedKey ? 'NO WEATHER DATA FOR THIS SESSION' : 'SELECT A SESSION'}
          </p>
        )
      ) : (
        <>
          {/* ─── current conditions, huge ─── */}
          {latest && (
            <div className="mt-16">
              <FadeUp>
                <p className="label-mono text-[var(--text-dim)]">
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
                    {latest.air_temperature.toFixed(1)}°
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">AIR</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(4rem, 9vw, 8rem)' }}
                  >
                    {latest.track_temperature.toFixed(1)}°
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">TRACK</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
                  >
                    {latest.humidity.toFixed(0)}%
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">HUMIDITY</p>
                </div>
                <div>
                  <p
                    className="font-mono tabular-nums leading-none text-[var(--text)]"
                    style={{ fontSize: 'clamp(2.2rem, 5vw, 4.2rem)' }}
                  >
                    {latest.wind_speed.toFixed(1)}
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">WIND M/S</p>
                </div>
              </div>
            </div>
          )}

          {/* ─── readings over the session ─── */}
          <div className="mt-20">
            <FadeUp>
              <p className="label-mono text-[var(--text-dim)]">
                OVER THE SESSION — {sampled.length} SAMPLES
              </p>
            </FadeUp>
            <div className="mt-6">
              {sampled.map((w, idx) => (
                <div
                  key={idx}
                  className="label-mono flex items-baseline gap-5 border-t border-[var(--line)] py-2.5 md:gap-8"
                >
                  <span className="w-20 shrink-0 tabular-nums text-[var(--text-dim)]">
                    {formatTime(w.date)}
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-[var(--text)]">
                    {w.air_temperature.toFixed(1)}°
                  </span>
                  <span className="w-16 shrink-0 text-right tabular-nums text-[var(--text)]">
                    {w.track_temperature.toFixed(1)}°
                  </span>
                  <span className="hidden w-16 shrink-0 text-right tabular-nums text-[var(--text-dim)] sm:block">
                    {w.humidity.toFixed(0)}%
                  </span>
                  <span className="hidden w-20 shrink-0 text-right tabular-nums text-[var(--text-dim)] sm:block">
                    {w.wind_speed.toFixed(1)} M/S
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
