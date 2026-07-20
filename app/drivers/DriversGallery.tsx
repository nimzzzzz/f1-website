'use client'

import { useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import { driverImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'
import { TransitionLink } from '@/components/motion/TransitionProvider'

gsap.registerPlugin(ScrollTrigger, useGSAP)

// One gallery panel, championship-ordered — identity comes from the server
// bundle (SSR'd by app/drivers/page.tsx), so panel 1 and its headshot are in
// the initial HTML. This component only owns the interaction layer: the
// pinned horizontal scrub, the progress rail, hover states.
export interface GalleryDriver {
  driverNumber: number
  firstName: string
  surname: string
  teamName: string
  teamColour: string
  nameAcronym: string
  countryCode: string | null
  points: number
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function DriversGallery({ drivers }: { drivers: GalleryDriver[] }) {
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
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px) and (hover: hover)', () => {
        const distance = () => Math.max(0, track.scrollWidth - viewport.clientWidth)
        let lastIdx = -1
        const setPanel = (progress: number) => {
          if (!rail) return
          const idx = Math.min(drivers.length - 1, Math.round(progress * (drivers.length - 1)))
          if (idx === lastIdx) return
          lastIdx = idx
          const counter = rail.querySelector<HTMLElement>('[data-rail-counter]')
          if (counter) counter.textContent = `${pad2(idx + 1)} / ${pad2(drivers.length)}`
          rail.querySelectorAll<HTMLElement>('[data-tick]').forEach((t, i) => {
            t.style.backgroundColor =
              i === idx ? `#${drivers[i]?.teamColour || 'F5F5F3'}` : 'rgba(245,245,243,0.18)'
            t.style.transform = i === idx ? 'scaleY(1.8)' : 'scaleY(1)'
          })
        }
        gsap.fromTo(
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
              scrub: 0.5,
              invalidateOnRefresh: true,
              onUpdate: (st) => setPanel(st.progress),
              onRefresh: (st) => setPanel(st.progress),
            },
          }
        )
      })
      return () => mm.revert()
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
          className="flex w-full flex-col md:w-max md:flex-row motion-reduce:md:w-full motion-reduce:md:flex-col"
        >
          {drivers.map((d, i) => {
            const teamColor = `#${d.teamColour || 'F5F5F3'}`
            const photo = driverImage(d.nameAcronym)
            return (
              <TransitionLink
                key={d.driverNumber}
                href={`/drivers/${d.nameAcronym.toLowerCase()}`}
                className="group relative flex min-h-[72vh] w-full shrink-0 flex-col justify-end overflow-hidden border-t border-[var(--line)] px-6 pb-16 pt-10 md:min-h-[calc(100dvh-11rem)] md:w-screen md:border-l md:border-t-0 md:px-14 motion-reduce:md:w-full motion-reduce:md:border-l-0 motion-reduce:md:border-t"
              >
                {/* headshot — dark-treated atmosphere; the number paints above it.
                    Panel 1 is the LCP: priority puts its preload in the SSR HTML. */}
                {photo && (
                  <TreatedImage
                    src={photo}
                    treatment="mono"
                    priority={i === 0}
                    sizes="(min-width: 768px) 36vw, 72vw"
                    className="pointer-events-none absolute bottom-0 right-0 h-[58%] w-[72%] md:right-[8vw] md:h-[76%] md:w-[36vw] md:max-w-[560px]"
                  />
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
        className="absolute inset-x-6 bottom-6 z-10 hidden items-center gap-4 md:inset-x-14 md:flex motion-reduce:md:hidden"
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
