import { getLenis } from '@/lib/lenis-store'

export function focusTimingSection(element: HTMLElement | null, animate = false) {
  if (!element) return
  element.focus({ preventScroll: true })
  const immediate = !animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const lenis = getLenis()
  // Keep the page's scroll controller in sync; native scrollIntoView alone
  // can be pulled back to Lenis's previous destination on its next frame.
  if (lenis) lenis.scrollTo(element, { offset: -95, immediate, duration: .65 })
  else element.scrollIntoView({ block: 'start', behavior: immediate ? 'instant' : 'smooth' })
}
