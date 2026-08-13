'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { driverImage, carImage } from '@/lib/media-manifest'
import { teamToSlug } from '@/lib/team-data'
import TreatedImage from '@/components/media/TreatedImage'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import { toGalleryDrivers, type GalleryDriver } from '@/lib/season-view'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// One gallery panel, championship-ordered — identity comes from the server
// bundle (SSR'd by app/drivers/page.tsx), so panel 1 and its headshot are in
// the initial HTML. This component owns the interaction layer: the pinned
// horizontal scrub, the progress rail, and the per-panel CAR BLAST — when a
// panel becomes active its team's car sweeps in from off-screen with motion
// blur and settles large behind the number, a team-colour light wall sweeps
// across, and a faint ambient glow stays.
export type { GalleryDriver }

const pad2 = (n: number) => String(n).padStart(2, '0')

// Car grade: team colour at reduced saturation (matches /teams) but darker,
// so it sinks into the panel world behind the number and headshot.
const CAR_FILTER = 'saturate(0.75) contrast(1.05) brightness(0.6)'
const GLOW_REST = 0.14

export default function DriversGallery({
  drivers: ssrDrivers,
  computedAt,
}: {
  drivers: GalleryDriver[]
  computedAt: string | null
}) {
  // Converge on the freshest snapshot after hydration; the SSR'd standings
  // are the floor. Driver count is stable across a refresh, so the pinned
  // scrub's useGSAP (keyed on drivers.length) does not re-run — only the
  // numbers and the championship ordering update.
  const live = useLiveSnapshot(computedAt)
  const drivers = live ? toGalleryDrivers(live) : ssrDrivers

  const sectionRef = useRef<HTMLElement>(null)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      const section = sectionRef.current
      const viewport = viewportRef.current
      const track = trackRef.current
      const rail = railRef.current
      if (!section || !viewport || !track || drivers.length === 0) return

      const panelEls = gsap.utils.toArray<HTMLElement>('[data-panel]')
      type Parts = {
        car: HTMLElement | null
        img: HTMLImageElement | null
        wall: HTMLElement | null
        glow: HTMLElement | null
        shot: HTMLElement | null
      }
      // Resolved by LIVE index, not from the array captured above. A client
      // refresh can reorder the standings, and React's keyed reconciliation
      // moves the existing panel nodes — so a snapshot array taken at init
      // would keep the old index → element mapping and fire the car blast on
      // the wrong panel. Re-querying costs one selector call per panel change.
      const panelAt = (i: number): HTMLElement | undefined =>
        section.querySelectorAll<HTMLElement>('[data-panel]')[i]
      const parts = (i: number): Parts => {
        const p = panelAt(i)
        return {
          car: p?.querySelector('[data-car]') ?? null,
          img: p?.querySelector<HTMLImageElement>('[data-car-img]') ?? null,
          wall: p?.querySelector('[data-wall]') ?? null,
          glow: p?.querySelector('[data-glow]') ?? null,
          shot: p?.querySelector('[data-shot]') ?? null,
        }
      }

      // Compose a panel into its finished, static state — car parked, glow on,
      // no sweep. This is the reduced-motion look AND the resting state a
      // panel keeps after its first blast (so fast scrub-bys show parked cars).
      const compose = (i: number) => {
        const { car, wall, glow, shot } = parts(i)
        if (car) gsap.set(car, { xPercent: 0, skewX: 0, scaleX: 1, opacity: 1, filter: 'blur(0px)' })
        if (glow) gsap.set(glow, { opacity: GLOW_REST })
        if (wall) gsap.set(wall, { opacity: 0 })
        if (shot) gsap.set(shot, { filter: 'brightness(1) contrast(1)' })
      }

      // ── reduced motion: every panel pre-settled, fully composed, no triggers
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        drivers.forEach((_, i) => {
          const { img } = parts(i)
          if (img && img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src
          compose(i)
        })
        return
      }

      const ensureLoaded = (i: number) => {
        const { img } = parts(i)
        if (img && img.dataset.src && !img.getAttribute('src')) img.src = img.dataset.src
      }
      const isReady = (img: HTMLImageElement | null) =>
        !!img && !!img.getAttribute('src') && img.complete && img.naturalWidth > 0

      // Park a panel's car instantly — the resting state a panel keeps when it
      // becomes active, so fast scrub-bys always show parked cars + glow (no
      // entrance). If the car isn't decoded yet, park it the moment it is.
      const settleInstant = (i: number) => {
        const { car, img, glow } = parts(i)
        if (!car) return
        ensureLoaded(i)
        if (!isReady(img)) {
          if (img) img.onload = () => settleInstant(i)
          return
        }
        gsap.set(car, { xPercent: 0, skewX: 0, scaleX: 1, opacity: 1, filter: 'blur(0px)' })
        if (glow) gsap.set(glow, { opacity: GLOW_REST })
      }

      // The blast: car in from off-screen with motion blur, decel expo.out to
      // parked; light wall sweeps once; headshot gets a rim-light bump as the
      // wall crosses it; glow rises and stays. dir>=0 → enter from the right
      // (scrub travelling forward), dir<0 → from the left.
      const blast = (i: number, dir: number, tame = false) => {
        const { car, img, wall, glow, shot } = parts(i)
        if (!car) return
        ensureLoaded(i)
        // Never blast an unloaded image: play the entrance once it's decoded,
        // if this panel is still the active one.
        if (!isReady(img)) {
          if (img) img.onload = () => { if (activeIdx === i) blast(i, dir, tame) }
          return
        }
        const ENTER = tame ? 74 : 122
        const BLUR = tame ? 14 : 26
        const DUR = tame ? 0.62 : 0.76
        const from = dir >= 0 ? 1 : -1

        const tl = gsap.timeline()
        tl.set(car, { willChange: 'transform, filter' })
          .fromTo(
            car,
            {
              xPercent: from * ENTER,
              skewX: from * -7,
              scaleX: 1.18,
              opacity: 0.25,
              filter: `blur(${BLUR}px)`,
            },
            {
              xPercent: 0,
              skewX: 0,
              scaleX: 1,
              opacity: 1,
              filter: 'blur(0px)',
              duration: DUR,
              ease: 'expo.out',
              onComplete: () => gsap.set(car, { clearProps: 'willChange' }),
            }
          )
        // Ambient glow: on mobile / no-wall it's a simple clock fade-in; on
        // desktop it starts hidden and rises as the AFTERGLOW the light pass
        // leaves behind (fired from the wall's exit, below).
        const hasWall = !!wall && !tame
        if (glow && !hasWall) {
          tl.fromTo(glow, { opacity: 0 }, { opacity: GLOW_REST, duration: 0.9, ease: 'power2.out' }, 0)
        } else if (glow) {
          tl.set(glow, { opacity: 0 }, 0)
        }

        // The light PASS — a deliberate team-colour light source moving across
        // the panel (~1.4s crossing), washing over the car after it parks.
        // Screen-blend, gentle ease so it reads as a moving source, not a
        // strobe. The rim bump and the afterglow are driven by where the light
        // ACTUALLY is (its live panel-fraction), not a fixed clock, so both
        // stay synced whichever direction the scrub is travelling.
        if (hasWall) {
          const TRAVEL = 44
          const WALL_DUR = 1.15
          const HEADSHOT_FRAC = 0.75 // headshot centre, as a panel-width fraction
          // Peak wall opacity — the dial that governs the sweep's hotness.
          // Under screen blend the added light is α·(screen(base,src) − base),
          // so this scales the whole wall, and it lifts the gradient's white
          // core stop off the 255 ceiling: at α=1 that core clipped to pure
          // white on every team, which read as blow-out on the lightest
          // colours (papaya). Measured in isolation, 0.82 is the ~15%-down
          // point (peak luma 255 → 218); 0.85 only got ~12.5% because
          // compositing over the panel base isn't linear in luma.
          const WALL_PEAK = 0.82
          // core (bright centre) panel-fraction from the element's live xPercent:
          // the wall box is 128% wide (‑14% inset each side), so its 50% point
          // maps to 0.5 + 1.28·(xPercent/100) in panel-width units.
          const coreFrac = () => 0.5 + 1.28 * ((gsap.getProperty(wall, 'xPercent') as number) / 100)
          const passedPast = (f: number, mark: number) => (from > 0 ? f >= mark : f <= mark)
          let rimFired = false
          let glowFired = false
          const riseGlow = () => {
            if (glowFired || !glow) return
            glowFired = true
            gsap.to(glow, { opacity: GLOW_REST, duration: 0.7, ease: 'power2.out' })
          }
          // Both cues track where the light ACTUALLY is: the headshot rim bump
          // fires as the core crosses the headshot; the ambient glow rises as
          // the core leaves the frame (the afterglow the pass leaves behind).
          const onWall = () => {
            const f = coreFrac()
            if (!rimFired && shot && passedPast(f, HEADSHOT_FRAC)) {
              rimFired = true
              gsap
                .timeline()
                .to(shot, { filter: 'brightness(1.5) contrast(1.1)', duration: 0.22, ease: 'power2.out' })
                .to(shot, { filter: 'brightness(1) contrast(1)', duration: 0.55, ease: 'power2.inOut' })
            }
            if (!glowFired && passedPast(f, from > 0 ? 1 : 0)) riseGlow()
          }
          tl.set(wall, { willChange: 'transform', xPercent: from * -TRAVEL, opacity: 0 }, 0)
            .to(wall, { opacity: WALL_PEAK, duration: 0.32, ease: 'sine.out' }, 0)
            .to(
              wall,
              {
                xPercent: from * TRAVEL,
                duration: WALL_DUR,
                ease: 'sine.inOut',
                onUpdate: onWall,
                onComplete: riseGlow, // safety net if the core cleared between frames
              },
              0
            )
            .to(wall, { opacity: 0, duration: 0.5, ease: 'sine.in' }, WALL_DUR - 0.46)
            .set(wall, { clearProps: 'willChange' }, WALL_DUR + 0.1)
        }
      }

      let activeIdx = -1
      let dwellTimer: number | undefined
      const preloadAround = (i: number) => {
        for (let j = i - 2; j <= i + 2; j++) if (j >= 0 && j < drivers.length) ensureLoaded(j)
      }

      // A panel became active: park its car at once (fast scrub-bys just show
      // parked cars streaking past), then — only if it's held ≥ DWELL — fire
      // the entrance blast. The debounce means fast scrubbing through 22 panels
      // never machine-guns 22 blasts; a deliberate hold, or re-activating a
      // panel, replays the entrance, which reads as alive.
      const DWELL = 170
      const onActivate = (i: number, dir: number) => {
        activeIdx = i
        preloadAround(i)
        settleInstant(i)
        if (dwellTimer) window.clearTimeout(dwellTimer)
        dwellTimer = window.setTimeout(() => {
          if (activeIdx === i) blast(i, dir)
        }, DWELL)
      }

      // init: cars hidden until a panel first becomes active (then parked);
      // walls off; headshot filter neutral so the rim bump has a baseline
      drivers.forEach((_, i) => {
        const { car, glow, wall, shot } = parts(i)
        if (car) gsap.set(car, { opacity: 0, xPercent: 0 })
        if (glow) gsap.set(glow, { opacity: 0 })
        if (wall) gsap.set(wall, { opacity: 0 })
        if (shot) gsap.set(shot, { filter: 'brightness(1) contrast(1)' })
      })

      const mm = gsap.matchMedia()
      const cleanups: Array<() => void> = []

      // ── desktop: pinned horizontal scrub ───────────────────────────────
      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth)
        let lastIdx = -1
        let lastProg = 0
        const setPanel = (progress: number) => {
          const idx = Math.min(drivers.length - 1, Math.round(progress * (drivers.length - 1)))
          if (idx !== lastIdx) {
            const dir = progress >= lastProg ? 1 : -1
            lastIdx = idx
            if (rail) {
              const counter = rail.querySelector<HTMLElement>('[data-rail-counter]')
              if (counter) counter.textContent = `${pad2(idx + 1)} / ${pad2(drivers.length)}`
              rail.querySelectorAll<HTMLElement>('[data-tick]').forEach((t, i) => {
                t.style.backgroundColor =
                  i === idx ? `#${drivers[i]?.teamColour || 'F5F5F3'}` : 'rgba(245,245,243,0.18)'
                t.style.transform = i === idx ? 'scaleY(1.8)' : 'scaleY(1)'
              })
            }
            onActivate(idx, dir)
          }
          lastProg = progress
        }
        const tween = gsap.fromTo(
          track,
          { x: 0 },
          {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
              trigger: section,
              start: 'top top',
              end: () => `+=${Math.max(window.innerHeight, distance() * 0.45)}`,
              pin: true,
              // Pin by TRANSFORM, not by position: fixed — this is a CLS fix,
              // not a preference. <main> carries pt-16 to clear the fixed top
              // bar, so this section sits in flow at document y=64. Pinning it
              // with `position: fixed; top: 0` is a genuine 64px positional
              // change in the layout tree (plus a 1px height reflow, 805→806),
              // and Chrome scores it as a layout shift every single time the
              // gallery is scrolled into — measured 0.0429, identically on warm
              // and cold cache. It is visually near-seamless, which is exactly
              // why it went unnoticed: the only visible artefact is a ~5px
              // hop from Lenis's per-frame scroll granularity (the pin engages
              // on the first frame where scrollY >= 64, in practice ~69).
              //
              // Transform-induced movement is excluded from the Layout
              // Instability spec, so pinning this way scores 0 while looking
              // the same. It also keeps the element in flow: no position
              // switch, no height reflow, and no containing-block change for
              // the absolutely-positioned progress rail (whose own zero-rect
              // entry in the shift was a symptom of that switch, not a late
              // mount). This is also the pinType Lenis recommends for
              // smooth-scroll setups, which this site is.
              pinType: 'transform',
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate: (st) => setPanel(st.progress),
              onRefresh: (st) => setPanel(st.progress),
            },
          }
        )
        // The opening moment: ScrollTrigger's initial onRefresh reports
        // progress 0, so onActivate(0) runs on load — panel 0 parks and then
        // blasts ~DWELL later, opening /drivers on the moment. No separate
        // intro call (it would double-fire with that first activation).
        cleanups.push(() => {
          tween.scrollTrigger?.kill()
          tween.kill()
        })
      })

      // ── mobile / touch: vertical stack, blast on scroll-into-view (tamer) ──
      mm.add('(max-width: 767px), (hover: none)', () => {
        const lastBlast: number[] = new Array(drivers.length).fill(-Infinity)
        const io = new IntersectionObserver(
          (entries) => {
            const now = performance.now()
            for (const e of entries) {
              const i = Number((e.target as HTMLElement).dataset.idx)
              if (Number.isNaN(i)) continue
              if (e.isIntersecting) {
                activeIdx = i
                preloadAround(i)
                // debounce re-entries so scrubbing the stack up and down doesn't
                // machine-gun the same panel; otherwise each scroll-in blasts
                if (now - lastBlast[i] > 1200) {
                  lastBlast[i] = now
                  blast(i, 1, true)
                } else {
                  settleInstant(i)
                }
              }
            }
          },
          { root: null, threshold: 0.55 }
        )
        panelEls.forEach((p) => io.observe(p))
        cleanups.push(() => io.disconnect())
      })

      return () => {
        if (dwellTimer) window.clearTimeout(dwellTimer)
        cleanups.forEach((fn) => fn())
        mm.revert()
      }
    },
    { scope: sectionRef, dependencies: [drivers.length] }
  )

  return (
    <section ref={sectionRef} className="relative overflow-hidden">
      <div className="px-6 pt-10 md:px-14">
        <p className="strip-header text-[var(--text-dim)]">
          THE GRID — {pad2(drivers.length)} DRIVERS — CHAMPIONSHIP ORDER
        </p>
      </div>

      <div ref={viewportRef} className="mt-6 overflow-x-hidden">
        {/* one full-viewport panel per driver: horizontal on desktop,
            a vertical stack on mobile and under reduced motion */}
        <div
          ref={trackRef}
          className="flex w-full flex-col mdh:w-max mdh:flex-row motion-reduce:mdh:w-full motion-reduce:mdh:flex-col"
        >
          {drivers.map((d, i) => {
            const teamColor = `#${d.teamColour || 'F5F5F3'}`
            const photo = driverImage(d.nameAcronym)
            const car = carImage(teamToSlug(d.teamName))
            return (
              <TransitionLink
                key={d.driverNumber}
                href={`/drivers/${d.nameAcronym.toLowerCase()}`}
                data-panel
                data-idx={i}
                className="group relative flex min-h-[72vh] w-full shrink-0 flex-col justify-end overflow-hidden border-t border-[var(--line)] px-6 pb-16 pt-10 md:min-h-[calc(100dvh-11rem)] mdh:w-screen mdh:border-l mdh:border-t-0 md:px-14 motion-reduce:mdh:w-full motion-reduce:mdh:border-l-0 motion-reduce:mdh:border-t"
              >
                {/* ambient team-colour glow — lowest layer, faint atmosphere */}
                <div
                  data-glow
                  aria-hidden
                  className="pointer-events-none absolute inset-0 opacity-0"
                  style={{
                    background: `radial-gradient(58% 46% at 50% 80%, ${teamColor}, transparent 70%)`,
                  }}
                />

                {/* THE CAR — large, low, behind the number and headshot. Plain
                    img (alpha cutout) so load timing is controllable; src is set
                    imperatively for the active ±2 panels. Panel 0 loads eagerly
                    for its opening blast. */}
                {car && (
                  <div
                    data-car
                    aria-hidden
                    className="pointer-events-none absolute bottom-[3%] left-0 right-0 mx-auto h-[58%] w-[64vw] max-w-[1040px] opacity-0"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      data-car-img
                      data-src={car}
                      src={i === 0 ? car : undefined}
                      alt=""
                      fetchPriority={i === 0 ? 'high' : 'low'}
                      decoding="async"
                      className="h-full w-full object-contain object-bottom"
                      style={{ filter: CAR_FILTER }}
                    />
                  </div>
                )}

                {/* headshot — dark-treated atmosphere; the number paints above it.
                    Wrapped so the rim-light bump can brighten the whole subtree.
                    Panel 1 is the LCP: priority puts its preload in the SSR HTML. */}
                {photo && (
                  <div
                    data-shot
                    className="pointer-events-none absolute bottom-0 right-0 h-[58%] w-[72%] md:right-[8vw] md:h-[76%] md:w-[36vw] md:max-w-[560px]"
                  >
                    <TreatedImage
                      src={photo}
                      treatment="mono"
                      priority={i === 0}
                      sizes="(min-width: 768px) 36vw, 72vw"
                      className="absolute inset-0"
                    />
                  </div>
                )}

                {/* the race number — massive, outlined in the team's color.
                    Team colors are the dataset here; red stays scarce. */}
                <span
                  aria-hidden
                  className="pointer-events-none absolute right-[2vw] top-1/2 -translate-y-1/2 leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(14rem, 30vw, 26rem)',
                    color: 'transparent',
                    WebkitTextStroke: `2px ${teamColor}`,
                    opacity: 0.55,
                  }}
                >
                  {d.driverNumber}
                </span>

                {/* light wall — a single team-colour sweep during the blast,
                    screen-blended so it lightens rather than occludes. Above the
                    car/headshot/number, below the bottom text (legibility). */}
                <div
                  data-wall
                  aria-hidden
                  className="pointer-events-none absolute inset-y-0 -inset-x-[14%] opacity-0"
                  style={{
                    background: `linear-gradient(103deg, transparent 14%, ${teamColor}00 25%, ${teamColor} 43%, #ffffff 50%, ${teamColor} 57%, ${teamColor}00 75%, transparent 86%)`,
                    mixBlendMode: 'screen',
                  }}
                />

                {/* championship index */}
                <span className="label-mono absolute right-6 top-6 text-[var(--text-dim)] md:right-14">
                  {pad2(i + 1)} / {pad2(drivers.length)}
                </span>

                <div className="relative">
                  <p className="label-mono mb-3 text-[var(--text-dim)]">
                    {d.firstName?.toUpperCase()}
                  </p>
                  <p
                    className="uppercase leading-[0.85] text-[var(--text)] transition-transform duration-300 group-hover:translate-x-3 motion-reduce:transition-none"
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontSize: 'clamp(3.4rem, 9vw, 9rem)',
                    }}
                  >
                    {d.surname}
                  </p>
                  <div className="label-mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="inline-block h-[2px] w-3"
                        style={{ backgroundColor: teamColor }}
                      />
                      {d.teamName?.toUpperCase()}
                    </span>
                    {d.countryCode && <span>{d.countryCode}</span>}
                    <span className="text-[var(--text)]">{Math.floor(d.points)} PTS</span>
                    <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                      PROFILE →
                    </span>
                  </div>
                </div>
              </TransitionLink>
            )
          })}
        </div>
      </div>

      {/* progress rail — desktop pinned mode only */}
      <div
        ref={railRef}
        className="absolute inset-x-6 bottom-6 z-10 hidden items-center gap-4 md:inset-x-14 mdh:flex motion-reduce:mdh:hidden"
      >
        <div className="flex flex-1 items-center gap-1.5">
          {drivers.map((d, i) => (
            <span
              key={d.driverNumber}
              data-tick
              className="h-2 flex-1 origin-bottom transition-[transform,background-color] duration-200"
              style={{
                backgroundColor: i === 0 ? `#${d.teamColour || 'F5F5F3'}` : 'rgba(245,245,243,0.18)',
              }}
            />
          ))}
        </div>
        <span data-rail-counter className="label-mono shrink-0 text-[var(--text-dim)]">
          01 / {pad2(drivers.length)}
        </span>
      </div>
    </section>
  )
}
