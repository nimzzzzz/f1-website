import type { SeasonStation } from './season-view'

export function resultLabel(station: SeasonStation): string {
  if (station.status === 'finished' && station.position !== null) return `P${station.position}`
  if (station.status === 'out') return station.outLabel ?? 'NC'
  return { absent: 'NO ENTRY', upcoming: 'UPCOMING', cancelled: 'CANCELLED', finished: 'NC' }[station.status]
}

/** The plot must accommodate actual fields and classified P21/P22 results. */
export function seasonFieldSize(stations: SeasonStation[]): number {
  return Math.max(2, ...stations.map((s) => Math.max(s.fieldSize, s.position ?? 0)))
}

/** Earliest best classified result; never present a retirement as a highlight. */
export function featuredSeasonStation(stations: SeasonStation[]): SeasonStation | null {
  return stations.reduce<SeasonStation | null>((best, s) =>
    s.status === 'finished' && s.position !== null && (best === null || s.position < best.position!)
      ? s : best, null)
}

export function latestEnteredStation(stations: SeasonStation[]): SeasonStation | null {
  return [...stations].reverse().find((s) => s.status === 'finished' || s.status === 'out')
    ?? stations.find((s) => s.status === 'upcoming') ?? stations[0] ?? null
}
