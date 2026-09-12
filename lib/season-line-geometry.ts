/** Finish positions share a stable scale across the season, including P21/P22. */
export function seasonLineX(position: number | null, fieldSize: number, mobile: boolean, out = false): number {
  if (out || position === null) return mobile ? 40 : 94
  const fraction = (Math.max(1, Math.min(fieldSize, position)) - 1) / Math.max(1, fieldSize - 1)
  return mobile ? 6 + fraction * 30 : 6 + fraction * 82
}

export interface SeasonAnchor { x: number; y: number; out: boolean }
export const SEASON_LINE_GAP = 22

/** Monotonic curves; unclassified outcomes leave a visible break in the line. */
export function seasonLinePath(anchors: SeasonAnchor[]): string {
  let previous: { x: number; y: number } | null = null
  const commands: string[] = []
  anchors.forEach((anchor, index) => {
    const target = { x: anchor.x, y: anchor.y - (anchor.out ? SEASON_LINE_GAP : 0) }
    if (!previous) {
      commands.push(`M ${anchor.x} ${anchor.y - 84} L ${target.x} ${target.y}`)
    } else {
      if (anchors[index - 1].out) commands.push(`M ${previous.x} ${previous.y}`)
      const bend = (target.y - previous.y) * .45
      commands.push(`C ${previous.x} ${previous.y + bend} ${target.x} ${target.y - bend} ${target.x} ${target.y}`)
    }
    previous = { x: anchor.x, y: anchor.y + (anchor.out ? SEASON_LINE_GAP : 0) }
  })
  return commands.join(' ')
}

/** Invert sampled SVG y-at-length so the moving tip stays on the reading line. */
export function seasonArcAtY(samples: number[], y: number): number {
  const end = samples.length - 1
  if (end < 1 || y <= samples[0]) return 0
  if (y >= samples[end]) return 1
  let low = 0
  let high = end
  while (high - low > 1) {
    const middle = (low + high) >> 1
    if (samples[middle] <= y) low = middle
    else high = middle
  }
  const span = samples[high] - samples[low]
  return (low + (span > 0 ? (y - samples[low]) / span : 0)) / end
}
