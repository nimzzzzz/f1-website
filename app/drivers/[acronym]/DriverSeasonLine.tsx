'use client'

import { useMemo, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { DRIVER_PHOTOS, CAREER_STATS, DRIVER_NATIONALITIES } from '@/lib/driver-data'
import { driverImage, carImage, circuitImage } from '@/lib/media-manifest'
import { teamToSlug } from '@/lib/team-data'
import { toDriverSeason, type DriverSeasonView, type SeasonStation } from '@/lib/season-view'
import { useLiveSnapshot } from '@/lib/use-live-snapshot'
import TreatedImage from '@/components/media/TreatedImage'
import { CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// THE SEASON LINE — the driver's season IS the page. Every finishing
// position becomes a lateral coordinate on one continuous team-colour line
// running down the page (left = P1, right = P20, retirements pushed past the
// P20 edge), so every driver's page is physically shaped differently because
// the shape is their season. The line draws itself tied to scroll progress
// with a bright marker riding the drawn tip; each round is a station that
// composes the moment the tip reaches it.
//
// Identity and stations are SSR'd by page.tsx from the season bundle
// (static + ISR); this component owns the interaction layer, plus the
// client-side convergence onto a fresher snapshot (useLiveSnapshot —
// re-derived through the same toDriverSeason, keyed by acronym).

const pad2 = (n: number) => String(n).padStart(2, '0')

const LIGHT_REST = 0.15
const GAP = 26 // px of visible break on each side of an out station's anchor
const LEAD = 64 // lead-in above the first anchor

// Lateral encoding. Out stations sit just PAST the P20 edge — off the scale,
// which is what a retirement is.
function posToX(position: number | null, mobile: boolean, out: boolean): number {
  if (out) return mobile ? 47 : 96
  const p = Math.min(20, Math.max(1, position ?? 20))
  const f = (p - 1) / 19
  return mobile ? 8 + f * 38 : 6 + f * 88
}

function stationColor(s: SeasonStation): string {
  if (s.status !== 'finished') return 'var(--text-dim)'
  if (s.position === 1) return 'var(--accent)'
  return 'var(--text)'
}

// Explicit locale + UTC so the SSR string and the hydrated string are
// byte-identical regardless of server/visitor locale and timezone.
function shortDate(iso: string): string {
  return new Date(iso)
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' })
    .toUpperCase()
}

export default function DriverSeasonLine({ view: ssrView }: { view: DriverSeasonView }) {
  const fresher = useLiveSnapshot(ssrView.computedAt)
  const view = useMemo(() => {
    if (!fresher) return ssrView
    return toDriverSeason(fresher, ssrView.driver.acronym) ?? ssrView
  }, [fresher, ssrView])

  const d = view.driver
  const teamColor = `#${d.teamColour || 'F5F5F3'}`
  const photo = driverImage(d.acronym) ?? DRIVER_PHOTOS[d.acronym] ?? null
  const car = carImage(teamToSlug(d.teamName))
  const career = CAREER_STATS[d.acronym]
  const nationality = DRIVER_NATIONALITIES[d.acronym] ?? d.countryCode ?? ''

  const drawn = view.stations.filter((s) => s.status === 'finished' || s.status === 'out')
  const completed = drawn.length

  const rootRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLElement>(null)
  const fieldRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  // ── hero arrival: the launch-night light, tuned for a person ───────────
  useGSAP(
    () => {
      const hero = heroRef.current
      if (!hero) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const light = hero.querySelector('[data-hero-light]')
      const photoEl = hero.querySelector('[data-hero-photo]')
      const num = hero.querySelector('[data-hero-number]')
      const title = hero.querySelector('[data-hero-title]')

      const tl = gsap.timeline()
      if (light) {
        tl.fromTo(
          light,
          { autoAlpha: 0, yPercent: 40 },
          { autoAlpha: 0.5, yPercent: 0, duration: 0.9, ease: 'power2.out' },
          0
        ).to(light, { autoAlpha: LIGHT_REST, duration: 0.8, ease: 'power2.inOut' }, 0.9)
      }
      if (photoEl) {
        tl.fromTo(
          photoEl,
          { autoAlpha: 0, filter: 'brightness(0.05)' },
          { autoAlpha: 1, filter: 'brightness(1)', duration: 1.0, ease: 'power3.out' },
          0.1
        )
      }
      if (num) {
        tl.fromTo(
          num,
          { autoAlpha: 0, scale: 1.04, transformOrigin: '80% 50%' },
          { autoAlpha: 0.55, scale: 1, duration: 1.1, ease: 'power3.out' },
          0.05
        )
      }
      if (title) {
        tl.fromTo(
          title,
          { autoAlpha: 0, y: 26 },
          { autoAlpha: 1, y: 0, duration: 0.8, ease: 'power3.out' },
          0.25
        )
      }
    },
    { scope: heroRef }
  )

  // ── the line: geometry, scroll-draw, station reveals ───────────────────
  useGSAP(
    () => {
      const field = fieldRef.current
      const svg = svgRef.current
      if (!field || !svg) return

      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const rows = gsap.utils.toArray<HTMLElement>('[data-station]', field)
      const tallRows = rows.filter(
        (r) => r.dataset.status === 'finished' || r.dataset.status === 'out'
      )
      const drawPaths = gsap.utils.toArray<SVGPathElement>('[data-line-draw]', svg)
      const blurPath = svg.querySelector<SVGPathElement>('[data-line-blur]')
      const core = svg.querySelector<SVGPathElement>('[data-line-core]')
      const marker = svg.querySelector<SVGGElement>('[data-marker]')

      // Geometry state lives across rebuilds (resize) but resets when the
      // view changes. The scrub maps scroll to the tip's Y POSITION, not to
      // arc length: y-per-arc is nonlinear (curves add length without
      // descending, out-station gaps add descent without length), and an
      // arc-linear scrub measurably left the tip ~380px above the reading
      // line mid-page — the viewer stared at unrevealed rows. ys[] is the
      // sampled y-at-arc table used to invert y → arc each frame.
      const N = 800
      let ys: number[] = []
      let anchorYs: number[] = []
      let total = 0
      let lastProg = 0
      const revealed = tallRows.map(() => false)

      const build = () => {
        const W = field.clientWidth
        const mobile = window.matchMedia('(max-width: 767px)').matches
        type Anchor = { x: number; y: number; out: boolean }
        const anchors: Anchor[] = tallRows.map((row) => ({
          x:
            (parseFloat(mobile ? row.dataset.xm ?? '50' : row.dataset.x ?? '50') / 100) * W,
          y: row.offsetTop + row.offsetHeight / 2,
          out: row.dataset.status === 'out',
        }))
        if (anchors.length < 2) return false

        // Sub-paths broken at out stations: the line arrives GAP short of the
        // anchor, and the next sub-path resumes GAP past it.
        const seg: string[] = []
        let dStr = ''
        const flush = () => {
          if (seg.length) dStr += seg.join(' ') + ' '
          seg.length = 0
        }
        const curveTo = (from: { x: number; y: number }, to: { x: number; y: number }) => {
          const c = (to.y - from.y) * 0.45
          return `C ${from.x} ${from.y + c} ${to.x} ${to.y - c} ${to.x} ${to.y}`
        }
        let prev: { x: number; y: number } | null = null
        anchors.forEach((a) => {
          if (!prev) {
            seg.push(`M ${a.x} ${a.y - LEAD}`, `L ${a.x} ${a.y}`)
            prev = { x: a.x, y: a.y }
          } else {
            const target = a.out ? { x: a.x, y: a.y - GAP } : { x: a.x, y: a.y }
            seg.push(curveTo(prev, target))
            prev = target
          }
          if (a.out) {
            flush()
            seg.push(`M ${a.x} ${a.y + GAP}`)
            prev = { x: a.x, y: a.y + GAP }
          }
        })
        flush()

        drawPaths.forEach((p) => p.setAttribute('d', dStr))
        blurPath?.setAttribute('d', dStr)
        if (!core) return false
        total = core.getTotalLength()

        // y is monotonic down the page (curves never rise), so y-at-arc is
        // invertible by binary search over one sampled table.
        ys = Array.from({ length: N + 1 }, (_, k) => core.getPointAtLength((k / N) * total).y)
        anchorYs = anchors.map((a) => (a.out ? a.y - GAP : a.y))
        return true
      }

      // Arc fraction whose point sits at y — the inverse of ys[].
      const arcAtY = (y: number) => {
        if (y <= ys[0]) return 0
        if (y >= ys[N]) return 1
        let lo = 0
        let hi = N
        while (hi - lo > 1) {
          const m = (lo + hi) >> 1
          if (ys[m] <= y) lo = m
          else hi = m
        }
        const span = ys[hi] - ys[lo]
        return (lo + (span > 0 ? (y - ys[lo]) / span : 0)) / N
      }

      // Dash writes go to the style directly, not through gsap.set: GSAP's
      // CSS plugin rounds per-frame set() values to whole pixels, and on a
      // pathLength=1 path the only whole values are 1 (undrawn) and 0
      // (fully drawn) — observed live as the line snapping instead of
      // drawing. A plain number is valid CSS for stroke-dashoffset.
      const setDash = (v: number) => {
        drawPaths.forEach((p) => {
          p.style.strokeDashoffset = String(v)
        })
      }

      const placeMarker = (arcFrac: number) => {
        if (!marker || !core || total === 0) return
        const pt = core.getPointAtLength(Math.max(0, Math.min(1, arcFrac)) * total)
        gsap.set(marker, { x: pt.x, y: pt.y })
      }

      // One scroll progress value drives everything, through the tip's y:
      // dash clip, glow bloom, marker, and which stations have composed.
      const applyProgress = (prog: number, instantReveals = false) => {
        lastProg = prog
        const yT = ys[0] + prog * (ys[N] - ys[0])
        const s = arcAtY(yT)
        setDash(1 - s)
        if (blurPath) gsap.set(blurPath, { opacity: 0.4 * prog })
        if (marker) gsap.set(marker, { autoAlpha: prog > 0.004 ? 1 : 0 })
        placeMarker(s)
        // Stations compose as the tip reaches their anchor; scrubbing back
        // does not un-compose (the season happened — only the drawing
        // rewinds).
        anchorYs.forEach((ay, i) => {
          if (yT >= ay - 2) revealStation(i, instantReveals)
        })
      }

      const revealStation = (i: number, instant: boolean) => {
        if (revealed[i]) return
        revealed[i] = true
        const row = tallRows[i]
        const inner = row.querySelector('[data-ghost-inner]')
        const dot = row.querySelector('[data-dot]')
        const pts = row.querySelector<HTMLElement>('[data-pts]')
        const to = pts ? Number(pts.dataset.to) : NaN
        if (instant) {
          if (inner) gsap.set(inner, { autoAlpha: 1, y: 0 })
          if (dot) gsap.set(dot, { scale: 1, autoAlpha: 1 })
          if (pts && Number.isFinite(to)) pts.textContent = String(to)
          return
        }
        const tl = gsap.timeline()
        if (dot) {
          tl.fromTo(
            dot,
            { scale: 0, autoAlpha: 0 },
            { scale: 1, autoAlpha: 1, duration: 0.3, ease: 'back.out(2.6)' },
            0
          )
        }
        if (inner) {
          tl.fromTo(
            inner,
            { autoAlpha: 0, y: 16 },
            { autoAlpha: 1, y: 0, duration: 0.45, ease: 'power2.out' },
            0.05
          )
        }
        if (pts && Number.isFinite(to)) {
          const state = { n: 0 }
          tl.to(state, {
            n: to,
            duration: 0.6,
            ease: 'power2.out',
            onUpdate: () => {
              pts.textContent = String(Math.round(state.n))
            },
          }, 0.1)
        }
      }

      const ok = build()

      // ── reduced motion (or a season too short to draw): everything
      //    composed and static — line drawn, glow settled, numbers final.
      //    SSR markup is already the settled state; only the JS-built path
      //    and marker need placing.
      if (reduced || !ok) {
        setDash(0)
        if (blurPath) gsap.set(blurPath, { opacity: 0.4 })
        if (marker && ok) {
          gsap.set(marker, { autoAlpha: 1 })
          placeMarker(1)
        } else if (marker) {
          gsap.set(marker, { autoAlpha: 0 })
        }
        return
      }

      // init: line undrawn, glow dark, marker hidden, stations unrevealed
      setDash(1)
      if (blurPath) gsap.set(blurPath, { opacity: 0 })
      if (marker) gsap.set(marker, { autoAlpha: 0 })
      tallRows.forEach((row) => {
        const inner = row.querySelector('[data-ghost-inner]')
        const dot = row.querySelector('[data-dot]')
        const pts = row.querySelector<HTMLElement>('[data-pts]')
        if (inner) gsap.set(inner, { autoAlpha: 0, y: 16 })
        if (dot) gsap.set(dot, { scale: 0, autoAlpha: 0 })
        if (pts && pts.dataset.to) pts.textContent = '0'
      })
      // compact rows (upcoming / cancelled / absent) get a plain fade-up;
      // their resting opacity lives on the row, the inner animates to 1.
      rows
        .filter((r) => !tallRows.includes(r))
        .forEach((row) => {
          const inner = row.querySelector('[data-ghost-inner]')
          if (!inner) return
          gsap.fromTo(
            inner,
            { autoAlpha: 0, y: 12 },
            {
              autoAlpha: 1,
              y: 0,
              duration: 0.6,
              ease: 'power2.out',
              scrollTrigger: { trigger: row, start: 'top 90%', once: true },
            }
          )
        })

      // The scrub is anchored to the LINE's own first and last y, not the
      // field box: the field ends with ghost rows the line never reaches,
      // and a field-spanning scrub made the tip fall behind the scroll at a
      // fixed rate (measured ~0.19px per scrolled px — by mid-page the tip
      // sat ~400px above the station the viewer was reading). Pinning both
      // ends to the 62% reading line keeps the tip exactly where the eye
      // is for the whole ride.
      const st = ScrollTrigger.create({
        trigger: field,
        start: () => `top+=${ys[0]} 62%`,
        end: () => `top+=${ys[N]} 62%`,
        scrub: 0.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => applyProgress(self.progress),
      })

      const ro = new ResizeObserver(() => {
        if (build()) {
          applyProgress(lastProg, true)
          ScrollTrigger.refresh()
        }
      })
      ro.observe(field)

      return () => {
        ro.disconnect()
        st.kill()
      }
    },
    // revertOnUpdate is essential: when the client refresh lands a fresher
    // snapshot, `view` changes and this callback re-runs. The useGSAP
    // default (false) would leave the previous run's ScrollTrigger alive —
    // two scrubs then fight over stroke-dashoffset with different cached
    // geometry, which showed up as a fully-drawn line under a mid-path
    // marker. Reverting kills the old trigger (and runs the cleanup above)
    // before the re-run builds the new one.
    { scope: rootRef, dependencies: [view], revertOnUpdate: true }
  )

  // ── duel bar: both halves grow from their own ends on scroll-in ────────
  useGSAP(
    () => {
      const root = rootRef.current
      if (!root) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const mine = root.querySelector('[data-duel-mine]')
      const theirs = root.querySelector('[data-duel-theirs]')
      if (!mine || !theirs) return
      gsap.fromTo(
        [mine, theirs],
        { scaleX: 0 },
        {
          scaleX: 1,
          duration: 0.9,
          ease: 'power3.out',
          scrollTrigger: { trigger: mine, start: 'top 85%', once: true },
        }
      )
    },
    { scope: rootRef, dependencies: [view.duel?.acronym], revertOnUpdate: true }
  )

  // Content side: toward the free half, so the block never sits on the line.
  const sideOf = (s: SeasonStation) =>
    posToX(s.position, false, s.status === 'out') <= 50 ? 'right' : 'left'

  return (
    <div ref={rootRef} className="overflow-x-clip">
      {/* ─── SECTION 1 · arrival hero ─── */}
      <section
        ref={heroRef}
        className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-16 pt-8 md:px-14"
      >
        {/* the light that unveils the composition, then settles as ambience */}
        <div
          data-hero-light
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[72%]"
          style={{
            background: `linear-gradient(to top, ${teamColor} 0%, ${teamColor}59 26%, transparent 62%)`,
            opacity: LIGHT_REST,
          }}
        />

        {photo && (
          <div data-hero-photo className="pointer-events-none absolute right-0 top-0 h-full w-[62%] md:w-[42%]">
            <TreatedImage
              src={photo}
              treatment="mono"
              priority
              sizes="(min-width: 768px) 42vw, 62vw"
              className="absolute inset-0"
            />
          </div>
        )}

        {/* race number — identical grammar to the gallery panel it arrives from */}
        <span
          data-hero-number
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
          {d.number}
        </span>

        <TransitionLink
          href="/drivers"
          className="strip-header absolute left-6 top-8 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] md:left-14"
        >
          &larr; THE GRID
        </TransitionLink>

        <div data-hero-title className="relative">
          <p className="label-mono mb-3 text-[var(--text-dim)]">{d.firstName.toUpperCase()}</p>
          <h1
            className="uppercase leading-[0.85] text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 11vw, 11rem)' }}
          >
            {d.surname}
          </h1>
          <div className="label-mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-[2px] w-3" style={{ backgroundColor: teamColor }} />
              {d.teamName.toUpperCase()}
            </span>
            {nationality && <span>{nationality.toUpperCase()}</span>}
            <span>#{d.number}</span>
            <span className="text-[var(--text)]">CHAMPIONSHIP P{d.position}</span>
          </div>
        </div>
      </section>

      {/* ─── SECTION 2 · THE SEASON LINE ─── */}
      <section className="relative border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-28">
        <FadeUp>
          <p className="section-header text-[var(--text-dim)]">
            THE SEASON LINE — {pad2(completed)} ROUNDS RUN
          </p>
          <p className="label-mono mt-3 text-[var(--text-dim)] opacity-60">
            LATERAL POSITION = FINISHING POSITION · P1 LEFT — P20 RIGHT
          </p>
        </FadeUp>

        <div ref={fieldRef} className="relative mt-16">
          <svg
            ref={svgRef}
            aria-hidden
            className="pointer-events-none absolute inset-0 h-full w-full overflow-visible"
          >
            {/* glow bloom — not dash-drawn; its opacity follows the draw */}
            <path
              data-line-blur
              fill="none"
              stroke={teamColor}
              strokeWidth={16}
              style={{ filter: 'blur(10px)' }}
              opacity={0.4}
            />
            <path
              data-line-draw
              fill="none"
              stroke={teamColor}
              strokeWidth={7}
              opacity={0.2}
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={0}
            />
            <path
              data-line-draw
              data-line-core
              fill="none"
              stroke={teamColor}
              strokeWidth={2.5}
              strokeLinecap="round"
              pathLength={1}
              strokeDasharray={1}
              strokeDashoffset={0}
            />
            {/* the tip — a bright point riding the drawn end of the line */}
            <g data-marker>
              <circle r={11} fill={teamColor} opacity={0.3} />
              <circle r={4.5} fill="#FFFFFF" />
            </g>
          </svg>

          {view.stations.map((s, idx) => {
            const tall = s.status === 'finished' || s.status === 'out'
            if (!tall) {
              // ghost stations: upcoming ahead, cancelled struck in sequence
              const label =
                s.status === 'cancelled'
                  ? 'CANCELLED'
                  : s.status === 'absent'
                    ? 'NOT ENTERED'
                    : shortDate(s.date)
              return (
                <div
                  key={s.round}
                  data-station
                  data-status={s.status}
                  className="relative flex h-14 items-center md:h-16"
                  style={{ opacity: s.status === 'cancelled' ? 0.3 : 0.38 }}
                >
                  <div data-ghost-inner className="flex w-full items-baseline gap-4 md:gap-6">
                    <span
                      className="outline-numeral w-10 shrink-0 leading-none"
                      style={{ fontFamily: 'var(--font-display)', fontSize: '1.4rem' }}
                    >
                      {pad2(s.round)}
                    </span>
                    <span
                      className={`min-w-0 flex-1 truncate uppercase leading-none text-[var(--text)] ${
                        s.status === 'cancelled' ? 'line-through decoration-1' : ''
                      }`}
                      style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.1rem, 1.8vw, 1.5rem)' }}
                    >
                      {s.circuit}
                    </span>
                    <span className="label-mono shrink-0 text-[var(--text-dim)]">{label}</span>
                  </div>
                </div>
              )
            }

            const out = s.status === 'out'
            const xd = posToX(s.position, false, out)
            const xm = posToX(s.position, true, out)
            const side = sideOf(s)
            const icon = circuitImage(s.country)
            const posColor = stationColor(s)
            return (
              <div
                key={s.round}
                data-station
                data-status={s.status}
                data-x={xd}
                data-xm={xm}
                className="relative h-[300px] md:h-[340px]"
                style={{ '--x': `${xd}%`, '--xm': `${xm}%` } as React.CSSProperties}
              >
                {/* anchor dot — sits exactly on the line's station point */}
                <span
                  data-dot
                  aria-hidden
                  className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 left-[var(--xm)] md:left-[var(--x)]"
                  style={{
                    backgroundColor: 'var(--bg)',
                    borderColor: out ? 'rgba(245,245,243,0.35)' : s.position === 1 ? 'var(--accent)' : teamColor,
                  }}
                />

                <div
                  data-ghost-inner
                  className={
                    side === 'right'
                      ? 'absolute top-1/2 -translate-y-1/2 left-[52%] right-0 md:left-[calc(var(--x)+44px)] md:right-0 md:max-w-[520px]'
                      : 'absolute top-1/2 -translate-y-1/2 left-[52%] right-0 md:left-auto md:right-[calc(100%-var(--x)+44px)] md:max-w-[520px] md:text-right'
                  }
                  style={out ? { opacity: 0.35 } : undefined}
                >
                  {/* circuit line-art, faint behind the station block */}
                  {icon && (
                    <TreatedImage
                      src={icon}
                      treatment="line"
                      fade={false}
                      position="center"
                      sizes="180px"
                      className={`pointer-events-none absolute -top-10 h-28 w-40 opacity-25 ${
                        side === 'right' ? 'right-0' : 'left-0'
                      } hidden md:block`}
                    />
                  )}

                  <p
                    className={`relative flex items-baseline gap-3 ${
                      side === 'left' ? 'md:justify-end' : ''
                    }`}
                  >
                    <span
                      className="outline-numeral leading-none"
                      style={{ fontFamily: 'var(--font-display)', fontSize: '1.5rem' }}
                    >
                      {pad2(s.round)}
                    </span>
                    <span
                      className={`uppercase leading-none text-[var(--text)] ${
                        out ? 'line-through decoration-1' : ''
                      }`}
                      style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.3rem, 2vw, 1.9rem)' }}
                    >
                      {s.circuit}
                    </span>
                  </p>

                  {out ? (
                    <p className="label-mono relative mt-4 text-base text-[var(--text-dim)]">
                      {s.outLabel ?? 'DNF'}
                    </p>
                  ) : (
                    <p
                      className="relative mt-1 leading-none"
                      style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 'clamp(3.2rem, 7vw, 6.4rem)',
                        color: posColor,
                      }}
                    >
                      P{s.position ?? '—'}
                    </p>
                  )}

                  <p className="label-mono relative mt-3 text-[var(--text-dim)]">
                    {s.points > 0 ? (
                      <>
                        +<span data-pts data-to={s.points}>{s.points}</span> PTS
                      </>
                    ) : (
                      <span className="opacity-60">0 PTS</span>
                    )}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* ─── SECTION 3 · stat monument ─── */}
      <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-28">
        <FadeUp>
          <p className="section-header mb-14 text-[var(--text-dim)]">THE NUMBERS</p>
        </FadeUp>
        <div className="flex flex-wrap items-end gap-x-16 gap-y-12 md:gap-x-24">
          <div>
            <span
              className="font-mono tabular-nums leading-none text-[var(--text)]"
              style={{ fontSize: 'clamp(5.5rem, 13vw, 12rem)' }}
            >
              <CountUp value={d.points} />
            </span>
            <p className="label-mono mt-3 text-[var(--text-dim)]">
              POINTS{view.seasonYear ? ` — ${view.seasonYear}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-x-12 gap-y-10 pb-2 md:gap-x-16">
            {(
              [
                ['WINS', d.wins],
                ['PODIUMS', d.podiums],
                ['DNFS', view.dnfs],
              ] as const
            ).map(([label, value]) => (
              <div key={label}>
                <span
                  className="font-mono tabular-nums leading-none text-[var(--text)]"
                  style={{ fontSize: 'clamp(2.4rem, 5vw, 4.4rem)' }}
                >
                  <CountUp value={value} />
                </span>
                <p className="label-mono mt-3 text-[var(--text-dim)]">{label}</p>
              </div>
            ))}
            {view.bestFinish !== null && (
              <div>
                <span
                  className="leading-none"
                  style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 'clamp(2.4rem, 5vw, 4.4rem)',
                    color: view.bestFinish === 1 ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  P{view.bestFinish}
                </span>
                <p className="label-mono mt-3 text-[var(--text-dim)]">BEST FINISH</p>
              </div>
            )}
          </div>
        </div>

        {career && (
          <div className="label-mono mt-16 flex max-w-3xl flex-wrap gap-x-10 gap-y-3 border-t border-[var(--line)] pt-6 text-[var(--text-dim)]">
            {(
              [
                ['GRANDS PRIX', career.grandsPrix],
                ['WORLD TITLES', career.championships],
                ['CAREER WINS', career.wins],
                ['CAREER PODIUMS', career.podiums],
                ['POLES', career.poles],
                ['CAREER POINTS', career.points],
              ] as const
            ).map(([label, value]) => (
              <span key={label}>
                {label}{' '}
                <span
                  className="font-mono tabular-nums"
                  style={{ color: value > 0 ? 'var(--text)' : 'var(--text-dim)' }}
                >
                  {value}
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ─── SECTION 4 · THE DUEL ─── */}
      {view.duel && (
        <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-28">
          <FadeUp>
            <p className="section-header mb-14 text-[var(--text-dim)]">
              THE DUEL — TEAMMATE HEAD-TO-HEAD
            </p>
          </FadeUp>

          <div className="flex items-baseline justify-between gap-6">
            <span
              className="uppercase leading-none text-[var(--text)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3.6rem)' }}
            >
              {d.surname}
            </span>
            <TransitionLink
              href={`/drivers/${view.duel.acronym.toLowerCase()}`}
              className="uppercase leading-none text-[var(--text-dim)] transition-colors hover:text-[var(--accent)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.8rem, 4vw, 3.6rem)' }}
            >
              {view.duel.surname}
            </TransitionLink>
          </div>

          {/* the intra-team war as one bar — the wider half is winning */}
          {(() => {
            const { myPoints, theirPoints } = view.duel!
            const sum = myPoints + theirPoints
            const myPct = sum === 0 ? 50 : Math.min(97, Math.max(3, (myPoints / sum) * 100))
            return (
              <div className="mt-6">
                <div className="flex h-[10px] w-full" aria-hidden>
                  <span
                    data-duel-mine
                    className="origin-left"
                    style={{ width: `${myPct}%`, backgroundColor: teamColor }}
                  />
                  <span
                    data-duel-theirs
                    className="origin-right flex-1"
                    style={{ backgroundColor: teamColor, opacity: 0.22 }}
                  />
                </div>
                <div className="label-mono mt-4 flex items-baseline justify-between text-[var(--text-dim)]">
                  <span className="font-mono text-2xl tabular-nums text-[var(--text)]">
                    <CountUp value={myPoints} />
                    <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
                  </span>
                  <span className="font-mono text-2xl tabular-nums">
                    <CountUp value={theirPoints} />
                    <span className="label-mono ml-2">PTS</span>
                  </span>
                </div>
              </div>
            )
          })()}

          <div className="mt-16">
            <p className="label-mono text-[var(--text-dim)]">RACE HEAD-TO-HEAD</p>
            <p
              className="mt-2 leading-none text-[var(--text)]"
              style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 9vw, 8rem)' }}
            >
              {view.duel.raceWins}
              <span className="text-[var(--text-dim)]">–</span>
              {view.duel.raceLosses}
            </p>
            <p className="label-mono mt-3 text-[var(--text-dim)]">
              ACROSS {pad2(view.duel.bothClassified)} RACES WHERE BOTH CLASSIFIED
            </p>
          </div>
        </section>
      )}

      {/* ─── SECTION 5 · the car ─── */}
      {car && (
        <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-24">
          <FadeUp>
            <p className="section-header mb-10 text-[var(--text-dim)]">
              THE CAR — {d.teamName.toUpperCase()}
            </p>
          </FadeUp>
          <div className="relative max-w-5xl">
            <span
              aria-hidden
              className="absolute -top-4 left-0 h-[2px] w-16 md:w-24"
              style={{ backgroundColor: teamColor }}
            />
            <TreatedImage
              src={car}
              treatment="team"
              aspect="21/9"
              position="center"
              sizes="(min-width: 768px) 70vw, 100vw"
              className="w-full"
            />
          </div>
        </section>
      )}
    </div>
  )
}
