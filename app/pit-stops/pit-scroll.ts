import { getLenis } from '@/lib/lenis-store'

export function focusPitSection(element: HTMLElement | null) {
  if (!element) return
  element.focus({ preventScroll: true })
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = getLenis()
  if (lenis) lenis.scrollTo(element, { offset: -95, immediate: reduced, duration: .7 })
  else element.scrollIntoView({ block: 'start', behavior: reduced ? 'instant' : 'smooth' })
}
