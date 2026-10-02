import type { Weather } from './openf1'
import { finite } from './session-experience'

export type WeatherReading = { date: string; time: number; air: number | null; track: number | null; humidity: number | null; pressure: number | null; wind: number | null; direction: number | null; rain: boolean | null }
const between = (v: unknown, min: number, max = Infinity) => { const n = finite(v); return n !== null && n >= min && n <= max ? n : null }
export function weatherReadings(raw: Weather[], session: number): WeatherReading[] {
  const unique = new Map<number, WeatherReading>()
  for (const w of raw) {
    const time = Date.parse(w.date)
    if (w.session_key !== session || !Number.isFinite(time)) continue
    const previous = unique.get(time)
    const rain: unknown = w.rainfall
    const bearing = between(w.wind_direction, 0, 360)
    unique.set(time, { time, date: new Date(time).toISOString(),
      air: finite(w.air_temperature) ?? previous?.air ?? null, track: finite(w.track_temperature) ?? previous?.track ?? null,
      humidity: between(w.humidity,0,100) ?? previous?.humidity ?? null,
      pressure: between(w.pressure,1) ?? previous?.pressure ?? null,
      wind: between(w.wind_speed,0) ?? previous?.wind ?? null,
      direction: bearing !== null ? bearing % 360 : previous?.direction ?? null,
      rain: rain === true || rain === 1 ? true : rain === false || rain === 0 ? false : previous?.rain ?? null,
    })
  }
  return [...unique.values()].sort((a,b) => a.time-b.time)
}
export const weatherValue = (n: number | null, digits = 1) => n === null ? 'N/A' : n.toFixed(digits)
export function compassPoint(degrees: number | null) {
  return degrees === null ? 'N/A' : ['N','NE','E','SE','S','SW','W','NW'][Math.round(degrees/45)%8]
}
export function weatherBounds(rows: WeatherReading[]) {
  const values = rows.flatMap(r => [r.air,r.track]).filter((v):v is number => v !== null)
  return { min: values.length ? Math.floor(Math.min(...values)-3) : 0, max: values.length ? Math.ceil(Math.max(...values)+3) : 1 }
}
export function weatherPath(rows: WeatherReading[], field: 'air' | 'track', min: number, max: number) {
  const from = rows[0]?.time ?? 0, span = Math.max(1,(rows.at(-1)?.time ?? from)-from)
  let path = '', connected = false, last = 0
  for (const row of rows) {
    const value = row[field]
    if (value === null) { connected = false; continue }
    const x = 50+(row.time-from)/span*800, y = 225-(value-min)/Math.max(1,max-min)*200
    path += `${connected && row.time-last <= 180000 ? 'L' : 'M'}${x.toFixed(2)},${y.toFixed(2)} `
    connected = true; last = row.time
  }
  return path.trim()
}
export function nearestWeather(rows: WeatherReading[], ratio: number) {
  if (!rows.length) return 0
  const target = rows[0].time + Math.max(0,Math.min(1,ratio))*(rows.at(-1)!.time-rows[0].time)
  return rows.reduce((best,r,i) => Math.abs(r.time-target)<Math.abs(rows[best].time-target) ? i : best,0)
}
export function weatherRange(rows: WeatherReading[], field: 'air'|'track'|'wind'|'humidity') {
  const values = rows.map(r=>r[field]).filter((n): n is number => n !== null)
  return values.length ? { min: Math.min(...values), max:Math.max(...values) } : null
}
