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

    // allowNestedScroll lets a nested scroll container keep its own wheel
    // gestures instead of Lenis claiming every one for the page. Default is
    // false, which is why the lap-times list scrolled the PAGE when you
    // wheeled over it and never moved itself.
    //
    // Taken globally, on measurement: the scroll-driven work was
    // fingerprinted at five depths on /, /drivers, /drivers/[acronym] and
    // /teams — transform matrices, opacity and element positions — and came
    // back byte-identical with the option on. Plain wheel scrolling matched
    // to within the run-to-run jitter of a lerped scroll (the same build
    // varies 210/220 on the first sample between runs).
    //
    // It fixes the whole CATEGORY, including a container nobody remembers
    // to annotate. The explicit data-lenis-prevent attributes on the three
    // known containers stay anyway: they are deterministic where this is a
    // heuristic, and this bug has now shipped twice.
    const lenis = new Lenis({ lerp: 0.11, allowNestedScroll: true })
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

    // KEYBOARD FOCUS MUST FOLLOW THE SCROLLER.
    //
    // Lenis drives scrolling itself, which means the browser's native
    // "scroll the focused element into view" no longer happens: tabbing to a
    // footer link or an off-screen driver moved focus there while the page
    // stayed put, so a keyboard user was looking at content that had nothing
    // to do with where their focus was. Caught by a per-route tab pass —
    // every stop had a visible ring, but some of those rings were thousands
    // of pixels down the page.
    //
    // Only fires when the target is actually outside the viewport, so
    // ordinary tabbing through visible controls is untouched.
    const onFocusIn = (e: FocusEvent) => {
      const el = e.target as HTMLElement | null
      if (!el || typeof el.getBoundingClientRect !== 'function') return
      const r = el.getBoundingClientRect()
      const fullyVisible = r.top >= 0 && r.bottom <= window.innerHeight
      if (fullyVisible) return
      // Centre it rather than pinning to an edge: an element flush against
      // the fixed top bar reads as clipped.
      lenis.scrollTo(el, { offset: -window.innerHeight / 2 + r.height / 2 })
    }
    document.addEventListener('focusin', onFocusIn)

    return () => {
      document.removeEventListener('focusin', onFocusIn)
      observer.disconnect()
      gsap.ticker.remove(raf)
      setLenis(null)
      lenis.destroy()
    }
  }, [])

  return <>{children}</>
}
