'use client'

import { useEffect, useRef } from 'react'

// Modal focus management, in one place.
//
// SessionPicker already got this right after the picker fix: Escape closes,
// Tab cycles inside the panel, and focus returns to the trigger on close.
// The menu declared role="dialog" and aria-modal="true" while doing none of
// it — which is worse than no ARIA at all, because it PROMISES a screen
// reader that the background is inert and then leaves it reachable. Rather
// than write that logic a second time, it lives here and both takeovers use
// it.
//
// `inert` is what actually makes the background unreachable — to the
// keyboard, to the screen reader's virtual cursor, and to the pointer. It is
// applied to the overlay's siblings rather than to a wrapper, so nothing in
// the layout has to change to accommodate it.

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export interface FocusTrapOptions {
  /** Only active while true. */
  active: boolean
  /** Called on Escape and on an outside click. */
  onClose: () => void
  /** Focus returns here on close. */
  returnFocusTo?: React.RefObject<HTMLElement | null>
  /**
   * Focused when the trap opens. Falls back to the first focusable node,
   * then to the container itself.
   */
  initialFocus?: React.RefObject<HTMLElement | null>
  /** Close when a pointer lands outside the container. */
  closeOnOutsideClick?: boolean
}

export function useFocusTrap<T extends HTMLElement>(options: FocusTrapOptions) {
  const { active, onClose, returnFocusTo, initialFocus, closeOnOutsideClick = false } = options
  const containerRef = useRef<T | null>(null)
  // Captured at open time so focus can be restored even if the caller does
  // not pass a trigger ref.
  const previouslyFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!active) return
    const container = containerRef.current
    if (!container) return

    previouslyFocused.current = document.activeElement as HTMLElement | null

    // ── make everything behind the overlay inert ───────────────────────
    // Siblings of the overlay's top-level ancestor, so the whole page
    // behind it is covered without introducing a wrapper element.
    const marked: HTMLElement[] = []
    let top: HTMLElement = container
    while (top.parentElement && top.parentElement !== document.body) top = top.parentElement
    // EXCEPT whatever contains the trigger. This site's menu is a toggle
    // living in the fixed top bar, OUTSIDE the dialog — so marking every
    // sibling inert disabled the one control that closes the menu, and a
    // mouse user was left with no way out at all. Caught by a click-to-close
    // test timing out on the button being pointer-inert.
    //
    // The trade-off is deliberate: the top bar stays reachable while the
    // menu is open, which is slightly weaker modality than the ideal. The
    // Tab trap below still keeps KEYBOARD focus inside the dialog, and an
    // unreachable close button is a far worse failure than a reachable
    // ticker.
    const triggerHost = returnFocusTo?.current ?? null
    for (const sibling of Array.from(document.body.children)) {
      if (sibling === top || !(sibling instanceof HTMLElement)) continue
      if (sibling.hasAttribute('inert')) continue
      if (triggerHost && sibling.contains(triggerHost)) continue
      sibling.setAttribute('inert', '')
      marked.push(sibling)
    }

    // ── move focus in ──────────────────────────────────────────────────
    const target =
      initialFocus?.current ??
      container.querySelector<HTMLElement>(FOCUSABLE) ??
      container
    if (target === container && !container.hasAttribute('tabindex')) {
      container.setAttribute('tabindex', '-1')
    }
    // After paint, so the element is laid out and any entrance transition
    // has a node to focus.
    const raf = requestAnimationFrame(() => target.focus({ preventScroll: true }))

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key !== 'Tab') return
      const items = [...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        // Nothing focusable inside: keep focus on the container rather than
        // letting Tab escape to the inert page behind.
        e.preventDefault()
        container.focus({ preventScroll: true })
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!container.contains(document.activeElement)) {
        // Focus escaped some other way (browser chrome, programmatic) —
        // pull it back rather than leaving the trap open.
        e.preventDefault()
        first.focus()
      }
    }

    const onPointerDown = (e: MouseEvent) => {
      if (!closeOnOutsideClick) return
      const t = e.target as Node
      if (container.contains(t)) return
      if (returnFocusTo?.current?.contains(t)) return // the trigger toggles itself
      onClose()
    }

    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onPointerDown)

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onPointerDown)
      for (const el of marked) el.removeAttribute('inert')
      // Restore focus to the trigger, or to wherever it was. preventScroll
      // matters: without it the page jumps to the restored element.
      const back = returnFocusTo?.current ?? previouslyFocused.current
      if (back && document.contains(back)) back.focus({ preventScroll: true })
    }
  }, [active, onClose, returnFocusTo, initialFocus, closeOnOutsideClick])

  return containerRef
}
