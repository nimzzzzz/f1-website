// EVERY SCROLLABLE CONTAINER INSIDE THE LENIS PAGE, both halves asserted.
//
// Lenis takes the wheel for the whole document. Two different failures
// follow from that, and this file exists because the first one shipped:
//
//   Lenis STOPPED (a panel or overlay locked page scroll): its handler
//   hits `if (isStopped || isLocked) preventDefault()` and swallows every
//   wheel event, including ones aimed at an unrelated container.
//
//   Lenis RUNNING with allowNestedScroll false (the default): it claims
//   the wheel and scrolls the page, so an inner list never moves.
//
// The remedy for both is data-lenis-prevent on the container, which Lenis
// checks BEFORE either branch.
//
// THE ASSERTION IS DELIBERATELY TWO-SIDED. The original verification
// measured only that the page did not scroll and concluded the lock
// worked; it never measured whether the container scrolled, and a locked
// page and a dead container are identical from that test. Every case here
// requires the container's scrollTop to CHANGE and the page's scroll
// position not to.
//
//   npm run build && npx next start -p 3100 && npm run verify:scroll
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'

let failures = 0
const check = (label, pass, detail) => {
  if (!pass) failures++
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

/**
 * Each case names the container and how to reveal it. `lockedPage` records
 * whether the page is expected to be locked while it is open — where it is
 * not, the page simply must not move because the container consumed the
 * gesture.
 */
const CASES = [
  {
    name: 'session picker panel',
    route: '/results',
    viewport: { width: 1440, height: 900 },
    selector: '[role="listbox"]',
    open: async (page) => {
      await page.locator('button[aria-haspopup="listbox"]').first().click()
      await page.waitForTimeout(600)
    },
  },
  {
    name: 'menu overlay nav (short viewport)',
    route: '/results',
    // The nav only overflows on a short window; at 1440x900 it fits and the
    // bug is invisible, which is why it survived.
    viewport: { width: 1280, height: 420 },
    selector: 'nav[data-lenis-prevent], nav.flex-1',
    open: async (page) => {
      await page.locator('button:has-text("MENU")').first().click()
      await page.waitForTimeout(1200)
    },
  },
  {
    name: 'laps list',
    route: '/laps',
    viewport: { width: 1440, height: 900 },
    selector: '[aria-label="All lap times"]',
    open: async () => {},
  },
]

const browser = await chromium.launch()

for (const c of CASES) {
  const ctx = await browser.newContext({ viewport: c.viewport })
  const page = await ctx.newPage()
  try {
    await page.goto(BASE + c.route, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForTimeout(3000)

    // Poll: these lists are client-fetched, and a fixed sleep is the
    // difference between a real result and a vacuous one.
    let ready = false
    for (let i = 0; i < 30; i++) {
      await c.open(page)
      ready = await page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return !!el && el.scrollHeight > el.clientHeight + 20
      }, c.selector)
      if (ready) break
      await page.waitForTimeout(1000)
    }
    if (!ready) {
      // Never report a pass on a container with nothing to scroll: "the
      // page did not move" is trivially true there and proves nothing.
      check(`${c.name}: container is scrollable`, false, 'never became scrollable — cannot test')
      await ctx.close()
      continue
    }

    const read = () =>
      page.evaluate(
        (sel) => {
          const el = document.querySelector(sel)
          return { el: el ? Math.round(el.scrollTop) : null, page: Math.round(window.scrollY) }
        },
        c.selector
      )

    // Aim at the part of the container that is ACTUALLY ON SCREEN. The
    // laps list is 60vh tall and starts well down the page, so a naive
    // box.y + height/2 lands below the fold — the wheel then goes to the
    // page and the container looks broken when it is not. Scroll it into
    // view, then target the intersection of the box and the viewport.
    await page.locator(c.selector).first().scrollIntoViewIfNeeded()
    await page.waitForTimeout(700)
    const vp = page.viewportSize()
    const box = await page.locator(c.selector).first().boundingBox()
    const top = Math.max(box.y, 0)
    const bottom = Math.min(box.y + box.height, vp.height)
    const aimY = (top + bottom) / 2
    const before = await read()
    await page.mouse.move(box.x + box.width / 2, aimY)
    for (let i = 0; i < 5; i++) {
      await page.mouse.wheel(0, 200)
      await page.waitForTimeout(120)
    }
    await page.waitForTimeout(700)
    const after = await read()

    check(`${c.name}: wheel scrolls the CONTAINER`, after.el !== before.el, `scrollTop ${before.el} -> ${after.el}`)
    check(`${c.name}: wheel does NOT scroll the page`, after.page === before.page, `scrollY ${before.page} -> ${after.page}`)
  } catch (err) {
    check(`${c.name}: ran`, false, err.message)
  }
  await ctx.close()
}

// ── sweep: any scrollable container this file does not cover ─────────
const SWEEP = ['/', '/drivers', '/drivers/ver', '/teams', '/teams/mclaren', '/schedule', '/standings',
  '/results', '/laps', '/positions', '/pit-stops', '/stints', '/weather', '/race-control', '/sports-cards']
const uncovered = []
for (const route of SWEEP) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 520 } })
  const page = await ctx.newPage()
  try {
    await page.goto(BASE + route, { waitUntil: 'load', timeout: 60_000 })
    await page.waitForTimeout(6000)
    const found = await page.evaluate(() =>
      [...document.querySelectorAll('*')]
        .filter((el) => {
          const cs = getComputedStyle(el)
          const scrollableY = ['auto', 'scroll', 'overlay'].includes(cs.overflowY) && el.scrollHeight > el.clientHeight + 20
          const scrollableX = ['auto', 'scroll', 'overlay'].includes(cs.overflowX) && el.scrollWidth > el.clientWidth + 20
          return scrollableY || scrollableX
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          label: el.getAttribute('aria-label') || el.getAttribute('role') || el.className.slice(0, 40),
          prevented: el.hasAttribute('data-lenis-prevent'),
          axis: el.scrollHeight > el.clientHeight + 20 ? 'y' : 'x',
        }))
    )
    for (const f of found) if (!f.prevented) uncovered.push({ route, ...f })
  } catch {
    /* a route that fails to load is reported by the cases above */
  }
  await ctx.close()
}

console.log('\n  sweep — scrollable containers WITHOUT data-lenis-prevent:')
if (uncovered.length === 0) {
  console.log('    none')
} else {
  for (const u of uncovered) {
    console.log(`    ${u.route.padEnd(16)} <${u.tag}> ${u.axis}-axis  ${u.label}`)
  }
  // Informational, not a failure. allowNestedScroll:true covers containers
  // that carry no attribute, and horizontal scrollers were never affected
  // (Lenis's gestureOrientation is vertical). What this list is for is
  // telling you where to add a CASE above, so the both-halves assertion
  // covers it explicitly rather than relying on the heuristic.
  console.log('    (informational — add a CASE above to assert one explicitly)')
}

await browser.close()
console.log(failures === 0 ? '\n  all nested-scroll checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
