import { describe, it, expect } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import * as fontkit from 'fontkit'
// Plain-JS collector, shared with scripts/subset-fonts.mjs so the
// subsetter and this guard can never disagree about the repertoire.
import { collectCharset, unknownEntities, KNOWN_ABSENT_UPSTREAM } from '../scripts/font-charset.mjs'

// THE SUBSET GUARD.
//
// Geist Sans and Mono ship subset and static: 137.7 KB of variable font
// on every route became 48.1 KB. The saving is real and the failure mode
// is silent — a missing glyph does not throw, it renders from whatever
// fallback face the OS picks, at a slightly different weight and width.
// Nobody notices until someone looks closely at an arrow.
//
// That is not hypothetical. The first subset of these fonts dropped ← → ↗
// and I did not catch it by reading; I caught it by extracting the
// characters the site actually renders and diffing them against the file.
// This test is that diff, run every time.
//
// It reads the SHIPPED .woff2 rather than a manifest of what was
// requested. A subsetter is given a wish list, not an instruction: any
// code point the source font lacks is silently skipped, so "we asked for
// it" is not evidence it is there.
//
// When this fails, the fix is almost always `npm run subset-fonts` —
// a new driver, circuit or piece of copy has arrived carrying a glyph the
// committed files predate.

const FACES = [
  { label: 'Geist Sans', path: 'app/fonts/Geist-Regular.subset.woff2' },
  { label: 'Geist Mono', path: 'app/fonts/GeistMono-Regular.subset.woff2' },
]

const UPSTREAM = [
  { label: 'Geist Sans', path: 'node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf' },
  { label: 'Geist Mono', path: 'node_modules/geist/dist/fonts/geist-mono/GeistMono-Regular.ttf' },
]

/**
 * Open a single font face.
 *
 * fontkit returns Font | FontCollection, and a collection here would mean
 * a .ttc slipped into the pipeline — in which case hasGlyphForCodePoint
 * would not exist and every assertion below would be meaningless. Failing
 * loudly beats casting the distinction away.
 */
function openFont(path: string): fontkit.Font {
  const f = fontkit.openSync(path)
  if ('fonts' in f) throw new Error(`${path} is a font collection, expected a single face`)
  return f
}

const show = (cp: number) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} ${String.fromCodePoint(cp)}`

/** Everything the site can draw, excluding what upstream never had. */
const required = (() => {
  const { chars } = collectCharset({ margin: false })
  return [...(chars as Set<number>)].filter((cp) => !KNOWN_ABSENT_UPSTREAM.includes(cp)).sort((a, b) => a - b)
})()

describe('the subset covers everything the site renders', () => {
  for (const face of FACES) {
    it(`${face.label} has a glyph for every rendered character`, () => {
      expect(existsSync(face.path), `${face.path} missing — run npm run subset-fonts`).toBe(true)
      const font = openFont(face.path)
      const missing = required.filter((cp) => !font.hasGlyphForCodePoint(cp))
      expect(
        missing.map(show),
        `${face.label} is missing glyphs the site renders. Run: npm run subset-fonts`
      ).toEqual([])
    })
  }

  // The names that motivated the guard. Spelled out rather than folded
  // into the sweep above so a failure names the case instead of a code
  // point: these are the shape of what next season brings.
  const NAMES = ['Hülkenberg', 'Pérez', 'São Paulo', 'Nürburgring', 'Räikkönen', 'Magnussen', 'Pérez-Sainz']
  for (const face of FACES) {
    it(`${face.label} can set accented driver and circuit names`, () => {
      const font = openFont(face.path)
      const missing = [...new Set(NAMES.join('').replace(/\s/g, ''))].filter(
        (ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)!)
      )
      expect(missing, `${face.label} cannot set: ${missing.join(' ')}`).toEqual([])
    })
  }

  for (const face of FACES) {
    it(`${face.label} has the UI arrows and symbols`, () => {
      const font = openFont(face.path)
      // ← → ↗ were dropped by the first subset and nothing complained.
      const missing = [...'←→↗°·—–…−’'].filter((ch) => !font.hasGlyphForCodePoint(ch.codePointAt(0)!))
      expect(missing, `${face.label} is missing UI symbols: ${missing.join(' ')}`).toEqual([])
    })
  }
})

describe('the collector cannot quietly under-report', () => {
  it('decodes every named entity in the tree', () => {
    // &rarr; renders an arrow while containing only ASCII. An entity this
    // collector cannot decode is a character it cannot see, which is a
    // guard that passes for the wrong reason.
    expect(unknownEntities(), 'unknown HTML entities — add them to ENTITIES in scripts/font-charset.mjs').toEqual([])
  })

  it('sees the non-ASCII the site actually draws', () => {
    // A regression in the collector itself would empty the repertoire and
    // make every assertion above vacuous. These are characters confirmed
    // rendered in Geist in a real browser.
    for (const ch of '°·—…←→↗−') {
      expect(required, `collector lost ${show(ch.codePointAt(0)!)}`).toContain(ch.codePointAt(0))
    }
  })
})

describe('glyphs that already fall back', () => {
  for (const face of UPSTREAM) {
    it(`${face.label}: excluded glyphs are genuinely absent upstream, not dropped by subsetting`, () => {
      const font = openFont(face.path)
      // ▾ is not in the shipped Geist fonts and never was, so it already
      // renders from a fallback face today and subsetting cannot regress
      // it. If Geist ever adds it, this fails — which is the point: the
      // exclusion list must not outlive its reason.
      const present = (KNOWN_ABSENT_UPSTREAM as number[]).filter((cp) => font.hasGlyphForCodePoint(cp))
      expect(
        present.map(show),
        `now present upstream — remove from KNOWN_ABSENT_UPSTREAM and re-run npm run subset-fonts`
      ).toEqual([])
    })
  }
})

describe('the subset stays a saving', () => {
  it('is far smaller than the variable fonts it replaced', () => {
    const total = FACES.reduce((n, f) => n + statSync(f.path).size, 0)
    // The variable pair was 137.7 KB. A regeneration that lands anywhere
    // near that means the repertoire has blown up — most likely a
    // collector change sweeping in comments or whole Unicode blocks.
    expect(total).toBeLessThan(70 * 1024)
  })
})
