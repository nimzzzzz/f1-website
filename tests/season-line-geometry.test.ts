import { describe, expect, it } from 'vitest'
import { seasonArcAtY, seasonLinePath, seasonLineX } from '../lib/season-line-geometry'

describe('scroll-drawn driver season line', () => {
  it('keeps P21/P22 distinct and reserves space beyond the field for unclassified results', () => {
    for (const mobile of [true, false]) {
      const positions = Array.from({ length: 22 }, (_, index) => seasonLineX(index + 1, 22, mobile))
      expect(positions.every((x, index) => index === 0 || x > positions[index - 1])).toBe(true)
      expect(seasonLineX(null, 22, mobile, true)).toBeGreaterThan(positions[21])
      expect(positions.every((x) => x >= 0 && x < (mobile ? 50 : 100))).toBe(true)
    }
  })
  it('draws a lead-in for one entry, and no invented line for an empty season', () => {
    expect(seasonLinePath([])).toBe('')
    expect(seasonLinePath([{ x: 30, y: 150, out: false }])).toBe('M 30 66 L 30 150')
    expect(seasonLinePath([{ x: 30, y: 150, out: true }])).toBe('M 30 66 L 30 128')
  })
  it('breaks before and after an unclassified station, including the first one', () => {
    const path = seasonLinePath([{ x: 10, y: 150, out: false }, { x: 90, y: 450, out: true }, { x: 20, y: 750, out: false }])
    expect(path).toContain('90 428 M 90 472 C')
    expect(path).not.toContain('90 450')
    const firstOut = seasonLinePath([{ x: 90, y: 150, out: true }, { x: 10, y: 450, out: false }])
    expect(firstOut).toContain('L 90 128 M 90 172 C')
    expect(path.endsWith('20 750')).toBe(true)
  })
  it('maps the reading height to arc length, rather than letting wide curves lag behind', () => {
    // A long lateral turn covers less vertical distance per equal arc sample.
    expect(seasonArcAtY([0, 100, 120, 140, 240], 130)).toBe(.625)
    expect(seasonArcAtY([0, 100, 120, 140, 240], 190)).toBe(.875)
    expect(seasonArcAtY([0, 100, 100, 200], 100)).toBeCloseTo(2 / 3)
    expect(seasonArcAtY([50, 100], -1)).toBe(0)
    expect(seasonArcAtY([50, 100], 200)).toBe(1)
    expect(seasonArcAtY([], 100)).toBe(0)
  })
})
