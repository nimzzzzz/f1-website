'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Native modal semantics: inert background, Escape, focus trap and restoration. */
export default function FantasyDialog({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: ReactNode; wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const el = ref.current
    const before = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    el?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { el?.close(); document.body.style.overflow = overflow; before?.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={ref} className={`fantasy-dialog${wide ? ' fantasy-dialog--wide' : ''}`}
    aria-label={title} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
    <div className="fantasy-dialog-inner" data-lenis-prevent>
      <header><h2>{title}</h2><button className="fantasy-close" onClick={onClose} aria-label="Close dialog">×</button></header>
      {children}
    </div>
  </dialog>, document.body)
}
