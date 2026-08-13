// Per-route initial JS, raw and gzip, read from the PRERENDERED HTML rather
// than a manifest — the manifest describes the build graph, the HTML
// describes what a cold browser actually asks for, and those differ.
//
// Turbopack stopped printing First Load JS in the route table, so this
// stands in for it. Same numbers, one source of truth: every
// /_next/static/chunks/*.js the document references, deduped, sized on
// disk, and gzipped at the level a CDN would use.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import path from 'node:path'

const APP = '.next/server/app'
const STATIC = '.next/static'

function walk(dir, out = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

const htmlFiles = walk(APP).filter((f) => f.endsWith('.html'))

const gzCache = new Map()
function sizes(rel) {
  if (gzCache.has(rel)) return gzCache.get(rel)
  const file = path.join(STATIC, rel.replace('/_next/static/', ''))
  let v = { raw: 0, gz: 0 }
  try {
    const buf = readFileSync(file)
    v = { raw: statSync(file).size, gz: gzipSync(buf, { level: 6 }).length }
  } catch {
    /* referenced but absent — reported as 0 rather than crashing the run */
  }
  gzCache.set(rel, v)
  return v
}

const rows = []
for (const f of htmlFiles) {
  const html = readFileSync(f, 'utf8')
  const refs = [...new Set(html.match(/\/_next\/static\/chunks\/[^"']+?\.js/g) ?? [])]
  let raw = 0
  let gz = 0
  for (const r of refs) {
    const s = sizes(r)
    raw += s.raw
    gz += s.gz
  }
  const route = '/' + f.slice(APP.length + 1).replace(/\.html$/, '').replace(/^index$/, '')
  rows.push({ route: route === '/' ? '/' : route, chunks: refs.length, raw, gz, refs })
}

rows.sort((a, b) => b.gz - a.gz)

const kb = (n) => (n / 1024).toFixed(1).padStart(7)
console.log('route'.padEnd(34), 'chunks', 'raw KB'.padStart(8), 'gzip KB'.padStart(9))
for (const r of rows) {
  console.log(r.route.padEnd(34), String(r.chunks).padStart(6), kb(r.raw), kb(r.gz))
}

// The shared floor: chunks every route loads. This is what a lightweight
// route pays purely for existing inside the global shell.
const all = rows.map((r) => new Set(r.refs))
const shared = [...all[0]].filter((c) => all.every((s) => s.has(c)))
const sRaw = shared.reduce((n, c) => n + sizes(c).raw, 0)
const sGz = shared.reduce((n, c) => n + sizes(c).gz, 0)
console.log(`\nshared by ALL ${rows.length} routes: ${shared.length} chunks, ${kb(sRaw)} KB raw, ${kb(sGz)} KB gzip`)
console.log('largest shared chunks:')
shared
  .map((c) => ({ c, ...sizes(c) }))
  .sort((a, b) => b.gz - a.gz)
  .slice(0, 10)
  .forEach((x) => console.log('  ', kb(x.raw), 'raw', kb(x.gz), 'gzip ', x.c.replace('/_next/static/chunks/', '')))
