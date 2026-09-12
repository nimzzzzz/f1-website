'use client'

import { type RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function useScheduleMotion(ref: RefObject<HTMLDivElement | null>, calendarKey: string) {
  useGSAP(() => {
    const timeline = ref.current
    if (!timeline || !calendarKey) return
    const rounds = gsap.utils.toArray<HTMLElement>('.schedule-round', timeline)
    const line = timeline.querySelector('.schedule-progress')
    const media = gsap.matchMedia()

    media.add({
      reduce: '(prefers-reduced-motion: reduce)',
      desktop: '(min-width: 768px) and (pointer: fine)',
      all: '(min-width: 0px)',
    }, (context) => {
      if (context.conditions?.reduce) return

      // Equal viewport anchors keep the line's tip at the same reading
      // position as the race reveals, even as the page gets taller.
      gsap.fromTo(line, { scaleY: 0 }, {
        scaleY: 1, ease: 'none',
        scrollTrigger: {
          trigger: timeline, start: 'top+=20 64%', end: 'bottom 64%', scrub: 0.25,
        },
      })

      rounds.forEach((round) => {
        const cancelled = round.dataset.status === 'cancelled'
        const current = round.dataset.status === 'current'
        const photo = round.querySelector('.schedule-photo-focus')
        const reveal = round.querySelector('.schedule-photo-reveal')
        const heading = round.querySelector('.schedule-round-heading')
        const node = round.querySelector('.schedule-node-core')
        const desktop = context.conditions?.desktop

        // One arrival: marker, photograph and heading share a timeline.
        // Times stay in place throughout. Fast jumps settle immediately.
        const arrival = gsap.timeline({
          scrollTrigger: {
            trigger: round, start: 'top+=20 64%', once: true, fastScrollEnd: 2500,
          },
        })
        arrival
          .fromTo(node, { opacity: 0.25, scale: 0.65 }, { opacity: 1, scale: 1, duration: 0.3 })
          .fromTo(reveal,
            { clipPath: desktop ? 'inset(0 49.8% 0 49.8%)' : 'inset(0 100% 0 0)' },
            { clipPath: 'inset(0 0% 0 0%)', duration: 0.85, ease: 'power3.out' }, 0)
          .fromTo(heading, { y: 12 }, { y: 0, duration: 0.65, ease: 'power3.out' }, 0.08)

        if (cancelled) return

        // A race is brightest where it is being read, including completed
        // rounds. The current weekend retains its stronger photo grade.
        const rest = current ? 0.65 : 0.38
        gsap.timeline({
          scrollTrigger: { trigger: round, start: 'top 90%', end: 'bottom 12%', scrub: 0.45 },
        })
          .fromTo(photo, { opacity: rest }, { opacity: 1, duration: 0.3, ease: 'none' })
          .to(photo, { opacity: 1, duration: 0.4 })
          .to(photo, { opacity: rest, duration: 0.3, ease: 'none' })

        // Desktop only: move the photograph a few pixels, not its fades,
        // text, or container. Mobile keeps the lighter reveal treatment.
        if (desktop) {
          gsap.fromTo(round.querySelectorAll('.schedule-photo-focus img'),
            { yPercent: -2, scale: 1.045 },
            { yPercent: 2, scale: 1.045, ease: 'none',
              scrollTrigger: { trigger: round, start: 'top bottom', end: 'bottom top', scrub: 0.6 },
            })
        }
      })
    })

    // Winner labels and timezone changes can alter row heights after the
    // calendar arrives. Refresh positions without replaying the reveals.
    let resizeFrame = 0
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(resizeFrame)
      resizeFrame = requestAnimationFrame(() => ScrollTrigger.refresh())
    })
    observer.observe(timeline)

    // matchMedia and useGSAP revert every style/trigger on route changes,
    // data changes, viewport changes and live reduced-motion changes.
    return () => {
      observer.disconnect()
      cancelAnimationFrame(resizeFrame)
      media.revert()
    }
  }, { scope: ref, dependencies: [calendarKey], revertOnUpdate: true })
}
