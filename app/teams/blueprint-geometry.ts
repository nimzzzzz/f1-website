// THE BLUEPRINT — geometry for the /teams constructor panels.
//
// Every callout anchor is expressed in CAR-NORMALISED coordinates (u,v in
// 0..1 across the car's own box), NEVER per-team pixels: all 11 renders come
// from the same F1 media template (side-on, facing right, 1280×282 — Haas is
// 1280×295 and letterboxes ~2% horizontally under object-contain), so one set
// of anchors lands on the same physical part of every car.
//
// Anchors are deliberately placed on BROAD features (the flank of the rear
// wing, the engine cover, the middle of a tyre, the front-wing endplate)
// rather than on tips or edges, so the ~2% variance between renders can't
// walk an anchor off the bodywork.

export interface Anchor {
  /** 0..1 across the car's width — 0 is the rear wing, 1 the front wing. */
  u: number
  /** 0..1 down the car's height. */
  v: number
}

export interface CalloutGeom {
  key: string
  anchor: Anchor
  /** Where the leader line breaks from its diagonal into the landing run. */
  elbow: { x: number; y: number }
  /** The far end of the landing run — the label sits just above it. */
  end: { x: number; y: number }
  side: 'left' | 'right'
}

export interface StageGeom {
  /** SVG user-space size; the stage box carries exactly this aspect ratio. */
  w: number
  h: number
  /** The car's box within the stage, in the same user space. */
  car: { x: number; y: number; w: number; h: number }
  callouts: CalloutGeom[]
}

// Car-relative anchor points, shared by both stage variants.
const REAR_WING: Anchor = { u: 0.06, v: 0.2 }
const ENGINE_COVER: Anchor = { u: 0.43, v: 0.13 }
const REAR_TYRE: Anchor = { u: 0.145, v: 0.63 }
// Inboard of the front-wing tip rather than on it: Haas's render is 1280×295
// against everyone else's 1280×282, so it letterboxes ~2% under object-contain
// and an anchor at the extreme nose sat off its wing's trailing edge.
const FRONT_WING: Anchor = { u: 0.928, v: 0.72 }

// ── desktop ──────────────────────────────────────────────────────────────
// A 1600×600 stage. The car spans 78% of the width so the outer 11% each
// side is clear margin for the labels; the two top leaders land on one
// shared horizontal (y=100) and the two bottom leaders on another (y=505),
// which is what makes the set read as one drawing rather than four stickers.
export const DESKTOP: StageGeom = {
  w: 1600,
  h: 600,
  car: { x: 176, y: 170, w: 1248, h: 275 },
  callouts: [
    {
      key: 'position',
      anchor: REAR_WING,
      elbow: { x: 158, y: 100 },
      end: { x: 40, y: 100 },
      side: 'left',
    },
    {
      key: 'points',
      anchor: ENGINE_COVER,
      elbow: { x: 838, y: 100 },
      end: { x: 1560, y: 100 },
      side: 'right',
    },
    {
      key: 'best',
      anchor: REAR_TYRE,
      elbow: { x: 258, y: 505 },
      end: { x: 40, y: 505 },
      side: 'left',
    },
    {
      key: 'gap',
      anchor: FRONT_WING,
      elbow: { x: 1454, y: 505 },
      end: { x: 1560, y: 505 },
      side: 'right',
    },
  ],
}

// ── mobile ───────────────────────────────────────────────────────────────
// A 900×800 stage. Only TWO callouts survive — four would collide on a
// phone — and position and wins move to the mono row under the team name,
// so no data is lost, only crowding.
//
// The car goes near-full-bleed here (a 4.5:1 render on a 390px screen needs
// every pixel of width), which means there is NO clear column beside it the
// way there is on desktop: a label can only avoid the car by sitting well
// above or below it. Hence the tall stage and the wide gaps between the car
// band (y 300–490) and the two landing runs at y=210 and y=690 — roughly
// 40px of clearance each, enough for a caption + value at phone type sizes.
export const MOBILE: StageGeom = {
  w: 900,
  h: 800,
  car: { x: 18, y: 300, w: 864, h: 190 },
  callouts: [
    {
      key: 'points',
      anchor: ENGINE_COVER,
      elbow: { x: 470, y: 210 },
      end: { x: 860, y: 210 },
      side: 'right',
    },
    {
      key: 'gap',
      anchor: REAR_TYRE,
      elbow: { x: 78, y: 690 },
      end: { x: 40, y: 690 },
      side: 'left',
    },
  ],
}

/** Absolute stage-space point for a car-normalised anchor. */
export function anchorPoint(g: StageGeom, a: Anchor) {
  return { x: g.car.x + a.u * g.car.w, y: g.car.y + a.v * g.car.h }
}

/** The leader path: anchor → elbow → landing run end. */
export function leaderPath(g: StageGeom, c: CalloutGeom) {
  const a = anchorPoint(g, c.anchor)
  return `M ${a.x} ${a.y} L ${c.elbow.x} ${c.elbow.y} L ${c.end.x} ${c.end.y}`
}

/** CSS percentages positioning a label block above its landing run. */
export function labelStyle(g: StageGeom, c: CalloutGeom) {
  const bottom = ((g.h - (c.end.y - 14)) / g.h) * 100
  return c.side === 'left'
    ? { left: `${(c.end.x / g.w) * 100}%`, bottom: `${bottom}%`, textAlign: 'left' as const }
    : {
        right: `${((g.w - c.end.x) / g.w) * 100}%`,
        bottom: `${bottom}%`,
        textAlign: 'right' as const,
      }
}
