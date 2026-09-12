'use client'

import { useEffect, type RefObject } from 'react'

// Progressive enhancement: scores and names are never hidden. Only the
// decorative points traces animate. A reading zone lights up touch rows.
export function useStandingsMotion(ref: RefObject<HTMLDivElement | null>, rowsKey: string) {
  useEffect(() => {
    const root = ref.current
    if (!root || !rowsKey || !('IntersectionObserver' in window)) return
    const rows = Array.from(root.querySelectorAll<HTMLElement>('.standing-row'))
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let arrival: IntersectionObserver | undefined
    let focus: IntersectionObserver | undefined

    const reset = () => {
      arrival?.disconnect()
      focus?.disconnect()
      rows.forEach((row) => { delete row.dataset.arrived; delete row.dataset.reading })
    }
    const setup = () => {
      reset()
      if (motion.matches) return
      arrival = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const row = entry.target as HTMLElement
          row.dataset.arrived = 'true'
          arrival?.unobserve(row)
        })
      }, { rootMargin: '0px 0px -4% 0px', threshold: 0 })
      focus = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const row = entry.target as HTMLElement
          if (entry.isIntersecting) row.dataset.reading = 'true'
          else delete row.dataset.reading
        })
      }, { rootMargin: '-22% 0px -55% 0px', threshold: 0 })
      rows.forEach((row) => { arrival?.observe(row); focus?.observe(row) })
    }
    setup()
    motion.addEventListener('change', setup)
    return () => { reset(); motion.removeEventListener('change', setup) }
  }, [ref, rowsKey])
}
