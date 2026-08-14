// EVERY CHARACTER THE SITE CAN RENDER, collected from the real sources.
//
// This is deliberately shared by the subsetter and by the test that
// guards it. If the two computed the repertoire separately they would
// drift, and the guard would end up certifying its own assumptions
// instead of the shipped font.
//
// The risk being guarded is not hypothetical. Subsetting Geist to a
// hand-picked "latin" range silently dropped four glyphs the UI actually
// draws — ← → ↗ ▾ — and nothing failed; the arrows simply rendered from a
// fallback face at a slightly different weight. A careful eye missed it
// twice. Next season brings driver and circuit names nobody has typed
// yet, and Hülkenberg, Pérez, São Paulo and Nürburgring are the shape of
// what arrives.
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/**
 * Committed snapshots of live upstream data. These are the files that
 * change when the grid or the calendar changes, which makes them the
 * files most likely to introduce a glyph nobody subsetted for.
 */
const DATA_SOURCES = [
  'lib/roster-fallback.ts', // driver number, first, surname, team; calendar
  'lib/team-data.ts', // team names, slugs, livery
  'lib/circuit-photos-manifest.ts', // circuit short names
  'lib/media-manifest.ts', // driver/car/circuit asset keys
]

/** Directories whose rendered copy is part of the repertoire. */
const UI_DIRS = ['app', 'components']

const CODE_EXT = new Set(['.ts', '.tsx'])

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (CODE_EXT.has(path.extname(e.name))) out.push(p)
  }
  return out
}

/**
 * Comments are stripped FIRST and on purpose.
 *
 * This file's own header contains ← → ↗ ▾, and so do several explanatory
 * comments elsewhere. Counting those would force the subset to carry
 * glyphs no user ever sees, and — worse — would make the guard pass or
 * fail on prose. Only text that can reach the screen counts.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

/**
 * Named HTML entities used in this codebase's JSX.
 *
 * Entities are decoded rather than skipped because `&rarr;` renders as →
 * while containing nothing but ASCII. A first version of this collector
 * missed every arrow on the site for exactly that reason, and reported a
 * clean repertoire while doing it. Unknown entities are surfaced by
 * unknownEntities() instead of being silently dropped.
 */
const ENTITIES = {
  rarr: '→', larr: '←', uarr: '↑', darr: '↓', nearr: '↗',
  deg: '°', middot: '·', hellip: '…', mdash: '—', ndash: '–',
  nbsp: ' ', times: '×', minus: '−', amp: '&', lt: '<',
  gt: '>', quot: '"', apos: "'", bull: '•', prime: '′', Prime: '″',
  // Curly quotes: the constructors' championship heading is written
  // &rsquo; and unknownEntities() is what surfaced it.
  rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c',
}

const decodeEntities = (s) =>
  s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-zA-Z][a-zA-Z0-9]*);/g, (m, name) => ENTITIES[name] ?? m)

/** Named entities in the tree that this collector cannot decode. */
export function unknownEntities({ root = process.cwd() } = {}) {
  const found = new Set()
  for (const dir of UI_DIRS) {
    for (const file of walk(path.join(root, dir))) {
      const code = stripComments(readFileSync(file, 'utf8'))
      for (const m of code.matchAll(/&([a-zA-Z][a-zA-Z0-9]*);/g)) {
        if (!(m[1] in ENTITIES)) found.add(m[1])
      }
    }
  }
  return [...found]
}

/**
 * String literals and JSX text — the two ways copy reaches a user.
 *
 * JSX text is matched ACROSS NEWLINES and through interpolations, because
 * the site writes both. `←` sits alone on its own line, and the weather
 * page renders `{fmt(t, 1)}°` — a degree sign whose only neighbour is an
 * expression. An earlier version required single-line, brace-free text
 * and therefore found neither.
 */
function renderableText(src) {
  const out = []
  const code = stripComments(src)
  for (const m of code.matchAll(/'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g)) {
    out.push(m[1] ?? m[2] ?? m[3] ?? '')
  }
  for (const m of code.matchAll(/>([^<>]+)</g)) {
    // Drop the expressions, keep the literal text either side of them.
    out.push(m[1].replace(/\{[^{}]*\}/g, ' '))
  }
  return decodeEntities(out.join('\n'))
}

/**
 * The repertoire, as a Set of code points.
 *
 * `margin` adds Latin-1 Supplement and Latin Extended-A/B wholesale
 * rather than only the accents currently on the grid. A subset that fits
 * exactly today's twenty-two names would fail the moment a driver with a
 * ł or a ş is signed — and it would fail in the deploy, not in the test.
 * The margin is ~6 KB and buys most of the Latin-script world.
 */
export function collectCharset({ margin = true, root = process.cwd() } = {}) {
  const chars = new Set()
  // Control characters are not glyphs. JSX text is matched across
  // newlines, so without this the repertoire contains U+000A and the
  // guard demands a glyph for a line break.
  const isGlyph = (cp) => cp >= 0x20 && cp !== 0x7f
  const add = (s) => {
    for (const ch of s) {
      const cp = ch.codePointAt(0)
      if (isGlyph(cp)) chars.add(cp)
    }
  }

  const provenance = []

  for (const rel of DATA_SOURCES) {
    const src = readFileSync(path.join(root, rel), 'utf8')
    const text = renderableText(src)
    add(text)
    provenance.push({ source: rel, kind: 'data' })
  }

  for (const dir of UI_DIRS) {
    for (const file of walk(path.join(root, dir))) {
      add(renderableText(readFileSync(file, 'utf8')))
    }
    provenance.push({ source: dir, kind: 'ui' })
  }

  // Printable ASCII always, regardless of what the scan happened to find.
  for (let cp = 0x20; cp <= 0x7e; cp++) chars.add(cp)

  if (margin) {
    for (let cp = 0x00a0; cp <= 0x00ff; cp++) chars.add(cp) // Latin-1 Supplement
    for (let cp = 0x0100; cp <= 0x017f; cp++) chars.add(cp) // Latin Extended-A
    for (let cp = 0x0180; cp <= 0x024f; cp++) chars.add(cp) // Latin Extended-B
  }

  return { chars, provenance }
}

/**
 * Glyphs the SHIPPED Geist fonts never had, so a fallback face already
 * draws them today. Excluded from the guard because subsetting cannot
 * regress what was never there — but the test also asserts they are
 * still absent upstream, so that if Geist adds one, this list is what
 * fails rather than the glyph quietly staying out of the subset.
 */
export const KNOWN_ABSENT_UPSTREAM = [0x25be] // ▾ BLACK DOWN-POINTING SMALL TRIANGLE

export const toChars = (cps) => [...cps].map((cp) => String.fromCodePoint(cp)).join('')
