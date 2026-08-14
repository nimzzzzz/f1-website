// TIME TO FIRST FRAME for the intro, under throttling, plus whether the
// 2500ms watchdog fires.
//
// The intro video is home's LCP element and it sits in front of the page,
// so "how fast does the first frame appear" is the whole question — and
// the watchdog makes it binary as well as continuous: miss 2500ms and the
// intro is not late, it is GONE, replaced by a cut to the page.
//
// first frame is taken from requestVideoFrameCallback, which fires on an
// actually-composited frame. 'playing' fires when the element believes it
// has started, which is earlier and is not what a viewer sees. Both are
// reported so a difference between them is visible rather than hidden.
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'
const RUNS = Number(process.env.RUNS ?? 3)
const LABEL = process.argv[2] ?? 'build'

// Chrome DevTools' own presets, so these are comparable to what anyone
// else would measure with the same names.
const PROFILES = {
  // wait is generous on slow-3G on purpose: a first pass used 14s, and the
  // page had not finished hydrating inside it, so every field came back
  // null and the watchdog looked "quiet" when it had simply never run. An
  // unfinished load is not a result.
  'slow-3G': { download: (400 * 1024) / 8, upload: (400 * 1024) / 8, latency: 2000, cpu: 4, wait: 60_000 },
  'fast-3G': { download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, latency: 562.5, cpu: 4, wait: 20_000 },
}

const probe = `
  window.__intro = { firstFrame: null, playing: null, loadedData: null, watchdog: null, cut: null }
  const t0 = performance.now()
  // Hydration lands when the Skip control becomes interactive; the
  // watchdog timer starts from that mount, not from navigation.
  //
  // Polled, not observed: this script runs at document-start, where
  // documentElement can still be null — observing it there throws, and the
  // throw took the whole probe with it, which is why an earlier pass
  // reported nothing at all on every profile.
  const hydWatch = () => {
    if (document.querySelector('button')) {
      window.__intro.hydrated ??= performance.now() - t0
      return
    }
    requestAnimationFrame(hydWatch)
  }
  hydWatch()
  const watch = () => {
    const v = document.querySelector('video')
    if (!v) return requestAnimationFrame(watch)
    v.addEventListener('loadeddata', () => { window.__intro.loadedData ??= performance.now() - t0 })
    v.addEventListener('playing',    () => { window.__intro.playing    ??= performance.now() - t0 })
    if (v.requestVideoFrameCallback) {
      v.requestVideoFrameCallback(() => { window.__intro.firstFrame ??= performance.now() - t0 })
    }
    // The watchdog cuts the overlay while the video has never advanced.
    // Catching its EFFECT rather than its timer means this stays true even
    // if the timeout constant changes.
    const cutWatch = () => {
      if (!document.contains(v)) {
        if (window.__intro.playing === null) window.__intro.watchdog ??= performance.now() - t0
        return
      }
      requestAnimationFrame(cutWatch)
    }
    cutWatch()
  }
  watch()
`

const browser = await chromium.launch()
const results = {}

for (const [name, p] of Object.entries(PROFILES)) {
  results[name] = []
  for (let i = 0; i < RUNS; i++) {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    const cdp = await ctx.newCDPSession(page)
    await cdp.send('Network.enable')
    await cdp.send('Network.emulateNetworkConditions', {
      offline: false,
      downloadThroughput: p.download,
      uploadThroughput: p.upload,
      latency: p.latency,
    })
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: p.cpu })
    await page.addInitScript(probe)

    await page.goto(BASE + '/', { waitUntil: 'commit', timeout: 120_000 })
    await page.waitForTimeout(p.wait)
    const r = await page.evaluate(() => ({
      ...window.__intro,
      // Without these, a null firstFrame is ambiguous: it could mean the
      // video never started, or that the run ended before the page was
      // even interactive.
      hydrated: window.__intro.hydrated,
      videoInDom: !!document.querySelector('video'),
      readyState: document.querySelector('video')?.readyState ?? null,
      currentTime: document.querySelector('video')?.currentTime ?? null,
      overlayGone: !document.querySelector('video'),
    }))
    results[name].push(r)
    await ctx.close()
  }
}

await browser.close()

const fmt = (v) => (v == null ? '   —  ' : String(Math.round(v)).padStart(5) + 'ms')
const med = (xs) => {
  const v = xs.filter((x) => x != null).sort((a, b) => a - b)
  return v.length ? v[Math.floor(v.length / 2)] : null
}

console.log(`\n=== ${LABEL} — ${RUNS} runs per profile, CPU 4x throttled ===`)
console.log('profile    run  hydrated  loadeddata  playing  firstFrame  watchdog / end-state')
for (const [name, rs] of Object.entries(results)) {
  rs.forEach((r, i) =>
    console.log(
      `  ${name.padEnd(9)} ${i + 1}  ${fmt(r.hydrated)}  ${fmt(r.loadedData)}   ${fmt(r.playing)}   ${fmt(
        r.firstFrame
      )}   ${
        r.watchdog != null
          ? 'FIRED ' + Math.round(r.watchdog) + 'ms'
          : r.playing != null
            ? 'quiet'
            : `no-start (video ${r.videoInDom ? 'in DOM, readyState ' + r.readyState : 'gone'})`
      }`
    )
  )
  console.log(
    `  ${name.padEnd(9)} MED ${fmt(med(rs.map((r) => r.hydrated)))}  ${fmt(
      med(rs.map((r) => r.loadedData))
    )}   ${fmt(med(rs.map((r) => r.playing)))}   ${fmt(med(rs.map((r) => r.firstFrame)))}   ${
      rs.filter((r) => r.watchdog != null).length
    }/${rs.length} fired`
  )
}
