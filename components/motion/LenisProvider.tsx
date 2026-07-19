'use client'

import { useEffect, type ReactNode } from 'react'
import Lenis from 'lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { setLenis } from '@/lib/lenis-store'

gsap.registerPlugin(ScrollTrigger)

// Global smooth scroll, synced into GSAP's ticker so ScrollTrigger and
// Lenis share one clock. Reduced motion disables smoothing entirely —
// native scroll, ScrollTrigger still functional for reveal fallbacks.
export default function LenisProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const lenis = new Lenis({ lerp: 0.11 })
    setLenis(lenis)
    lenis.on('scroll', ScrollTrigger.update)

    const raf = (time: number) => lenis.raf(time * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)

    // The intro (and the menu overlay) lock scroll via body overflow —
    // Lenis uses virtual scrolling and must be stopped explicitly.
    const syncLock = () => {
      if (document.body.style.overflow === 'hidden') lenis.stop()
      else lenis.start()
    }
    syncLock()
    const observer = new MutationObserver(syncLock)
    observer.observe(document.body, { attributes: true, attributeFilter: ['style'] })

    return () => {
      observer.disconnect()
      gsap.ticker.remove(raf)
      setLenis(null)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
