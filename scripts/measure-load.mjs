// COLD-LOAD WEIGHT, measured in a real browser rather than inferred.
//
// A manifest says what the build produced; this says what a first-time
// visitor actually pulls down. Cache is disabled and a fresh context is
// used per route, so nothing is warm from the previous route — otherwise
// the second route measures as almost free and the number flatters us.
//
// Encoded bytes, not decoded: that is what crosses the wire. next start
// serves gzip, so these are comparable to what a CDN would send.
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'
const ROUTES = process.argv.slice(2).length ? process.argv.slice(2) : ['/', '/drivers', '/laps']

const kind = (url, type) => {
  // Data is not asset weight and must not be totalled with it: /laps pulls
  // a season of telemetry, which is the page doing its job, not bloat.
  if (/\/api\//.test(url)) return 'data'
  // Next's optimiser has no file extension in its URL; without this the
  // heaviest images on the site land in 'other' and the table lies.
  if (/\/_next\/image\?/.test(url)) return 'image'
  if (/_rsc=/.test(url)) return 'rsc'
  if (/\.(woff2?|ttf|otf)(\?|$)/.test(url)) return 'font'
  if (/\.(png|jpe?g|webp|avif|svg|gif)(\?|$)/.test(url)) return 'image'
  if (/\.(mp4|webm)(\?|$)/.test(url)) return 'video'
  if (/\.js(\?|$)/.test(url) || type === 'script') return 'js'
  if (/\.css(\?|$)/.test(url) || type === 'stylesheet') return 'css'
  if (type === 'document') return 'html'
  return 'other'
}

const browser = await chromium.launch()
const out = []

for (const route of ROUTES) {
  const ctx = await browser.newContext({ bypassCSP: false })
  const page = await ctx.newPage()
  await page.route('**', (r) => r.continue())

  const seen = new Map()
  const cspViolations = []
  page.on('console', (m) => {
    const t = m.text()
    if (/Content Security Policy|CSP/i.test(t)) cspViolations.push(t)
  })
  page.on('response', async (res) => {
    try {
      const url = res.url()
      if (seen.has(url)) return
      // ENCODED bytes, from the network layer. content-length is absent on
      // streamed responses, and falling back to body().length there mixes
      // decoded sizes into an encoded total — which made the home document
      // read 194 KB on one run and 24 KB on the next with no change behind
      // it. sizes() reports what actually crossed the wire either way.
      let size = 0
      try {
        size = (await res.request().sizes()).responseBodySize ?? 0
      } catch {
        size = 0
      }
      if (!size) {
        const hdrs = await res.allHeaders()
        size = Number(hdrs['content-length'] ?? 0)
      }
      seen.set(url, { size, kind: kind(url, res.request().resourceType()) })
    } catch {
      /* redirects and aborted requests have no body — skipped, not fatal */
    }
  })

  // NOT networkidle: this site polls openf1 on a timer, so the network is
  // never idle and the wait would only ever time out. 'load' plus a fixed
  // settle window counts the intro and gallery work that starts after load
  // without waiting on a quiet that will not come.
  await page.goto(`${BASE}${route}`, { waitUntil: 'load', timeout: 60_000 })
  // 8s, not 4: Syne now loads lazily where it is used, and a 4s window
  // caught some routes before it arrived — which read as a saving that was
  // really just an unfinished measurement.
  await page.waitForTimeout(8000)

  const totals = {}
  let total = 0
  for (const { size, kind: k } of seen.values()) {
    totals[k] = (totals[k] ?? 0) + size
    total += size
  }
  out.push({ route, total, totals, requests: seen.size, csp: cspViolations })

  await ctx.close()
}

await browser.close()

const kb = (n) => (n / 1024).toFixed(1).padStart(8)
const KINDS = ['html', 'js', 'css', 'font', 'image', 'video', 'rsc', 'data', 'other']
console.log('route'.padEnd(12), 'reqs', 'TOTAL KB'.padStart(9), 'ASSETS'.padStart(9), ...KINDS.map((k) => k.padStart(9)))
for (const r of out) {
  const assets = r.total - (r.totals.data ?? 0)
  console.log(
    r.route.padEnd(12),
    String(r.requests).padStart(4),
    kb(r.total),
    kb(assets),
    ...KINDS.map((k) => kb(r.totals[k] ?? 0))
  )
}
for (const r of out) if (r.csp.length) console.log(`CSP violations on ${r.route}:`, r.csp.length, r.csp[0])
console.log('\n(encoded bytes over the wire, cache disabled, fresh context per route)')
