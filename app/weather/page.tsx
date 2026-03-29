'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Session, Weather } from '@/lib/openf1'
import { getCachedSessions } from '@/lib/client-cache'
import { getCachedWeather } from '@/lib/client-cache'
import SessionPicker from '@/components/SessionPicker'
import EmptyState from '@/components/EmptyState'

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

  // Sample for table display (~20 rows)
  const sampled = weatherData.filter((_, i) => {
    if (weatherData.length <= 20) return true
    const step = Math.floor(weatherData.length / 20)
    return i % step === 0
  })

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
          Weather
        </h1>
      </div>

      {/* Session picker */}
      <div className="mb-8 max-w-sm">
        <SessionPicker
          sessions={sessions}
          selectedKey={selectedKey}
          onSelect={setSelectedKey}
          label="Select Session"
        />
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 bg-red-950/30 border border-red-800/40 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      {fetching ? (
        <div className="space-y-4 animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-24 bg-zinc-900/60 border border-zinc-800/50 rounded-xl" />
            ))}
          </div>
        </div>
      ) : weatherData.length === 0 ? (
        <EmptyState
          title="No weather data"
          message={selectedKey ? 'Weather data not recorded for this session.' : 'Select a session to view weather conditions.'}
        />
      ) : (
        <>
          {/* Latest reading cards */}
          {latest && (
            <div className="mb-8">
              <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
                Latest Reading — {formatTime(latest.date)}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {[
                  { label: 'Air Temp', value: `${latest.air_temperature.toFixed(1)}°C` },
                  { label: 'Track Temp', value: `${latest.track_temperature.toFixed(1)}°C` },
                  { label: 'Humidity', value: `${latest.humidity.toFixed(0)}%` },
                  { label: 'Wind Speed', value: `${latest.wind_speed.toFixed(1)} m/s` },
                  {
                    label: 'Rainfall',
                    value: latest.rainfall ? 'Yes' : 'No',
                    highlight: latest.rainfall,
                  },
                ].map(({ label, value, highlight }) => (
                  <div
                    key={label}
                    className={[
                      'border rounded-xl p-5',
                      highlight
                        ? 'border-blue-700/40 bg-blue-950/20'
                        : 'border-zinc-800/50 bg-zinc-900/40',
                    ].join(' ')}
                  >
                    <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600 mb-1.5">
                      {label}
                    </p>
                    <p
                      className={`text-2xl font-black tabular-nums ${highlight ? 'text-blue-400' : 'text-zinc-100'}`}
                    >
                      {value}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Weather table */}
          <div>
            <p className="text-[11px] font-bold text-zinc-500 tracking-[0.3em] uppercase mb-4">
              Readings Over Session ({sampled.length} samples)
            </p>
            <div className="border border-zinc-800/50 bg-zinc-900/40 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[600px]">
                  <thead>
                    <tr className="border-b border-zinc-800/40">
                      <th className="px-4 py-3 text-left text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Time
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Air
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Track
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Humidity
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Wind
                      </th>
                      <th className="px-4 py-3 text-right text-[11px] font-bold text-zinc-500 tracking-[0.2em] uppercase">
                        Rain
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40">
                    {sampled.map((w, idx) => (
                      <tr
                        key={idx}
                        className={[
                          'hover:bg-zinc-800/20 transition-colors',
                          w.rainfall ? 'bg-blue-950/10' : '',
                        ].join(' ')}
                      >
                        <td className="px-4 py-2.5 text-xs text-zinc-500 tabular-nums">
                          {formatTime(w.date)}
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300 text-right tabular-nums">
                          {w.air_temperature.toFixed(1)}°C
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-300 text-right tabular-nums">
                          {w.track_temperature.toFixed(1)}°C
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 text-right tabular-nums">
                          {w.humidity.toFixed(0)}%
                        </td>
                        <td className="px-4 py-2.5 text-xs text-zinc-400 text-right tabular-nums">
                          {w.wind_speed.toFixed(1)} m/s
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {w.rainfall ? (
                            <span className="text-blue-400 text-xs font-bold">Yes</span>
                          ) : (
                            <span className="text-zinc-700 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
