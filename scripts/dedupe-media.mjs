// DEDUPE public/media, without breaking a single lookup.
//
// The asset fetchers write one FILE per name they have ever seen a team or
// circuit called: openf1 says "Scuderia Ferrari" one weekend and "Ferrari"
// the next, so the manifests carry both keys — and the fetchers helpfully
// downloaded the same bytes under both names. 48 files, 2.7 MB, identical
// to something already on disk.
//
// The KEYS are the contract and all of them stay: dropping "scuderia-
// ferrari" would blank a car the first time upstream used the long name.
// Only the duplicate FILES go, with every alias key repointed at one
// canonical path. Same lookups, same results, one copy on disk.
//
// Re-runnable, and it must be re-run after scripts/fetch-media.ts, which
// will happily write the duplicates back.
import { readFileSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { createHash } from 'node:crypto'
import path from 'node:path'

const ROOT = 'public'
const MANIFESTS = ['lib/media-manifest.ts', 'lib/circuit-photos-manifest.ts']
const DRY = process.argv.includes('--dry')

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const byHash = new Map()
for (const f of walk(ROOT)) {
  const h = createHash('md5').update(readFileSync(f)).digest('hex')
  if (!byHash.has(h)) byHash.set(h, [])
  byHash.get(h).push(f)
}

/**
 * The keeper. A meeting-keyed file is a pointer by nature (meeting-1289 is
 * this year's Silverstone and next year's is a different number), so a
 * named file always wins; otherwise the shortest name, which is the plain
 * team slug rather than its sponsor-laden variant.
 */
function canonical(paths) {
  const named = paths.filter((p) => !/\/meeting-\d+\./.test(p))
  const pool = named.length ? named : paths
  return [...pool].sort((a, b) => path.basename(a).length - path.basename(b).length || a.localeCompare(b))[0]
}

const rewrites = new Map()
let freed = 0
let removed = 0

for (const paths of byHash.values()) {
  if (paths.length < 2) continue
  const keep = canonical(paths)
  for (const p of paths) {
    if (p === keep) continue
    rewrites.set('/' + path.relative(ROOT, p), '/' + path.relative(ROOT, keep))
    freed += statSync(p).size
    removed++
  }
}

// Repoint every alias key BEFORE deleting anything, so a crash mid-run
// leaves the tree still working rather than half-broken.
let edits = 0
for (const m of MANIFESTS) {
  let src
  try {
    src = readFileSync(m, 'utf8')
  } catch {
    continue
  }
  const before = src
  for (const [from, to] of rewrites) src = src.split(`"${from}"`).join(`"${to}"`)
  if (src !== before) {
    if (!DRY) writeFileSync(m, src)
    edits++
  }
}

// A file is only safe to delete once nothing points at it.
const manifestText = MANIFESTS.map((m) => {
  try {
    return readFileSync(m, 'utf8')
  } catch {
    return ''
  }
}).join('\n')

let skipped = 0
for (const [from] of rewrites) {
  if (manifestText.includes(`"${from}"`)) {
    console.log(`  still referenced, kept: ${from}`)
    skipped++
    continue
  }
  if (!DRY) unlinkSync(path.join(ROOT, from))
}

console.log(
  `${DRY ? '[dry] ' : ''}${removed - skipped} duplicate files removed, ` +
    `${(freed / 1024 / 1024).toFixed(2)} MB freed, ${edits} manifest(s) repointed`
)
