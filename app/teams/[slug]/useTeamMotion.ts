'use client'

import type { RefObject } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'

gsap.registerPlugin(ScrollTrigger, useGSAP)

export function useTeamMotion(root: RefObject<HTMLDivElement | null>, slug: string) {
  useGSAP(() => {
    const el = root.current
    if (!el) return
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      // Small arrivals establish each chapter. Nothing is pinned or hidden
      // on the server; matchMedia reverts if the motion preference changes.
      el.querySelectorAll<HTMLElement>('[data-team-reveal]').forEach((node) => {
        gsap.from(node, { y: 28, duration: 0.85, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 92%', once: true } })
      })
      el.querySelectorAll<HTMLElement>('[data-team-portrait]').forEach((node) => {
        gsap.from(node, { y: 42, duration: 1.2, ease: 'power3.out', scrollTrigger: { trigger: node, start: 'top 92%', once: true } })
      })
      const wall = el.querySelector('.team-title-years')
      if (wall) gsap.from(wall.children, { y: 24, stagger: 0.055, duration: 0.7, ease: 'power3.out', scrollTrigger: { trigger: wall, start: 'top 92%', once: true } })
    })
    return () => media.revert()
  }, { scope: root, dependencies: [slug], revertOnUpdate: true })
}
