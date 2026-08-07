// FIA countback tie-breaking.
//
// The sporting regulations break a points tie by comparing the NUMBER OF
// EACH FINISHING POSITION in turn: most wins, then most seconds, then most
// thirds, and so on down the order until the tie breaks. The old sort did
// `points, then wins` and stopped — two drivers level on points and wins
// were then ordered by Map insertion, which is fetch order, i.e. arbitrary.
//
// `finishes` is the list of classified GP finishing positions for the
// entity. Sprint results deliberately do NOT feed countback: the tie-break
// is defined over grand prix classifications.

/** Counts of each finishing position, index 0 = P1. */
export function positionCounts(finishes: number[], depth = 30): number[] {
  const counts = new Array(depth).fill(0)
  for (const p of finishes) {
    if (Number.isFinite(p) && p >= 1 && p <= depth) counts[p - 1]++
  }
  return counts
}

/**
 * Comparator: better entity first. Points, then countback position by
 * position. Returns 0 only when the two are genuinely indistinguishable on
 * every counted position — callers should then fall back to something
 * stable and explicit rather than leaving order to chance.
 */
export function compareByCountback(
  a: { points: number; finishes: number[] },
  b: { points: number; finishes: number[] }
): number {
  if (b.points !== a.points) return b.points - a.points
  const ca = positionCounts(a.finishes)
  const cb = positionCounts(b.finishes)
  for (let i = 0; i < ca.length; i++) {
    if (cb[i] !== ca[i]) return cb[i] - ca[i]
  }
  return 0
}

/**
 * Sort with a deterministic final tiebreak so equal entities never depend
 * on upstream fetch order. `id` should be stable (driver number, team name).
 */
export function sortByCountback<T extends { points: number; finishes: number[] }>(
  rows: T[],
  id: (row: T) => number | string
): T[] {
  return [...rows].sort((a, b) => {
    const c = compareByCountback(a, b)
    if (c !== 0) return c
    const ia = id(a)
    const ib = id(b)
    return typeof ia === 'number' && typeof ib === 'number'
      ? ia - ib
      : String(ia).localeCompare(String(ib))
  })
}
