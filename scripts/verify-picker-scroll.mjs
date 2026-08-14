// THE ASSERTION THE ORIGINAL VERIFICATION WAS MISSING.
//
// The earlier check measured that the PAGE did not scroll while the panel
// was open and concluded the scroll lock was working. It never measured
// whether the PANEL scrolled. A locked page and a dead panel are
// indistinguishable from that test, and the dead panel shipped.
//
// So every case here asserts BOTH halves: the panel's scrollTop must
// change AND window.scrollY must not. Either one alone passes for the
// wrong reason.
//
// Run against a local production build on 3100:
//   npm run build && npx next start -p 3100 && npm run verify:picker
import { chromium } from 'playwright'

const BASE = process.env.BASE ?? 'http://127.0.0.1:3100'
const ROUTE = '/results'

let failures = 0
const check = (label, pass, detail) => {
  if (!pass) failures++
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
}

const browser = await chromium.launch()

async function openPanel(page) {
  await page.goto(BASE + ROUTE, { waitUntil: 'load', timeout: 60_000 })
  // The round list is client-fetched, so POLL for it rather than sleeping
  // a fixed interval. A first version slept 8s, which was enough on a warm
  // server and not enough on a cold one — and the run then died in the
  // guard below rather than reporting anything useful.
  await page
    .locator('button[aria-haspopup="listbox"]')
    .first()
    .waitFor({ state: 'visible', timeout: 60_000 })
  for (let i = 0; i < 40; i++) {
    await page.locator('button[aria-haspopup="listbox"]').first().click()
    await page.waitForTimeout(500)
    const s = await page.evaluate(() => {
      const el = document.querySelector('[role="listbox"]')
      return { present: !!el, scrollable: el ? el.scrollHeight > el.clientHeight : false }
    })
    if (s.present && s.scrollable) return s
    // Close again and wait for more rounds to arrive.
    await page.keyboard.press('Escape')
    await page.waitForTimeout(500)
  }
  // Refusing to run beats reporting a pass on an empty list: a panel with
  // nothing to scroll would satisfy "the page did not scroll" and tell us
  // exactly nothing, which is the failure mode this whole file exists for.
  throw new Error('panel never became scrollable — refusing to report a vacuous pass')
}

const read = (page) =>
  page.evaluate(() => {
    const el = document.querySelector('[role="listbox"]')
    return { panel: el ? Math.round(el.scrollTop) : null, page: Math.round(window.scrollY) }
  })

// ── 1. mouse wheel ──────────────────────────────────────────────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await openPanel(page)
  const box = await page.locator('[role="listbox"]').boundingBox()
  const before = await read(page)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 5; i++) {
    await page.mouse.wheel(0, 200)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(600)
  const after = await read(page)
  check('wheel scrolls the PANEL', after.panel !== before.panel, `scrollTop ${before.panel} -> ${after.panel}`)
  check('wheel does NOT scroll the page', after.page === before.page, `scrollY ${before.page} -> ${after.page}`)
  await ctx.close()
}

// ── 2. trackpad: many small deltas rather than a few large ones ─────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await openPanel(page)
  const box = await page.locator('[role="listbox"]').boundingBox()
  const before = await read(page)
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 16)
    await page.waitForTimeout(24)
  }
  await page.waitForTimeout(600)
  const after = await read(page)
  check('trackpad-style deltas scroll the PANEL', after.panel !== before.panel, `scrollTop ${before.panel} -> ${after.panel}`)
  check('trackpad-style deltas do NOT scroll the page', after.page === before.page, `scrollY ${before.page} -> ${after.page}`)
  await ctx.close()
}

// ── 3. touch drag on the panel ──────────────────────────────────────
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  })
  const page = await ctx.newPage()
  const cdp = await ctx.newCDPSession(page)
  await openPanel(page)
  const box = await page.locator('[role="listbox"]').boundingBox()
  const before = await read(page)
  const x = box.x + box.width / 2
  const yFrom = box.y + box.height * 0.75
  const yTo = box.y + box.height * 0.2
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: yFrom }] })
  for (let i = 1; i <= 12; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: yFrom + ((yTo - yFrom) * i) / 12 }],
    })
    await page.waitForTimeout(16)
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.waitForTimeout(800)
  const after = await read(page)
  check('touch drag scrolls the PANEL', after.panel !== before.panel, `scrollTop ${before.panel} -> ${after.panel}`)
  check('touch drag does NOT scroll the page', after.page === before.page, `scrollY ${before.page} -> ${after.page}`)
  await ctx.close()
}

// ── 4. the page lock still holds for input aimed at the page ────────
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await openPanel(page)
  const before = await read(page)
  // Far right of the viewport: page, not panel.
  await page.mouse.move(1350, 700)
  for (let i = 0; i < 6; i++) {
    await page.mouse.wheel(0, 240)
    await page.waitForTimeout(120)
  }
  await page.waitForTimeout(600)
  const after = await read(page)
  check('wheel over the PAGE still does not scroll it', after.page === before.page, `scrollY ${before.page} -> ${after.page}`)
  await ctx.close()
}

// ── 5. keyboard still works, and re-anchor still ignores panel scroll ─
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  await openPanel(page)
  const gap = () =>
    page.evaluate(() => {
      const p = document.querySelector('[role="listbox"]')
      const t = document.querySelector('button[aria-haspopup="listbox"]')
      const pr = p?.getBoundingClientRect()
      const tr = t?.getBoundingClientRect()
      return pr && tr ? Math.round(pr.top - tr.bottom) : null
    })
  const g0 = await gap()
  const focusText = () => page.evaluate(() => (document.activeElement?.textContent || '').trim().slice(0, 24))
  const start = await focusText()
  await page.keyboard.press('End')
  await page.waitForTimeout(250)
  const atEnd = await focusText()
  await page.keyboard.press('Home')
  await page.waitForTimeout(250)
  const atHome = await focusText()
  const g1 = await gap()
  check('End moves focus to the last round', atEnd !== start, `${start} -> ${atEnd}`)
  check('Home moves focus to the first round', atHome !== atEnd, `${atEnd} -> ${atHome}`)
  check('panel stays anchored while its own list scrolls', g0 === g1, `gap ${g0} -> ${g1}`)
  await ctx.close()
}

await browser.close()
console.log(failures === 0 ? '\n  all picker scroll checks passed' : `\n  ${failures} FAILED`)
process.exit(failures === 0 ? 0 : 1)
