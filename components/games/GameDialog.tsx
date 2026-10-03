'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** Native modal semantics shared by the two independent games. */
export default function GameDialog({ title, onClose, children, className }: {
  title: string; onClose: () => void; children: ReactNode; className: string
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    const previous = document.activeElement as HTMLElement | null
    const overflow = document.body.style.overflow
    dialog?.showModal()
    document.body.style.overflow = 'hidden'
    return () => { dialog?.close(); document.body.style.overflow = overflow; previous?.focus({ preventScroll: true }) }
  }, [])
  return createPortal(<dialog ref={ref} className={className} aria-label={title} onCancel={onClose}
    onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="game-dialog-inner" data-lenis-prevent>
      <header><h2>{title}</h2><button className="game-dialog-close" onClick={onClose} aria-label="Close dialog">×</button></header>
      {children}
    </div>
  </dialog>, document.body)
}
