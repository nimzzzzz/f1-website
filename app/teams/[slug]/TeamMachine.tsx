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

// THE MACHINE — the car is the page. A pinned glide where scroll drives a
// slow camera move across the car at ~2.2x viewport scale: arrive at the
// nose, travel the bodywork, exit past the rear wing. Three content
// chapters fade in anchored to regions of the machine — LINEAGE at the
// nose, THE PAIRING at the cockpit, THE SEASON at the rear wing — inside a
// team-tinted night-garage environment (real plate, darkened hard, washed
// in the calibrated team light so Haas reads warm rose and Cadillac steel
// blue, never raw grey).
//
// Mobile and reduced motion get a stacked variant (CSS-switched, no JS
// dependence): hero, the car once, the three chapters composed statically.
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
// The plate is graded in CSS rather than through TreatedImage because it
// must sit under gsap-driven parallax transforms and a blend layer — same
// treatment values as the 'backdrop' grade, pushed darker: the environment
// must stand even when faded to near-black.
const PLATE_FILTER = 'grayscale(0.9) contrast(1.12) brightness(0.30)'

// Camera framing, as fractions of viewport width: where the nose sits at
// progress 0 and the rear wing at progress 1.
const NOSE_AT = 0.74
const TAIL_AT = 0.26
// Chapter windows on the scrub: [fadeInStart, holdStart, holdEnd, fadeOutEnd]
const WINDOWS: Array<[number, number, number, number]> = [
  [0, 0, 0.26, 0.36],
  [0.3, 0.4, 0.58, 0.68],
  [0.62, 0.72, 1, 1],
]

interface ChapterValue {
  el: HTMLElement
  to: number
  done: boolean
}

// ── the garage environment: plate + team wash + drifting haze ────────────
function Garage({ colour, parallax = false }: { colour: string; parallax?: boolean }) {
  return (
    <div data-garage data-parallax={parallax ? '1' : undefined} aria-hidden className="absolute inset-0 overflow-hidden">
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
        className="absolute inset-0 h-full w-full scale-[1.08] object-cover"
        style={{ filter: PLATE_FILTER }}
      />
      {/* the team's light in the garage — calibrated colour set by JS */}
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
      {/* haze — two translucent layers drifting slowly, transform-only */}
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
  const glideRef = useRef<HTMLElement>(null)

  // ── hero arrival light (shared grammar with /teams) ────────────────────
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

  // ── the glide ──────────────────────────────────────────────────────────
  useGSAP(
    () => {
      const root = rootRef.current
      const section = glideRef.current
      if (!root || !section) return
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

      // Calibrated identity light on every garage instance (Haas warm rose,
      // Cadillac steel blue) — measured from the render itself, exactly as
      // the /teams reveal does.
      const img = root.querySelector<HTMLImageElement>('[data-car-img]')
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
        }
      }
      if (img && img.complete && img.naturalWidth > 0) applyCalibration()
      else img?.addEventListener('load', applyCalibration, { once: true })

      // Haze drift on every garage instance — paused offscreen, absent
      // under reduced motion.
      const cleanups: Array<() => void> = []
      if (!reduced) {
        root.querySelectorAll<HTMLElement>('[data-garage]').forEach((env) => {
          const layers = env.querySelectorAll('[data-haze]')
          const tweens = [...layers].map((l, i) =>
            gsap.to(l, {
              xPercent: i === 0 ? 9 : -7,
              duration: 26 + i * 9,
              ease: 'sine.inOut',
              yoyo: true,
              repeat: -1,
              paused: true,
            })
          )
          const io = new IntersectionObserver(
            (es) => es.forEach((e) => tweens.forEach((t) => (e.isIntersecting ? t.play() : t.pause()))),
            { threshold: 0 }
          )
          io.observe(env)
          cleanups.push(() => {
            io.disconnect()
            tweens.forEach((t) => t.kill())
          })
        })
      }

      // The stacked variant (mobile / reduced motion) needs no scrub.
      const wantGlide =
        !reduced && window.matchMedia('(min-width: 768px)').matches
      if (!wantGlide) return () => cleanups.forEach((fn) => fn())

      const carWrap = section.querySelector<HTMLElement>('[data-car]')
      const plate = section.querySelector<HTMLElement>('[data-parallax="1"] [data-plate]')
      const chapters = gsap.utils.toArray<HTMLElement>('[data-chapter]', section)
      if (!carWrap || !img) return () => cleanups.forEach((fn) => fn())

      // Per-chapter count-ups, driven by window entry — not by their own
      // ScrollTriggers, which mis-anchor inside a pinned section.
      const values: ChapterValue[][] = chapters.map((c) =>
        gsap.utils.toArray<HTMLElement>('[data-mval]', c).map((el) => ({
          el,
          to: Number(el.dataset.to ?? NaN),
          done: false,
        }))
      )
      const bars = chapters.map((c) => c.querySelector<HTMLElement>('[data-pair-bar]'))

      let x0 = 0
      let x1 = 0
      const build = () => {
        if (!(img.complete && img.naturalWidth > 0)) return false
        const vw = window.innerWidth
        const vh = window.innerHeight
        const aspect = img.naturalWidth / img.naturalHeight
        let carW = 2.2 * vw
        let carH = carW / aspect
        // 0.72 cap + 62% centre: sized so the bodywork clears the chapter
        // blocks — ch1's spec plate grazed the Haas engine cover at 0.78/58%.
        const maxH = 0.72 * vh
        if (carH > maxH) {
          carH = maxH
          carW = carH * aspect
        }
        carWrap.style.width = `${Math.round(carW)}px`
        carWrap.style.height = `${Math.round(carH)}px`
        carWrap.style.top = `${Math.round(vh * 0.62 - carH / 2)}px`
        x0 = vw * NOSE_AT - carW // nose framed right-of-centre
        x1 = vw * TAIL_AT // rear wing framed left-of-centre
        return true
      }

      const apply = (prog: number) => {
        gsap.set(carWrap, {
          x: x0 + (x1 - x0) * prog,
          scale: 1.05 - 0.05 * prog,
          transformOrigin: '50% 60%',
        })
        // the plate drifts the same direction at a fraction of the rate —
        // the depth cue that makes it a camera move, not a sliding image
        if (plate) gsap.set(plate, { xPercent: -2.5 + 5 * prog })
        chapters.forEach((c, i) => {
          const [fi, hs, he, fo] = WINDOWS[i]
          let o = 0
          if (prog >= hs && prog <= he) o = 1
          else if (prog > fi && prog < hs) o = (prog - fi) / Math.max(0.001, hs - fi)
          else if (prog > he && prog < fo) o = 1 - (prog - he) / Math.max(0.001, fo - he)
          gsap.set(c, { autoAlpha: o, y: (1 - o) * 18 })
          if (o > 0.35) {
            values[i].forEach((v) => {
              if (v.done || !Number.isFinite(v.to)) return
              v.done = true
              const state = { n: 0 }
              gsap.to(state, {
                n: v.to,
                duration: 0.9,
                ease: 'power2.out',
                onUpdate: () => {
                  v.el.textContent = String(Math.round(state.n))
                },
              })
            })
            const bar = bars[i]
            if (bar && !bar.dataset.done) {
              bar.dataset.done = '1'
              gsap.fromTo(
                bar.children,
                { scaleX: 0 },
                { scaleX: 1, duration: 0.9, ease: 'power3.out' }
              )
            }
          }
        })
      }

      const ok = build()
      if (!ok) {
        img.addEventListener(
          'load',
          () => {
            if (build()) {
              gsap.set(carWrap, { autoAlpha: 1 })
              ScrollTrigger.refresh()
            }
          },
          { once: true }
        )
      } else {
        gsap.set(carWrap, { autoAlpha: 1 })
      }
      // init: chapters dark, counts zeroed
      chapters.forEach((c) => gsap.set(c, { autoAlpha: 0 }))
      values.flat().forEach((v) => {
        if (Number.isFinite(v.to)) v.el.textContent = '0'
      })

      const st = ScrollTrigger.create({
        trigger: section,
        start: 'top top',
        end: '+=320%',
        pin: true,
        // transform pinning is the established CLS fix on this site — see
        // the long rationale in DriversGallery: position:fixed pinning under
        // the fixed top bar scores a real layout shift on every engage.
        pinType: 'transform',
        anticipatePin: 1,
        scrub: 0.6,
        invalidateOnRefresh: true,
        onUpdate: (self) => apply(self.progress),
        onRefresh: (self) => {
          build()
          apply(self.progress)
        },
      })

      const ro = new ResizeObserver(() => {
        if (build()) ScrollTrigger.refresh()
      })
      ro.observe(section)

      return () => {
        ro.disconnect()
        st.kill()
        cleanups.forEach((fn) => fn())
      }
    },
    { scope: rootRef, dependencies: [view], revertOnUpdate: true }
  )

  // ── shared chapter content (rendered in both variants) ─────────────────
  const lineage = facts?.lineage ?? []
  const pairPct =
    a && b ? (a.points + b.points === 0 ? 50 : Math.min(97, Math.max(3, (a.points / (a.points + b.points)) * 100))) : 50

  const ChapterLineage = ({ glide }: { glide: boolean }) => (
    <div className={glide ? '' : 'px-6 md:px-14'}>
      <p className="section-header text-[var(--text-dim)]">THE LINEAGE</p>
      {facts ? (
        <>
          <p
            className="mt-4 leading-none text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: glide ? 'clamp(4rem, 7vw, 7.5rem)' : 'clamp(3.4rem, 12vw, 6rem)' }}
          >
            EST. {facts.founded}
          </p>
          {facts.firstSeason !== facts.founded && (
            <p className="label-mono mt-2 text-[var(--text-dim)]">IN F1 SINCE {facts.firstSeason}</p>
          )}
          {lineage.length > 0 && (
            <p className="label-mono mt-5 max-w-md leading-relaxed text-[var(--text-dim)]">
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
            <div className="mt-5">
              <p className="label-mono text-[var(--text-dim)]">
                {facts.titles.length} CONSTRUCTORS&rsquo; TITLE{facts.titles.length > 1 ? 'S' : ''}
              </p>
              <p className="mt-1 flex max-w-md flex-wrap gap-x-3 gap-y-1 font-mono text-[13px] tabular-nums" style={{ color: colour }}>
                {facts.titles.map((y) => (
                  <span key={y}>{y}</span>
                ))}
              </p>
            </div>
          )}
          <div className="label-mono mt-6 space-y-1.5 text-[var(--text-dim)]">
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
        </>
      ) : (
        <p className="label-mono mt-4 text-[var(--text-dim)]">NEW ENTRY — NO RECORDED LINEAGE</p>
      )}
    </div>
  )

  const ChapterPairing = ({ glide }: { glide: boolean }) => (
    <div className={glide ? '' : 'px-6 md:px-14'}>
      <p className="section-header text-[var(--text-dim)]">THE PAIRING</p>
      {a && b ? (
        <>
          <div className="mt-5 flex items-baseline justify-between gap-6">
            <TransitionLink
              href={`/drivers/${a.acronym.toLowerCase()}`}
              className="uppercase leading-none text-[var(--text)] transition-colors hover:text-[var(--accent)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.7rem, 2.6vw, 2.8rem)' }}
            >
              {a.surname}
            </TransitionLink>
            <TransitionLink
              href={`/drivers/${b.acronym.toLowerCase()}`}
              className="uppercase leading-none text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.7rem, 2.6vw, 2.8rem)' }}
            >
              {b.surname}
            </TransitionLink>
          </div>
          <div data-pair-bar className="mt-4 flex h-[8px] w-full" aria-hidden>
            <span className="origin-left" style={{ width: `${pairPct}%`, backgroundColor: colour }} />
            <span className="origin-right flex-1" style={{ backgroundColor: colour, opacity: 0.22 }} />
          </div>
          <div className="label-mono mt-3 flex items-baseline justify-between text-[var(--text-dim)]">
            <span className="font-mono text-xl tabular-nums text-[var(--text)]">
              <Slot v={a.points}>{glide ? <span data-mval data-to={a.points}>{a.points}</span> : <CountUp value={a.points} />}</Slot>
              <span className="label-mono ml-1.5 text-[var(--text-dim)]">PTS</span>
            </span>
            <span className="font-mono text-xl tabular-nums">
              <Slot v={b.points}>{glide ? <span data-mval data-to={b.points}>{b.points}</span> : <CountUp value={b.points} />}</Slot>
              <span className="label-mono ml-1.5">PTS</span>
            </span>
          </div>
          {view.pairing && (
            <div className="mt-8">
              <p className="label-mono text-[var(--text-dim)]">RACE HEAD-TO-HEAD</p>
              <p
                className="mt-1 leading-none text-[var(--text)]"
                style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 4.5vw, 4.6rem)' }}
              >
                {view.pairing.winsA}
                <span className="text-[var(--text-dim)]">&ndash;</span>
                {view.pairing.winsB}
              </p>
              <p className="label-mono mt-2 text-[var(--text-dim)]">
                ACROSS {pad2(view.pairing.bothClassified)} RACES WHERE BOTH CLASSIFIED
              </p>
            </div>
          )}
        </>
      ) : (
        <p className="label-mono mt-4 text-[var(--text-dim)]">DRIVER PAIRING UNAVAILABLE</p>
      )}
    </div>
  )

  const ChapterSeason = ({ glide }: { glide: boolean }) => (
    <div className={glide ? '' : 'px-6 md:px-14'}>
      <p className="section-header text-[var(--text-dim)]">THE SEASON{view.seasonYear ? ` — ${view.seasonYear}` : ''}</p>
      <div className="mt-5 flex flex-wrap items-end gap-x-10 gap-y-8">
        <div>
          <span
            className="font-mono tabular-nums leading-none text-[var(--text)]"
            style={{ fontSize: glide ? 'clamp(4rem, 7vw, 7rem)' : 'clamp(4rem, 14vw, 6.5rem)' }}
          >
            <Slot v={s.points}>{glide ? <span data-mval data-to={s.points}>{s.points}</span> : <CountUp value={s.points} />}</Slot>
          </span>
          <p className="label-mono mt-2 text-[var(--text-dim)]">POINTS</p>
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
              style={{ fontSize: 'clamp(1.9rem, 3vw, 3rem)' }}
            >
              <Slot v={value}>{glide ? <span data-mval data-to={value}>{value}</span> : <CountUp value={value} />}</Slot>
            </span>
            <p className="label-mono mt-2 text-[var(--text-dim)]">{label}</p>
          </div>
        ))}
        {s.bestFinish !== null && (
          <div>
            <span
              className="leading-none"
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(1.9rem, 3vw, 3rem)',
                color: s.bestFinish === 1 ? 'var(--accent)' : 'var(--text)',
              }}
            >
              P{s.bestFinish}
            </span>
            <p className="label-mono mt-2 text-[var(--text-dim)]">BEST FINISH</p>
          </div>
        )}
      </div>
      {s.biggestHaul && (
        <p className="label-mono mt-7 text-[var(--text-dim)]">
          BIGGEST HAUL{' '}
          <span className="font-mono text-base tabular-nums text-[var(--text)]">+{s.biggestHaul.points}</span>{' '}
          — {s.biggestHaul.circuit.toUpperCase()} · R{pad2(s.biggestHaul.round)}
        </p>
      )}
    </div>
  )

  return (
    <div ref={rootRef} className="overflow-x-clip">
      {/* ─── hero: arrival over the tinted garage ─── */}
      <section
        data-hero
        className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-16 pt-8 md:px-14"
      >
        <Garage colour={colour} />
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

      {/* ─── THE GLIDE (desktop, motion allowed) ─── */}
      <section
        ref={glideRef}
        className="relative hidden h-[100dvh] overflow-hidden md:motion-safe:block"
        aria-label={`${view.name} — the machine`}
      >
        <Garage colour={colour} parallax />

        {/* constructor numeral sunk behind the car */}
        <span
          aria-hidden
          className="outline-numeral absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 leading-none opacity-70"
          style={{ fontSize: 'clamp(16rem, 34vw, 30rem)', WebkitTextStroke: '1.6px rgba(245,245,243,0.10)' }}
        >
          {pad2(view.position)}
        </span>

        {/* THE CAR — hi-res render, camera-driven, transform only.
            Graded like the blueprint's settled state; not TreatedImage
            because the glide owns this element's transform and the wrapper
            pattern would put the filter a layer too high for calibration. */}
        {car && (
          <div data-car aria-hidden className="absolute left-0" style={{ opacity: 0, transform: 'translateX(-55%)' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              data-car-img
              src={car}
              alt=""
              decoding="async"
              fetchPriority="high"
              className="h-full w-full object-contain"
              style={{ filter: CAR_LIT }}
            />
          </div>
        )}

        {/* chapters — anchored to the negative space around each region.
            Each carries a soft radial scrim (light falloff, not a card) so
            type stays legible even where a white livery slides beneath. */}
        {(
          [
            ['left-[6%] top-[10%] w-[34rem] max-w-[38vw]', <ChapterLineage key="l" glide />],
            ['right-[6%] top-[9%] w-[34rem] max-w-[40vw]', <ChapterPairing key="p" glide />],
            ['left-[6%] bottom-[9%] w-[40rem] max-w-[44vw]', <ChapterSeason key="s" glide />],
          ] as const
        ).map(([cls, node], i) => (
          <div key={i} data-chapter className={`absolute ${cls}`} style={{ opacity: 0 }}>
            <div
              aria-hidden
              className="absolute -inset-10 -z-10"
              style={{
                background:
                  'radial-gradient(85% 85% at 40% 35%, rgba(10,10,10,0.72), rgba(10,10,10,0.35) 55%, transparent 78%)',
              }}
            />
            {node}
          </div>
        ))}
      </section>

      {/* ─── stacked variant: mobile always, desktop under reduced motion ─── */}
      <div className="md:motion-safe:hidden">
        {car && (
          <section className="relative overflow-hidden border-t border-[var(--line)] py-10">
            <Garage colour={colour} />
            <div className="relative mx-auto w-[96%]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img data-car-img src={car} alt="" decoding="async" className="w-full object-contain" style={{ filter: CAR_LIT }} />
            </div>
          </section>
        )}
        <section className="relative border-t border-[var(--line)] py-16">
          <FadeUp>
            <ChapterLineage glide={false} />
          </FadeUp>
        </section>
        <section className="relative border-t border-[var(--line)] py-16">
          <FadeUp>
            <ChapterPairing glide={false} />
          </FadeUp>
        </section>
        <section className="relative border-t border-[var(--line)] py-16">
          <FadeUp>
            <ChapterSeason glide={false} />
          </FadeUp>
        </section>
      </div>

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
            P{view.position} — {s.points} POINTS
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
