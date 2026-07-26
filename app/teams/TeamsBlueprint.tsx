'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import { toBlueprintTeams, type BlueprintTeam } from '@/lib/season-view'
import { teamToSlug } from '@/lib/team-data'
import { carImage, teamLogoImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import {
  DESKTOP,
  MOBILE,
  anchorPoint,
  labelStyle,
  leaderPath,
  type StageGeom,
} from './blueprint-geometry'
import {
  CAR_DARK,
  CAR_LIT,
  calibrate,
  glowGradient,
  lightGradient,
  measureRender,
  warmRender,
} from './render-calibration'

gsap.registerPlugin(useGSAP)

// THE BLUEPRINT — one full-viewport panel per constructor, championship
// order, vertical (the horizontal grammar belongs to /drivers).
//
// Each panel plays a launch-night unveiling: a team-colour light rises from
// below and the car emerges out of the black with it (brightness + opacity +
// a short upward drift), a floor rule draws under it, and once the car has
// landed the hairline leader lines DRAW themselves from anchor points on the
// bodywork out to mono data labels, staggered, like a technical drawing
// assembling. Numbers count up as each label lands.
//
// Identity (name, colour, standings) is SSR'd by app/teams/page.tsx straight
// from the server bundle — this component owns only the interaction layer.
export type { BlueprintTeam }

const pad2 = (n: number) => String(n).padStart(2, '0')

// 1ST / 2ND / 3RD / 4TH… — deliberately NOT the "P04" grammar the
// championship callout uses, so two positional numbers on one panel can't be
// mistaken for each other.
const ordinal = (n: number) => {
  const v = n % 100
  const suffix = v >= 11 && v <= 13 ? 'TH' : (['TH', 'ST', 'ND', 'RD'][n % 10] ?? 'TH')
  return `${n}${suffix}`
}

const LIGHT_REST = 0.16
const GLOW_REST = 0.13
const RULE_REST = 0.5
const STAGGER = 0.08

interface Callout {
  key: string
  caption: string
  /** Static text when the value isn't a number to count (P01, LEADER). */
  text?: string
  /** Count target — rendered final for no-JS / reduced motion. */
  count?: number
  prefix?: string
}

function callouts(team: BlueprintTeam): Record<string, Callout> {
  return {
    position: { key: 'position', caption: 'CHAMPIONSHIP', text: `P${pad2(team.position)}` },
    points: { key: 'points', caption: 'POINTS', count: team.points },
    // Replaced RACE WINS, which printed 0 on nine of eleven panels — the
    // bottom-left number was a zero across most of the grid. Best finish is
    // non-zero for every team and actually separates the midfield.
    best: {
      key: 'best',
      caption: 'BEST FINISH',
      text: team.bestFinish === null ? '—' : ordinal(team.bestFinish),
    },
    gap:
      team.gapAhead === null
        ? { key: 'gap', caption: 'STATUS', text: 'LEADER' }
        : {
            key: 'gap',
            caption: `GAP TO P${pad2(team.position - 1)}`,
            count: team.gapAhead,
            prefix: '-',
          },
  }
}

// One stage variant's drawing layer: the leader lines (SVG, in the team
// colour) and their labels (HTML, so the mono type renders as type). Both
// variants are always in the DOM — CSS picks one — because the two need
// different stage aspect ratios, and a phone can't carry four callouts.
function Drawing({
  geom,
  team,
  variant,
  strokeWidth,
  className,
}: {
  geom: StageGeom
  team: BlueprintTeam
  variant: 'desktop' | 'mobile'
  strokeWidth: number
  className: string
}) {
  const data = callouts(team)
  return (
    <div data-drawing data-variant={variant} className={`pointer-events-none absolute inset-0 ${className}`}>
      <svg
        viewBox={`0 0 ${geom.w} ${geom.h}`}
        className="absolute inset-0 h-full w-full"
        aria-hidden
        focusable="false"
      >
        {geom.callouts.map((c) => {
          const a = anchorPoint(geom, c.anchor)
          return (
            <g key={c.key} data-callout={c.key}>
              <circle
                data-dot
                cx={a.x}
                cy={a.y}
                r={strokeWidth * 3.2}
                fill="none"
                stroke={team.colour}
                strokeWidth={strokeWidth * 1.3}
                opacity={0.85}
              />
              {/* pathLength=1 normalises the dash pattern, so the draw-on is a
                  plain 1 → 0 stroke-dashoffset tween with no getTotalLength().
                  The dash pattern is a static attribute and the SSR'd offset
                  is 0 — i.e. fully drawn — so no-JS and reduced motion get the
                  finished drawing without anything having to run. */}
              <path
                data-leader
                d={leaderPath(geom, c)}
                fill="none"
                stroke={team.colour}
                strokeWidth={strokeWidth}
                strokeLinejoin="miter"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={0}
                opacity={0.62}
              />
            </g>
          )
        })}
      </svg>

      {geom.callouts.map((c) => {
        const d = data[c.key]
        if (!d) return null
        const final = d.text ?? `${d.prefix ?? ''}${d.count ?? 0}`
        return (
          <div
            key={c.key}
            data-label={c.key}
            className="absolute whitespace-nowrap"
            style={labelStyle(geom, c)}
          >
            <span className="label-mono block text-[var(--text-dim)]">{d.caption}</span>
            <span
              data-value
              data-to={d.count ?? ''}
              data-prefix={d.prefix ?? ''}
              className="mt-2 block font-mono tabular-nums leading-none text-[var(--text)]"
              style={{
                fontSize:
                  variant === 'mobile' ? 'clamp(1rem, 4.4vw, 1.3rem)' : 'clamp(1.1rem, 1.6vw, 1.6rem)',
              }}
            >
              {final}
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function TeamsBlueprint({
  teams: ssrTeams,
  seasonYear,
  computedAt,
}: {
  teams: BlueprintTeam[]
  seasonYear: number | null
  computedAt: string | null
}) {
  const rootRef = useRef<HTMLDivElement>(null)

  // Converge on the freshest snapshot after hydration. The SSR'd standings
  // are the floor — useLiveSnapshot only ever yields something strictly
  // newer, so a failed or blocked fetch leaves this page exactly as the
  // server rendered it. Team count is stable across a refresh, so the
  // reveal's useGSAP (keyed on teams.length) does not re-run; only the
  // numbers and the ordering update.
  const live = useLiveSnapshot(computedAt)
  const teams = live ? toBlueprintTeams(live) : ssrTeams

  useGSAP(
    () => {
      const root = rootRef.current
      if (!root || teams.length === 0) return

      const panels = gsap.utils.toArray<HTMLElement>('[data-panel]', root)
      const parts = (p: HTMLElement) => ({
        glow: p.querySelector<HTMLElement>('[data-glow]'),
        light: p.querySelector<HTMLElement>('[data-light]'),
        rule: p.querySelector<HTMLElement>('[data-rule]'),
        car: p.querySelector<HTMLElement>('[data-car]'),
        img: p.querySelector<HTMLImageElement>('[data-car-img]'),
        numeral: p.querySelector<HTMLElement>('[data-numeral]'),
        title: p.querySelector<HTMLElement>('[data-title]'),
        drawings: gsap.utils.toArray<HTMLElement>('[data-drawing]', p),
      })

      // Compose a drawing into its finished state: lines fully drawn, dots
      // and labels present, numbers final. This is BOTH the reduced-motion
      // look and what the never-animated variant (the one CSS is hiding)
      // holds, so crossing the breakpoint mid-session can't reveal a
      // half-drawn panel.
      const composeDrawing = (d: HTMLElement) => {
        gsap.set(d.querySelectorAll('[data-leader]'), { strokeDashoffset: 0 })
        gsap.set(d.querySelectorAll('[data-dot]'), { scale: 1, autoAlpha: 1 })
        gsap.set(d.querySelectorAll('[data-label]'), { autoAlpha: 1, x: 0 })
        d.querySelectorAll<HTMLElement>('[data-value]').forEach((v) => {
          const to = v.dataset.to
          if (to) v.textContent = `${v.dataset.prefix ?? ''}${to}`
        })
      }

      // Composed (scrolled past un-watched) must LOOK the same as unveiled, so
      // it takes the same calibrated settled grade and light colour whenever
      // the render is decoded enough to measure — otherwise a skipped dark
      // livery would sit dimmer than the identical panel that got its reveal.
      const compose = (p: HTMLElement) => {
        const { glow, light, rule, car, img, numeral, title, drawings } = parts(p)
        const cal =
          img && img.complete && img.naturalWidth > 0
            ? calibrate(measureRender(img), p.dataset.teamColour || '#F5F5F3')
            : null
        if (cal && cal.lightColour !== p.dataset.teamColour) {
          if (light) light.style.background = lightGradient(cal.lightColour)
          if (glow) glow.style.background = glowGradient(cal.lightColour)
        }
        if (glow) gsap.set(glow, { opacity: GLOW_REST })
        if (light) gsap.set(light, { opacity: LIGHT_REST, yPercent: 0 })
        if (rule) gsap.set(rule, { scaleX: 1, opacity: RULE_REST })
        if (car) gsap.set(car, { autoAlpha: 1, y: 0, filter: cal?.lit ?? CAR_LIT })
        if (numeral) gsap.set(numeral, { autoAlpha: 1, scale: 1 })
        if (title) gsap.set(title, { autoAlpha: 1, y: 0 })
        drawings.forEach(composeDrawing)
      }

      // ── reduced motion: the SSR'd markup IS the settled state. Nothing to
      //    set, nothing to observe, no animation anywhere on the page.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const isReady = (img: HTMLImageElement | null) =>
        !!img && img.complete && img.naturalWidth > 0

      const activeVariant = () =>
        window.matchMedia('(min-width: 768px)').matches ? 'desktop' : 'mobile'

      const countUp = (v: HTMLElement, tl: gsap.core.Timeline, at: number) => {
        const to = Number(v.dataset.to)
        if (!v.dataset.to || Number.isNaN(to)) return
        const prefix = v.dataset.prefix ?? ''
        const state = { n: 0 }
        tl.fromTo(
          state,
          { n: 0 },
          {
            n: to,
            duration: 0.9,
            ease: 'power2.out',
            onUpdate: () => {
              v.textContent = `${prefix}${Math.round(state.n)}`
            },
          },
          at
        )
      }

      const timelines = new Map<HTMLElement, gsap.core.Timeline>()

      // THE UNVEILING. Light first, car out of the black with it, then the
      // drawing assembles on top of a car that has already landed.
      const reveal = (p: HTMLElement) => {
        const { glow, light, rule, car, img, numeral, title, drawings } = parts(p)
        if (!car) return
        // Never unveil an undecoded car — the light would rise onto nothing.
        // Play it the moment the bytes land instead.
        if (!isReady(img)) {
          if (img) img.addEventListener('load', () => reveal(p), { once: true })
          return
        }

        // Calibrate against THIS render. Measured off the image the browser
        // has already decoded above, memoised per src, and degrading to a
        // neutral calibration if the read fails — so a livery change is
        // picked up on its own with no table to regenerate.
        const cal = calibrate(measureRender(img!), p.dataset.teamColour || '#F5F5F3')
        // A biased light only differs for near-grey team colours (Haas,
        // Cadillac); everyone else keeps the SSR'd gradients untouched.
        if (cal.lightColour !== p.dataset.teamColour) {
          if (light) light.style.background = lightGradient(cal.lightColour)
          if (glow) glow.style.background = glowGradient(cal.lightColour)
        }

        const variant = activeVariant()
        const live = drawings.find((d) => d.dataset.variant === variant)
        // the variant CSS is hiding never animates — it sits composed
        drawings.forEach((d) => d !== live && composeDrawing(d))

        const tl = gsap.timeline({
          onComplete: () => gsap.set([car, light].filter(Boolean), { clearProps: 'willChange' }),
        })
        timelines.set(p, tl)

        tl.set([car, light].filter(Boolean) as HTMLElement[], { willChange: 'transform, filter, opacity' })

        // 1 — the light rises from below
        if (light) {
          tl.fromTo(
            light,
            { autoAlpha: 0, yPercent: 46 },
            { autoAlpha: cal.lightPeak, yPercent: 0, duration: 0.9, ease: 'power2.out' },
            0
          ).to(light, { autoAlpha: LIGHT_REST, duration: 0.8, ease: 'power2.inOut' }, 0.92)
        }

        // 2 — the car emerges out of the darkness with it. A dark livery
        // ramps PAST its settled brightness and eases back — the overshoot is
        // what gives a near-black car something to reveal; a bright one has
        // enough of its own and goes straight to lit (overshoot === false).
        const CAR_IN = 0.06
        const rise = cal.duration * (cal.overshoot ? 0.7 : 1)
        tl.fromTo(
          car,
          { autoAlpha: 0, y: 26, filter: cal.dark },
          {
            autoAlpha: 1,
            y: 0,
            filter: cal.overshoot ? cal.peak : cal.lit,
            duration: rise,
            ease: 'power3.out',
          },
          CAR_IN
        )
        if (cal.overshoot) {
          tl.to(
            car,
            { filter: cal.lit, duration: cal.duration * 0.6, ease: 'power2.inOut' },
            CAR_IN + rise
          )
        }
        if (rule) {
          tl.fromTo(
            rule,
            { scaleX: 0, autoAlpha: 0 },
            { scaleX: 1, autoAlpha: RULE_REST, duration: 0.85, ease: 'power3.out' },
            0.14
          )
        }
        if (numeral) {
          tl.fromTo(
            numeral,
            { autoAlpha: 0, scale: 1.05 },
            { autoAlpha: 1, scale: 1, duration: 1.2, ease: 'power3.out' },
            0
          )
        }
        if (title) {
          tl.fromTo(title, { autoAlpha: 0, y: 22 }, { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' }, 0)
        }
        if (glow) {
          tl.fromTo(glow, { autoAlpha: 0 }, { autoAlpha: GLOW_REST, duration: 0.9, ease: 'power2.out' }, 0.55)
        }

        // 3 — the drawing assembles: dot, leader line, label, number. Starts
        // when the car has LANDED (end of the rise) rather than at a fixed
        // clock, so a dark livery's longer ramp pushes the drawing back with
        // it instead of drawing onto a car still emerging.
        if (live) {
          const START = CAR_IN + rise + 0.05
          live.querySelectorAll<HTMLElement>('[data-callout]').forEach((g, k) => {
            const at = START + k * STAGGER
            const dot = g.querySelector('[data-dot]')
            const leader = g.querySelector('[data-leader]')
            const key = g.dataset.callout
            const label = live.querySelector<HTMLElement>(`[data-label="${key}"]`)
            if (dot) {
              tl.fromTo(
                dot,
                { scale: 0, autoAlpha: 0, transformOrigin: '50% 50%' },
                { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2.4)' },
                at
              )
            }
            if (leader) {
              tl.fromTo(
                leader,
                { strokeDashoffset: 1 },
                { strokeDashoffset: 0, duration: 0.52, ease: 'power2.inOut' },
                at + 0.05
              )
            }
            if (label) {
              const dir = label.style.textAlign === 'right' ? 12 : -12
              tl.fromTo(
                label,
                { autoAlpha: 0, x: dir },
                { autoAlpha: 1, x: 0, duration: 0.42, ease: 'power2.out' },
                at + 0.44
              )
              const v = label.querySelector<HTMLElement>('[data-value]')
              if (v) countUp(v, tl, at + 0.44)
            }
          })
        }
      }

      // ── initial state: every panel dark, every drawing undrawn ───────────
      panels.forEach((p) => {
        const { glow, light, rule, car, numeral, title, drawings } = parts(p)
        if (glow) gsap.set(glow, { autoAlpha: 0 })
        if (light) gsap.set(light, { autoAlpha: 0 })
        if (rule) gsap.set(rule, { scaleX: 0, autoAlpha: 0 })
        if (car) gsap.set(car, { autoAlpha: 0, filter: CAR_DARK })
        if (numeral) gsap.set(numeral, { autoAlpha: 0 })
        if (title) gsap.set(title, { autoAlpha: 0 })
        drawings.forEach((d) => {
          gsap.set(d.querySelectorAll('[data-leader]'), { strokeDashoffset: 1 })
          gsap.set(d.querySelectorAll('[data-dot]'), { autoAlpha: 0, scale: 0 })
          gsap.set(d.querySelectorAll('[data-label]'), { autoAlpha: 0 })
          d.querySelectorAll<HTMLElement>('[data-value]').forEach((v) => {
            if (v.dataset.to) v.textContent = `${v.dataset.prefix ?? ''}0`
          })
        })
      })

      // A panel unveils ONCE, and only if it is still on screen after a short
      // dwell. Flinging down eleven 100dvh panels would otherwise stack eleven
      // ~2s timelines (each animating a filter on a large image) on top of each
      // other; the dwell keeps at most one running, and anything scrolled past
      // un-watched is simply composed. Nothing animates off screen — once a
      // panel is settled its state is static, and its observer is dropped.
      const DWELL = 130
      const done = new WeakSet<HTMLElement>()
      const onScreen = new WeakSet<HTMLElement>()
      const timers = new Map<HTMLElement, number>()

      const io = new IntersectionObserver(
        (entries) => {
          for (const e of entries) {
            const p = e.target as HTMLElement
            if (done.has(p)) continue
            if (e.isIntersecting) {
              onScreen.add(p)
              // Measure the render in idle time during the dwell, so the
              // unveiling's first frame isn't paying for a canvas readback.
              warmRender(p.querySelector<HTMLImageElement>('[data-car-img]'))
              if (timers.has(p)) continue
              timers.set(
                p,
                window.setTimeout(() => {
                  timers.delete(p)
                  if (done.has(p)) return
                  done.add(p)
                  io.unobserve(p)
                  if (onScreen.has(p)) reveal(p)
                  else compose(p)
                }, DWELL)
              )
            } else {
              onScreen.delete(p)
            }
          }
        },
        { threshold: 0.38 }
      )
      panels.forEach((p) => io.observe(p))

      return () => {
        io.disconnect()
        timers.forEach((t) => window.clearTimeout(t))
        timelines.forEach((tl) => tl.kill())
      }
    },
    { scope: rootRef, dependencies: [teams.length] }
  )

  return (
    <div ref={rootRef} className="relative">
      <div className="px-6 pt-10 md:px-14">
        <p className="strip-header text-[var(--text-dim)]">
          CONSTRUCTORS&rsquo; CHAMPIONSHIP{seasonYear ? ` — ${seasonYear}` : ''} — {pad2(teams.length)} TEAMS
        </p>
      </div>

      {teams.map((team, i) => {
        const slug = teamToSlug(team.name)
        const car = carImage(slug)
        const logo = teamLogoImage(slug)
        return (
          <TransitionLink
            key={team.name}
            href={`/teams/${slug}`}
            data-panel
            data-idx={i}
            data-team-colour={team.colour}
            // pt clears the fixed 4rem top bar: at reading position a panel's
            // own top edge sits at viewport 0, i.e. behind the bar, and an
            // index row at pt-8 was being occluded on every panel but the first.
            className="group relative flex min-h-[calc(100dvh-4rem)] w-full flex-col justify-between overflow-hidden border-t border-[var(--line)] px-6 pb-10 pt-20 md:px-14 md:pb-14 md:pt-24"
          >
            {/* settled ambient — the faint team-colour atmosphere the
                unveiling leaves behind */}
            <div
              data-glow
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: glowGradient(team.colour), opacity: GLOW_REST }}
            />

            {/* THE LIGHT — rises from below the frame during the unveiling and
                settles to a low plinth wash. Deliberately NOT screen-blended:
                over #0A0A0A screen and normal are within a point of each
                other, and eleven full-viewport blend layers is eleven extra
                composited surfaces on every scroll frame for nothing. */}
            <div
              data-light
              aria-hidden
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[78%]"
              style={{ background: lightGradient(team.colour), opacity: LIGHT_REST }}
            />

            <div className="relative flex items-start justify-between">
              <span className="label-mono text-[var(--text-dim)]">
                {pad2(i + 1)} / {pad2(teams.length)}
              </span>
            </div>

            {/* THE STAGE — a fixed-aspect box so the car, the drawing and the
                labels all live in one coordinate system and nothing reflows
                when the image decodes (CLS 0). Full-bleed on phones, where a
                4.5:1 render needs every pixel of width it can get. */}
            <div className="relative -mx-6 aspect-[900/800] w-[calc(100%+3rem)] md:mx-auto md:aspect-[1600/600] md:w-full md:max-w-[min(1500px,138vh)]">
              {/* championship position — the site's dim ghost numeral, sunk
                  behind the car so the bodywork crops it */}
              <span
                data-numeral
                aria-hidden
                className="outline-numeral absolute inset-0 flex items-center justify-center leading-none"
                // .outline-numeral's 1px stroke is tuned for the ~13rem the
                // rest of the site uses it at; at nearly double that size the
                // same hairline reads as a smudge, so the weight scales with
                // the type rather than the alpha changing.
                style={{ fontSize: 'clamp(9rem, 26vw, 24rem)', WebkitTextStroke: '1.6px rgba(245, 245, 243, 0.14)' }}
              >
                {pad2(team.position)}
              </span>

              {/* the floor rule the light draws under the car */}
              <div
                data-rule
                aria-hidden
                className="pointer-events-none absolute left-[2%] h-px w-[96%] top-[66%] md:left-[11%] md:w-[78%] md:top-[78%]"
                style={{ backgroundColor: team.colour, opacity: RULE_REST }}
              />

              {/* THE CAR. A raw <img> rather than TreatedImage (the precedent
                  is /drivers): the unveiling animates this element's own
                  filter, and TreatedImage owns that property. Percentage box
                  inside the fixed-aspect stage → zero CLS. */}
              {car && (
                <div
                  data-car
                  aria-hidden
                  // The car's grade lives HERE and nowhere else — the <img>
                  // inside carries no filter. This inline value is the settled
                  // grade an SSR'd, no-JS or reduced-motion panel shows; the
                  // reveal replaces it with the per-team calibration.
                  style={{ filter: CAR_LIT }}
                  className="pointer-events-none absolute left-[2%] w-[96%] top-[37.5%] h-[23.75%] md:left-[11%] md:w-[78%] md:top-[28.3%] md:h-[45.8%]"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    data-car-img
                    src={car}
                    alt=""
                    loading={i === 0 ? 'eager' : 'lazy'}
                    fetchPriority={i === 0 ? 'high' : 'auto'}
                    decoding="async"
                    className="h-full w-full object-contain object-center"
                  />
                </div>
              )}

              <Drawing
                geom={MOBILE}
                team={team}
                variant="mobile"
                strokeWidth={2.4}
                className="md:hidden"
              />
              <Drawing
                geom={DESKTOP}
                team={team}
                variant="desktop"
                strokeWidth={1.2}
                className="hidden md:block"
              />
            </div>

            <div data-title className="relative">
              <div className="flex items-center gap-4 transition-transform duration-300 group-hover:translate-x-2 motion-reduce:transition-none md:gap-6">
                {logo && (
                  <TreatedImage
                    src={logo}
                    treatment="mono"
                    eager={i < 2}
                    fade={false}
                    position="center"
                    sizes="56px"
                    className="h-9 w-9 shrink-0 opacity-75 md:h-12 md:w-12"
                  />
                )}
                <h2
                  className="uppercase leading-[0.86] text-[var(--text)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 7vw, 6.5rem)' }}
                >
                  {team.name}
                </h2>
              </div>

              <div className="label-mono mt-5 flex flex-wrap items-center gap-x-7 gap-y-2 text-[var(--text-dim)]">
                {/* the two callouts a phone can't carry — desktop shows them
                    on the car instead, so nothing is said twice */}
                <span className="md:hidden">P{pad2(team.position)}</span>
                <span className="md:hidden">
                  BEST {team.bestFinish === null ? '—' : ordinal(team.bestFinish)}
                </span>
                <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                  TEAM &rarr;
                </span>
              </div>
            </div>

            {!car && (
              <span className="label-mono absolute right-6 top-8 text-[var(--text-dim)] md:right-14 md:top-10">
                CAR RENDER UNAVAILABLE
              </span>
            )}
          </TransitionLink>
        )
      })}
    </div>
  )
}
