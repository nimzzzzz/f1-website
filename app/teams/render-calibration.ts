// Per-team calibration of the unveiling, measured from the car render itself.
//
// The problem this solves is two INDEPENDENT ones, and it is worth being
// precise about which team has which, because the obvious guess is wrong:
//
//   1. Dark liveries have little to reveal. A brightness ramp that ends at
//      1.0 barely moves a car that is nearly black to begin with. Measured
//      mean luminance across the 2026 grid runs 0.060 (Red Bull) to 0.208
//      (Racing Bulls) — Red Bull, Mercedes and Aston Martin are the DARK
//      ones. Haas, which looks like a problem panel, is the second
//      BRIGHTEST render on the grid.
//
//   2. Near-neutral team colours give a grey wash instead of an identity.
//      That is Haas (#9C9FA2, saturation 0.04) and Cadillac (#909090,
//      saturation 0.00) — and nobody else; every other team sits at 0.58+.
//
// So darkness drives the brightness ramp, and colour neutrality drives a
// hue bias — separately. Both are computed from the asset and the colour,
// never hand-tuned per team, so a livery change is picked up automatically
// with no regeneration step: the render is measured in the browser off the
// image the panel has already decoded for display.

export interface RenderStats {
  /** Alpha-weighted mean relative luminance of the car, 0..1. */
  meanL: number
  /** How much saturated colour the render actually carries. ~0 = neutral. */
  chromaMass: number
  /** Saturation-weighted mean hue in degrees, or null if the render is neutral. */
  accentHue: number | null
}

export interface Calibration {
  /** Filter the car starts from — sunk into the black. */
  dark: string
  /** Top of the ramp. Above `lit` for dark liveries; equal to it otherwise. */
  peak: string
  /** Filter the car settles at. */
  lit: string
  /** Whether `peak` is a real overshoot worth a second tween segment. */
  overshoot: boolean
  /** Seconds for the emergence — longer for darker liveries. */
  duration: number
  /** Peak opacity of the rising light. */
  lightPeak: number
  /** What the LIGHT reads as. Biased only when the team colour is near-grey. */
  lightColour: string
}

// Gradient templates live here so the SSR'd markup (true team colour) and the
// runtime rewrite (calibrated colour) cannot drift apart.
export const lightGradient = (c: string) =>
  `linear-gradient(to top, ${c} 0%, ${c}59 24%, transparent 60%)`
export const glowGradient = (c: string) =>
  `radial-gradient(72% 48% at 50% 76%, ${c}, transparent 72%)`

// The car's grade lives in ONE place: the [data-car] wrapper. The <img>
// inside carries no filter of its own. Two rules follow from that, and both
// were learned by breaking them:
//
//   • Exactly one element may grade the car. When the wrapper animated to the
//     same absolute grade the <img> already carried, every settled car was
//     silently double-treated — saturate 0.86² = 0.74, contrast 1.05² = 1.10.
//
//   • The settled grade must never be the IDENTITY filter. Expressing the
//     wrapper's grade as a relative layer made a bright livery settle on
//     `saturate(1) contrast(1) brightness(1)`, which GSAP will not interpolate
//     toward: Haas held at brightness 0.07 for its entire 0.98s rise and then
//     snapped to lit on the final frame. Keeping the site's base treatment in
//     every value guarantees a non-identity target for every team.
//
// Function lists match across all three so GSAP can tween between them.
const BASE = 'saturate(0.86) contrast(1.05)'
export const CAR_DARK = 'saturate(0.2) contrast(1.5) brightness(0.06)'
/** The settled grade for an unmeasurable render — the plain site treatment. */
export const CAR_LIT = `${BASE} brightness(1)`

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)

// Minimal numeric form — 1, not "1.000". This is not cosmetic: a filter
// ending in `brightness(1.000)` does not interpolate (GSAP swaps it
// discretely at the end of the tween instead), so a livery whose settled
// brightness lands exactly on 1 held its dark grade for the whole rise and
// snapped lit on the final frame. `brightness(1)` tweens correctly.
const n = (v: number) => String(+v.toFixed(3))
const toLinear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
}

// ── measurement ──────────────────────────────────────────────────────────
// One 64px-wide draw + read per unique render (11 on this page), memoised by
// src. Everything below alpha 0.35 is background, not car, and is skipped —
// otherwise the transparent surround would drag every mean toward zero.
//
// Measured at ~6ms for the first call on a render — dominated by the canvas
// readback, not the arithmetic. That is a third of a frame, so it must NOT
// sit on the critical path: warmRender() below is called from the observer
// during idle time, well before the panel's reveal needs the answer, and one
// canvas is reused across all eleven rather than allocated per call.
const cache = new Map<string, RenderStats | null>()
let scratch: HTMLCanvasElement | null = null

export function measureRender(img: HTMLImageElement): RenderStats | null {
  const key = img.currentSrc || img.src
  const hit = cache.get(key)
  if (hit !== undefined) return hit

  let stats: RenderStats | null = null
  try {
    const W = 64
    const H = Math.max(1, Math.round((W * img.naturalHeight) / img.naturalWidth))
    if (!scratch) scratch = document.createElement('canvas')
    const canvas = scratch
    canvas.width = W
    canvas.height = H
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (ctx) {
      ctx.drawImage(img, 0, 0, W, H)
      // Throws on a cross-origin render; the catch below degrades to neutral.
      const d = ctx.getImageData(0, 0, W, H).data
      let alphaSum = 0
      let lumaSum = 0
      let hueX = 0
      let hueY = 0
      let chroma = 0
      for (let i = 0; i < d.length; i += 4) {
        const a = d[i + 3] / 255
        if (a < 0.35) continue
        const r = d[i]
        const g = d[i + 1]
        const b = d[i + 2]
        alphaSum += a
        lumaSum += (0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)) * a

        const mx = Math.max(r, g, b)
        const mn = Math.min(r, g, b)
        const sat = mx === 0 ? 0 : (mx - mn) / mx
        if (sat <= 0.06) continue
        let h: number
        if (mx === r) h = 60 * ((((g - b) / (mx - mn)) % 6 + 6) % 6)
        else if (mx === g) h = 60 * ((b - r) / (mx - mn) + 2)
        else h = 60 * ((r - g) / (mx - mn) + 4)
        // Weight by saturation² and brightness so the livery's real accent
        // dominates and near-grey pixels contribute almost nothing. Summed
        // as vectors because hue is circular — a plain mean of 350° and 10°
        // would land on 180°, the opposite colour.
        const w = sat * sat * a * (mx / 255)
        hueX += Math.cos((h * Math.PI) / 180) * w
        hueY += Math.sin((h * Math.PI) / 180) * w
        chroma += w
      }
      if (alphaSum > 0) {
        stats = {
          meanL: lumaSum / alphaSum,
          chromaMass: chroma / alphaSum,
          accentHue:
            chroma > 0 ? ((Math.atan2(hueY, hueX) * 180) / Math.PI + 360) % 360 : null,
        }
      }
    }
  } catch {
    stats = null
  }
  cache.set(key, stats)
  return stats
}

/**
 * Populate the cache for a render during idle time, so the reveal that needs
 * it a moment later gets a free cache hit instead of a ~6ms readback right as
 * its timeline starts. Safe to call repeatedly; a no-op once cached.
 */
export function warmRender(img: HTMLImageElement | null) {
  if (!img || !img.complete || img.naturalWidth === 0) return
  if (cache.has(img.currentSrc || img.src)) return
  const run = () => measureRender(img)
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => void })
    .requestIdleCallback
  // The reveal's dwell is 130ms, so the timeout keeps the warm-up ahead of it
  // even on a busy main thread; the reveal's own call is the backstop.
  if (ric) ric(run, { timeout: 90 })
  else window.setTimeout(run, 0)
}

// ── colour ───────────────────────────────────────────────────────────────
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const v = hex.replace('#', '')
  const r = parseInt(v.slice(0, 2), 16) / 255
  const g = parseInt(v.slice(2, 4), 16) / 255
  const b = parseInt(v.slice(4, 6), 16) / 255
  const mx = Math.max(r, g, b)
  const mn = Math.min(r, g, b)
  const l = (mx + mn) / 2
  const d = mx - mn
  if (d === 0) return { h: 0, s: 0, l }
  const s = d / (1 - Math.abs(2 * l - 1))
  let h: number
  if (mx === r) h = 60 * ((((g - b) / d) % 6 + 6) % 6)
  else if (mx === g) h = 60 * ((b - r) / d + 2)
  else h = 60 * ((r - g) / d + 4)
  return { h, s, l }
}

function hslToHex(h: number, s: number, l: number): string {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  const seg = Math.floor((((h % 360) + 360) % 360) / 60)
  const [r, g, b] = (
    [
      [c, x, 0],
      [x, c, 0],
      [0, c, x],
      [0, x, c],
      [x, 0, c],
      [c, 0, x],
    ] as const
  )[seg]
  const hx = (n: number) =>
    Math.round((n + m) * 255)
      .toString(16)
      .padStart(2, '0')
  return `#${hx(r)}${hx(g)}${hx(b)}`
}

// A team colour below this saturation reads as grey once it is a dim wash.
const NEUTRAL_SAT = 0.22
// How saturated a biased light is allowed to get. Deliberately low: Haas's
// render accent is red, and a strong red wash would read as the site's
// reserved #E10600. At this ceiling it lands on a dusty warm steel — a
// lighting gel, not a brand colour.
const BIAS_SAT = 0.34
// Below this the render carries no usable accent (Cadillac measures ~0), so
// its hue is noise. Fall back to a cool studio key rather than a warm one,
// which would drift toward the reserved red from the other side.
const CHROMA_FLOOR = 0.008
const STUDIO_HUE = 210

// Luminance below which a livery counts as fully "dark", and the span over
// which the response ramps. Set from the measured grid: 0.16 is above every
// dark car and below Haas (0.181) and Racing Bulls (0.208), so the two
// brightest renders get no extra brightness at all.
const DARK_FLOOR = 0.05
const DARK_CEIL = 0.16

export function calibrate(stats: RenderStats | null, teamColour: string): Calibration {
  const darkness = stats
    ? clamp01((DARK_CEIL - stats.meanL) / (DARK_CEIL - DARK_FLOOR))
    : 0

  const settledB = 1 + 0.16 * darkness
  const peakB = 1 + 0.45 * darkness
  const overshoot = darkness > 0.12

  const { s, l } = hexToHsl(teamColour)
  let lightColour = teamColour
  if (s < NEUTRAL_SAT) {
    const strength = (NEUTRAL_SAT - s) / NEUTRAL_SAT
    const hue =
      stats && stats.accentHue !== null && stats.chromaMass >= CHROMA_FLOOR
        ? stats.accentHue
        : STUDIO_HUE
    lightColour = hslToHex(hue, s + strength * (BIAS_SAT - s), l)
  }

  return {
    dark: CAR_DARK,
    // A touch of extra saturation at the top of the ramp so the overshoot
    // reads as the livery catching the light, not just a brightness knob.
    peak: `saturate(${n(0.86 + 0.1 * darkness)}) contrast(1.05) brightness(${n(peakB)})`,
    lit: `${BASE} brightness(${n(settledB)})`,
    overshoot,
    duration: 0.98 + 0.26 * darkness,
    lightPeak: 0.5 + 0.14 * darkness,
    lightColour,
  }
}
