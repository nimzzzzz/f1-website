'use client'

import { useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { carImageHi, teamLogoImage } from '@/lib/media-manifest'
import { toTeamMachine, type TeamMachineView } from '@/lib/season-view'
import type { TeamFacts } from '@/lib/team-facts'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import { CountUp, FadeUp } from '@/components/motion/reveals'
import TreatedImage from '@/components/media/TreatedImage'
import { TransitionLink } from '@/components/motion/TransitionProvider'
import { calibrate, measureRender, lightGradient, CAR_LIT } from '../render-calibration'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// THE MACHINE — the room stays still; you scroll through it.
//
// The garage plate is a PERSISTENT fixed backdrop for the whole page,
// darkened hard and washed in the team's calibrated light (Haas warm rose,
// Cadillac steel blue — measured from the render, never raw grey), with a
// slow transform-only haze drift. Content scrolls over the continuous room
// in plain vertical flow: hero, the car parked in the light pool (revealed
// once as it enters, then completely static — an object in a place, not a
// subject being filmed), then LINEAGE / PAIRING / SEASON as quiet chapters
// using the site's standard reveals, and a settled outro.
//
// There is deliberately NO pin and NO scrub here: an earlier scroll-as-
// camera glide moved the car under the reader and was rejected as too much
// happening at once. Every sibling page keeps its own mechanic; this one's
// is stillness.
//
// Identity and season numbers are SSR'd by page.tsx from the bundle; the
// client refresh re-derives via the same toTeamMachine, keyed by slug.

const pad2 = (n: number) => String(n).padStart(2, '0')

// Counting numerals live in flex rows; reserving the final width up front
// (ch units on tabular/mono digits) keeps digit growth from reflowing
// siblings — the count animates inside a fixed slot, CLS stays 0.
const Slot = ({ v, children }: { v: number; children: React.ReactNode }) => (
  <span className="inline-block text-left" style={{ minWidth: `${String(v).length}ch` }}>
    {children}
  </span>
)

const PLATE = '/media/garage.jpg'
// Graded in CSS rather than through TreatedImage: the plate sits under a
// blend layer and must stand even when faded to near-black.
const PLATE_FILTER = 'grayscale(0.9) contrast(1.12) brightness(0.30)'

// ── the room: plate + team wash + drifting haze, one fixed instance ──────
function Garage({ colour }: { colour: string }) {
  return (
    <div data-garage aria-hidden className="fixed inset-0 -z-10 overflow-hidden">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        data-plate
        src={PLATE}
        alt=""
        decoding="async"
        onError={(e) => {
          // Missing plate → plain dark. The page must stand without it.
          ;(e.currentTarget as HTMLImageElement).style.display = 'none'
        }}
        className="absolute inset-0 h-full w-full scale-[1.04] object-cover"
        style={{ filter: PLATE_FILTER }}
      />
      <div
        data-wash
        className="absolute inset-0 mix-blend-soft-light"
        style={{ background: lightGradient(colour), opacity: 0.55 }}
      />
      <div
        data-glow
        className="absolute inset-0"
        style={{
          background: `radial-gradient(70% 55% at 50% 78%, ${colour}2E, transparent 70%)`,
        }}
      />
      <div
        data-haze
        className="absolute -inset-x-[20%] inset-y-0"
        style={{
          background: `linear-gradient(100deg, transparent 20%, ${colour}0A 42%, transparent 60%, ${colour}08 78%, transparent 95%)`,
        }}
      />
      <div
        data-haze
        className="absolute -inset-x-[20%] inset-y-0"
        style={{
          background: `linear-gradient(260deg, transparent 25%, rgba(245,245,243,0.03) 50%, transparent 72%)`,
        }}
      />
    </div>
  )
}

export default function TeamMachine({
  view: ssrView,
  facts,
}: {
  view: TeamMachineView
  facts: TeamFacts | null
}) {
  const fresher = useLiveSnapshot(ssrView.computedAt)
  const view = useMemo(() => {
    if (!fresher) return ssrView
    return toTeamMachine(fresher, ssrView.slug) ?? ssrView
  }, [fresher, ssrView])

  const colour = view.colour
  const car = carImageHi(view.slug)
  const logo = teamLogoImage(view.slug)
  const [a, b] = view.drivers
  const s = view.season

  const rootRef = useRef<HTMLDivElement>(null)

  // ── hero arrival light (approved — unchanged) ──────────────────────────
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const hero = root.querySelector('[data-hero]')
      if (!hero) return
      const light = hero.querySelector('[data-hero-light]')
      const title = hero.querySelector('[data-hero-title]')
      const num = hero.querySelector('[data-hero-numeral]')
      const tl = gsap.timeline()
      if (light) {
        tl.fromTo(
          light,
          { autoAlpha: 0, yPercent: 40 },
          { autoAlpha: 0.5, yPercent: 0, duration: 0.9, ease: 'power2.out' },
          0
        ).to(light, { autoAlpha: 0.16, duration: 0.8, ease: 'power2.inOut' }, 0.9)
      }
      if (num) {
        tl.fromTo(num, { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.1, ease: 'power3.out' }, 0.05)
      }
      if (title) {
        tl.fromTo(
          title,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' },
          0.2
        )
      }
    },
    { scope: rootRef, dependencies: [view.slug], revertOnUpdate: true }
  )

  // ── the room + the parked car ──────────────────────────────────────────
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      const img = root.querySelector<HTMLImageElement>('[data-car-img]')
      const stage = root.querySelector<HTMLElement>('[data-car-stage]')
      const stageLight = root.querySelector<HTMLElement>('[data-stage-light]')

      // Calibrated identity light everywhere the team colour tints the room.
      const applyCalibration = () => {
        if (!img) return
        const cal = calibrate(measureRender(img), colour)
        if (cal.lightColour !== colour) {
          root.querySelectorAll<HTMLElement>('[data-wash]').forEach((w) => {
            w.style.background = lightGradient(cal.lightColour)
          })
          root.querySelectorAll<HTMLElement>('[data-glow]').forEach((g) => {
            g.style.background = `radial-gradient(70% 55% at 50% 78%, ${cal.lightColour}2E, transparent 70%)`
          })
          if (stageLight) stageLight.style.background = lightGradient(cal.lightColour)
        }
        return cal
      }
      let cal = img && img.complete && img.naturalWidth > 0 ? applyCalibration() : undefined
      if (!cal && img) img.addEventListener('load', () => (cal = applyCalibration()), { once: true })

      // Haze drift — transform only, frozen under reduced motion.
      const cleanups: Array<() => void> = []
      if (!reduced) {
        const layers = root.querySelectorAll('[data-haze]')
        const tweens = [...layers].map((l, i) =>
          gsap.to(l, {
            xPercent: i === 0 ? 9 : -7,
            duration: 26 + i * 9,
            ease: 'sine.inOut',
            yoyo: true,
            repeat: -1,
          })
        )
        cleanups.push(() => tweens.forEach((t) => t.kill()))
      }

      // THE CAR — revealed once as it enters view (light rise + the render
      // coming out of the dark, same family as the /teams reveal), then
      // completely static. Reduced motion: SSR markup already is the lit,
      // settled state — nothing runs.
      if (!reduced && stage && img) {
        const play = () => {
          const c = cal ?? calibrate(null, colour)
          const tl = gsap.timeline({
            scrollTrigger: { trigger: stage, start: 'top 72%', once: true },
          })
          if (stageLight) {
            tl.fromTo(
              stageLight,
              { autoAlpha: 0, yPercent: 38 },
              { autoAlpha: c.lightPeak, yPercent: 0, duration: 0.9, ease: 'power2.out' },
              0
            ).to(stageLight, { autoAlpha: 0.18, duration: 0.8, ease: 'power2.inOut' }, 0.95)
          }
          tl.fromTo(
            img,
            { autoAlpha: 0, y: 24, filter: c.dark },
            {
              autoAlpha: 1,
              y: 0,
              filter: c.overshoot ? c.peak : c.lit,
              duration: c.duration,
              ease: 'power3.out',
            },
            0.08
          )
          if (c.overshoot) {
            tl.to(img, { filter: c.lit, duration: 0.6, ease: 'power2.inOut' }, '>-0.1')
          }
        }
        if (img.complete && img.naturalWidth > 0) play()
        else img.addEventListener('load', play, { once: true })
      }

      // Pairing bar — both halves grow from their own ends on scroll-in.
      if (!reduced) {
        const bar = root.querySelector<HTMLElement>('[data-pair-bar]')
        if (bar) {
          gsap.fromTo(
            bar.children,
            { scaleX: 0 },
            {
              scaleX: 1,
              duration: 0.9,
              ease: 'power3.out',
              scrollTrigger: { trigger: bar, start: 'top 85%', once: true },
            }
          )
        }
      }

      return () => cleanups.forEach((fn) => fn())
    },
    { scope: rootRef, dependencies: [view], revertOnUpdate: true }
  )

  const lineage = facts?.lineage ?? []
  const pairPct =
    a && b ? (a.points + b.points === 0 ? 50 : Math.min(97, Math.max(3, (a.points / (a.points + b.points)) * 100))) : 50

  return (
    <div ref={rootRef} className="relative overflow-x-clip">
      {/* the room — one fixed instance behind everything */}
      <Garage colour={colour} />

      {/* ─── HERO (approved — unchanged) ─── */}
      <section
        data-hero
        className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-16 pt-8 md:px-14"
      >
        <div
          data-hero-light
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[70%]"
          style={{
            background: `linear-gradient(to top, ${colour} 0%, ${colour}59 26%, transparent 62%)`,
            opacity: 0.16,
          }}
        />
        <span
          data-hero-numeral
          aria-hidden
          className="outline-numeral absolute right-[2vw] top-1/2 -translate-y-1/2 leading-none"
          style={{ fontSize: 'clamp(11rem, 26vw, 22rem)', WebkitTextStroke: `1.6px ${colour}55` }}
        >
          {pad2(view.position)}
        </span>
        <TransitionLink
          href="/teams"
          className="strip-header absolute left-6 top-8 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] md:left-14"
        >
          &larr; ALL TEAMS
        </TransitionLink>
        <div data-hero-title className="relative">
          {logo && (
            <TreatedImage
              src={logo}
              treatment="mono"
              eager
              fade={false}
              position="left center"
              sizes="64px"
              className="mb-5 h-10 w-24 opacity-75 md:h-12 md:w-28"
            />
          )}
          <h1
            className="uppercase leading-[0.85] text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3.4rem, 10vw, 10rem)' }}
          >
            {view.name}
          </h1>
          <div className="label-mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-[2px] w-3" style={{ backgroundColor: colour }} />
              CONSTRUCTORS&rsquo; P{view.position}
            </span>
            <span className="text-[var(--text)]">{s.points} PTS</span>
            <span className="hidden md:inline opacity-60">SCROLL — THE MACHINE</span>
          </div>
        </div>
      </section>

      {/* ─── THE CAR — parked in the light pool, revealed once, then still ─── */}
      {car && (
        <section
          data-car-stage
          className="relative flex min-h-[78vh] flex-col justify-center overflow-hidden border-t border-[var(--line)] py-14 md:py-20"
        >
          {/* the light that finds the car, settling as the pool it sits in */}
          <div
            data-stage-light
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[80%]"
            style={{ background: lightGradient(colour), opacity: 0.18 }}
          />
          <div className="relative mx-auto w-[94%] max-w-[1560px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-car-img
              src={car}
              alt={`${view.name} car`}
              decoding="async"
              fetchPriority="high"
              className="w-full object-contain"
              style={{ filter: CAR_LIT }}
            />
          </div>
        </section>
      )}

      {/* ─── THE LINEAGE — the page's best content; given room ─── */}
      <section className="relative border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
        <FadeUp>
          <p className="section-header text-[var(--text-dim)]">THE LINEAGE</p>
          {facts ? (
            <div className="max-w-4xl">
              <p
                className="mt-6 leading-none text-[var(--text)]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 13vw, 11rem)' }}
              >
                EST. {facts.founded}
              </p>
              {facts.firstSeason !== facts.founded && (
                <p className="label-mono mt-3 text-[var(--text-dim)]">IN F1 SINCE {facts.firstSeason}</p>
              )}
              {lineage.length > 0 && (
                <p className="label-mono mt-8 max-w-2xl leading-relaxed text-[var(--text-dim)]">
                  {lineage.map((n, i) => (
                    <span key={i}>
                      <span className={i === lineage.length - 1 ? 'text-[var(--text)]' : ''}>
                        {n.toUpperCase()}
                      </span>
                      {i < lineage.length - 1 && <span className="opacity-50"> &rarr; </span>}
                    </span>
                  ))}
                </p>
              )}
              {facts.titles.length > 0 && (
                <div className="mt-10">
                  <p className="label-mono text-[var(--text-dim)]">
                    {facts.titles.length} CONSTRUCTORS&rsquo; TITLE{facts.titles.length > 1 ? 'S' : ''}
                  </p>
                  <p
                    className="mt-2 flex max-w-2xl flex-wrap gap-x-4 gap-y-1.5 font-mono text-sm tabular-nums"
                    style={{ color: colour }}
                  >
                    {facts.titles.map((y) => (
                      <span key={y}>{y}</span>
                    ))}
                  </p>
                </div>
              )}
              <div className="label-mono mt-10 space-y-2 border-t border-[var(--line)] pt-6 text-[var(--text-dim)]">
                <p>
                  PRINCIPAL <span className="text-[var(--text)]">{facts.principal.toUpperCase()}</span>
                </p>
                <p>
                  BASE <span className="text-[var(--text)]">{facts.base.toUpperCase()}</span>
                </p>
                <p>
                  ENGINE <span className="text-[var(--text)]">{facts.engine.toUpperCase()}</span>
                </p>
              </div>
            </div>
          ) : (
            <p className="label-mono mt-6 text-[var(--text-dim)]">NEW ENTRY — NO RECORDED LINEAGE</p>
          )}
        </FadeUp>
      </section>

      {/* ─── THE PAIRING ─── */}
      <section className="relative border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
        <FadeUp>
          <p className="section-header text-[var(--text-dim)]">THE PAIRING</p>
          {a && b ? (
            <div className="max-w-4xl">
              <div className="mt-8 flex items-baseline justify-between gap-6">
                <TransitionLink
                  href={`/drivers/${a.acronym.toLowerCase()}`}
                  className="uppercase leading-none text-[var(--text)] transition-colors hover:text-[var(--accent)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3.4vw, 3.4rem)' }}
                >
                  {a.surname}
                </TransitionLink>
                <TransitionLink
                  href={`/drivers/${b.acronym.toLowerCase()}`}
                  className="uppercase leading-none text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
                  style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 3.4vw, 3.4rem)' }}
                >
                  {b.surname}
                </TransitionLink>
              </div>
              <div data-pair-bar className="mt-5 flex h-[9px] w-full" aria-hidden>
                <span className="origin-left" style={{ width: `${pairPct}%`, backgroundColor: colour }} />
                <span className="origin-right flex-1" style={{ backgroundColor: colour, opacity: 0.22 }} />
              </div>
              <div className="label-mono mt-4 flex items-baseline justify-between text-[var(--text-dim)]">
                <span className="font-mono text-xl tabular-nums text-[var(--text)]">
                  <Slot v={a.points}>
                    <CountUp value={a.points} />
                  </Slot>
                  <span className="label-mono ml-1.5 text-[var(--text-dim)]">PTS</span>
                </span>
                <span className="font-mono text-xl tabular-nums">
                  <Slot v={b.points}>
                    <CountUp value={b.points} />
                  </Slot>
                  <span className="label-mono ml-1.5">PTS</span>
                </span>
              </div>
              {view.pairing && (
                <div className="mt-12">
                  <p className="label-mono text-[var(--text-dim)]">RACE HEAD-TO-HEAD</p>
                  <p
                    className="mt-2 leading-none text-[var(--text)]"
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(3rem, 6vw, 6rem)' }}
                  >
                    {view.pairing.winsA}
                    <span className="text-[var(--text-dim)]">&ndash;</span>
                    {view.pairing.winsB}
                  </p>
                  <p className="label-mono mt-3 text-[var(--text-dim)]">
                    ACROSS {pad2(view.pairing.bothClassified)} RACES WHERE BOTH CLASSIFIED
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="label-mono mt-6 text-[var(--text-dim)]">DRIVER PAIRING UNAVAILABLE</p>
          )}
        </FadeUp>
      </section>

      {/* ─── THE SEASON ─── */}
      <section className="relative border-t border-[var(--line)] px-6 py-24 md:px-14 md:py-32">
        <FadeUp>
          <p className="section-header text-[var(--text-dim)]">
            THE SEASON{view.seasonYear ? ` — ${view.seasonYear}` : ''}
          </p>
          <div className="mt-8 flex flex-wrap items-end gap-x-12 gap-y-10 md:gap-x-16">
            <div>
              <span
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(4.5rem, 11vw, 10rem)' }}
              >
                <Slot v={s.points}>
                  <CountUp value={s.points} />
                </Slot>
              </span>
              <p className="label-mono mt-3 text-[var(--text-dim)]">POINTS</p>
            </div>
            {(
              [
                ['WINS', s.wins],
                ['PODIUMS', s.podiums],
                ['DNFS', s.dnfs],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <span
                  className="font-mono tabular-nums leading-none text-[var(--text)]"
                  style={{ fontSize: 'clamp(2.2rem, 4vw, 4rem)' }}
                >
                  <Slot v={value}>
                    <CountUp value={value} />
                  </Slot>
                </span>
                <p className="label-mono mt-3 text-[var(--text-dim)]">{label}</p>
              </div>
            ))}
            {s.bestFinish !== null && (
              <div>
                <span
                  className="leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.2rem, 4vw, 4rem)',
                    color: s.bestFinish === 1 ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  P{s.bestFinish}
                </span>
                <p className="label-mono mt-3 text-[var(--text-dim)]">BEST FINISH</p>
              </div>
            )}
          </div>
          {s.biggestHaul && (
            <p className="label-mono mt-10 text-[var(--text-dim)]">
              BIGGEST HAUL{' '}
              <span className="font-mono text-base tabular-nums text-[var(--text)]">
                +{s.biggestHaul.points}
              </span>{' '}
              — {s.biggestHaul.circuit.toUpperCase()} · R{pad2(s.biggestHaul.round)}
            </p>
          )}
        </FadeUp>
      </section>

      {/* ─── settled outro ─── */}
      <section className="relative flex min-h-[60dvh] flex-col justify-center overflow-hidden border-t border-[var(--line)] px-6 py-20 md:px-14">
        <span
          aria-hidden
          className="outline-numeral pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 leading-none"
          style={{ fontSize: 'clamp(10rem, 24vw, 20rem)' }}
        >
          {pad2(view.position)}
        </span>
        <FadeUp>
          <p className="section-header text-[var(--text-dim)]">WHERE THAT LEAVES THEM</p>
          <p
            className="mt-4 leading-none text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 6vw, 5.5rem)' }}
          >
            P{view.position} &mdash; {s.points} POINTS
          </p>
          <TransitionLink
            href="/teams"
            className="label-mono mt-8 inline-block text-[var(--text)] transition-colors hover:text-[var(--accent)]"
          >
            &larr; ALL TEAMS
          </TransitionLink>
        </FadeUp>
      </section>
    </div>
  )
}
