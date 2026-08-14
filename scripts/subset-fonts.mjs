// SUBSET GEIST to what this site actually draws.
//
// The variable files carry a 100-900 weight axis and the full upstream
// glyph set: 137.7 KB across sans and mono, on every route. A text-node
// walk over twelve routes found exactly ONE weight in use — 400, for both
// families — so the axis is dead payload, and most of the glyph set is
// too.
//
// Static Regular, subset to the measured repertoire, is 35.6 KB. The
// weight axis goes with it, which is the real cost: a future
// font-weight:600 on Geist would synthesise rather than render. That is a
// deliberate trade, not an oversight, and tests/font-subset.test.ts is
// what keeps the glyph half of it honest.
//
// Run: npm run subset-fonts
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import path from 'node:path'
import subsetFont from 'subset-font'
import * as fontkit from 'fontkit'
import { collectCharset, toChars } from './font-charset.mjs'

const SRC = 'node_modules/geist/dist/fonts'
const OUT = 'app/fonts'

const FACES = [
  { label: 'Geist Sans', src: `${SRC}/geist-sans/Geist-Regular.ttf`, out: 'Geist-Regular.subset.woff2' },
  { label: 'Geist Mono', src: `${SRC}/geist-mono/GeistMono-Regular.ttf`, out: 'GeistMono-Regular.subset.woff2' },
]

const { chars } = collectCharset()
const text = toChars([...chars].sort((a, b) => a - b))
console.log(`repertoire: ${chars.size} code points`)

mkdirSync(OUT, { recursive: true })

for (const face of FACES) {
  const source = readFileSync(face.src)
  const subset = await subsetFont(source, text, { targetFormat: 'woff2' })
  const dest = path.join(OUT, face.out)
  writeFileSync(dest, subset)

  // Read the EMITTED file back and report what actually survived. The
  // subsetter takes a request, not an instruction: a glyph the source
  // font never had cannot appear in the output, and the difference
  // between "asked for" and "got" is exactly what the guard checks.
  const f = fontkit.openSync(dest)
  const missing = [...chars].filter((cp) => !f.hasGlyphForCodePoint(cp))
  const before = source.length
  console.log(
    `  ${face.label.padEnd(10)} ${(before / 1024).toFixed(1)} KB ttf -> ${(subset.length / 1024).toFixed(1)} KB woff2` +
      `  (${f.numGlyphs} glyphs, ${missing.length} requested code points absent upstream)`
  )
}
