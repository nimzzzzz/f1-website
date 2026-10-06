'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import type { LapDriver } from '@/lib/laps-story'
import { lockPageScroll } from '@/lib/scroll-lock'

export default function DriverPicker({ slot, driver, drivers, other, onSelect }: {
  slot: 'A' | 'B'; driver: LapDriver; drivers: LapDriver[]; other?: number;
  onSelect: (number: number) => void;
}) {
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const search = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(driver.number)
  const [position, setPosition] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const filtered = drivers.filter(d => `${d.name} ${d.team} ${d.number}`.toLowerCase().includes(query.trim().toLowerCase()))
  const enabled = filtered.filter(d => d.number !== other)
  const activeNumber = enabled.some(d => d.number === active) ? active : enabled[0]?.number

  const close = useCallback((restoreFocus = true) => {
    setOpen(false)
    if (restoreFocus) trigger.current?.focus({ preventScroll: true })
  }, [])

  const place = useCallback(() => {
    const rect = trigger.current?.getBoundingClientRect()
    if (!rect) return
    const viewport = window.visualViewport
    const topEdge = (viewport?.offsetTop ?? 0) + 12
    const bottomEdge = (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - 12
    const width = Math.min(300, window.innerWidth - 24)
    const below = bottomEdge - rect.bottom - 8
    const above = rect.top - topEdge - 8
    const flip = below < 280 && above > below
    const height = Math.min(350, Math.max(160, flip ? above : below), bottomEdge - topEdge)
    setPosition({
      top: Math.max(topEdge, Math.min(flip ? rect.top - height - 8 : rect.bottom + 8, bottomEdge - height)),
      left: Math.max(12, Math.min(rect.left, window.innerWidth - width - 12)), width, height,
    })
  }, [])

  useLayoutEffect(() => { if (open) place() }, [open, place])

  useEffect(() => {
    if (!open) return
    const unlock = lockPageScroll()
    // Locking the body also stops the site's Lenis instance. The portalled
    // panel has data-lenis-prevent so its own wheel/touch scrolling stays native.
    const focusFrame = requestAnimationFrame(() => search.current?.focus({ preventScroll: true }))
    const outside = (event: PointerEvent) => {
      const target = event.target as Node
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) close(false)
    }
    const scroll = (event: Event) => {
      if (!panel.current?.contains(event.target as Node)) place()
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); close() }
    }
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', scroll, { passive: true, capture: true })
    window.visualViewport?.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(focusFrame)
      unlock()
      document.removeEventListener('pointerdown', outside)
      document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', scroll, true)
      window.visualViewport?.removeEventListener('resize', place)
    }
  }, [open, close, place])

  useEffect(() => {
    if (!open) return
    const option = document.getElementById(`${id}-driver-${activeNumber}`)
    const container = list.current
    if (!option || !container) return
    // Scroll only the list, never the page (or its smooth-scroll controller).
    const itemRect = option.getBoundingClientRect()
    const listRect = container.getBoundingClientRect()
    if (itemRect.top < listRect.top) container.scrollTop -= listRect.top - itemRect.top
    else if (itemRect.bottom > listRect.bottom) container.scrollTop += itemRect.bottom - listRect.bottom
  }, [open, activeNumber, id, position])

  function choose(number: number) {
    if (number === other) return
    onSelect(number)
    close()
  }

  return <>
    <button ref={trigger} type="button" className="laps-driver-select" aria-label={`${driver.surname}, select driver ${slot}`}
      aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined}
      onClick={() => {
        if (open) close()
        else { setQuery(''); setActive(driver.number); setOpen(true) }
      }}>
      <span>{driver.surname}</span>
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="m3 6 5 5 5-5" stroke="currentColor" strokeWidth="1.5" /></svg>
    </button>
    {open && position && createPortal(
      <div ref={panel} id={id} role="dialog" aria-modal="true" aria-label={`Select driver ${slot}`}
        className="laps-driver-panel" data-lenis-prevent style={position}
        onKeyDown={event => {
          if (event.key === 'Tab') {
            event.preventDefault()
            const target = document.activeElement === search.current ? panel.current?.querySelector<HTMLButtonElement>('.laps-picker-close') : search.current
            target?.focus({ preventScroll: true })
          }
        }}>
        <div className="laps-picker-header"><span>DRIVER {slot}</span><button className="laps-picker-close" type="button" aria-label="Close driver picker" onClick={() => close()}>×</button></div>
        <input ref={search} className="laps-picker-search" type="search" placeholder="Search driver or team" aria-label="Search driver or team"
          role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls={`${id}-list`}
          aria-activedescendant={activeNumber === undefined ? undefined : `${id}-driver-${activeNumber}`}
          value={query} onChange={event => { setQuery(event.target.value); setActive(-1) }}
          onKeyDown={event => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              const index = enabled.findIndex(d => d.number === activeNumber)
              const next = enabled[(index + (event.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]
              if (next) setActive(next.number)
            } else if (event.key === 'Enter' && activeNumber !== undefined) {
              event.preventDefault(); choose(activeNumber)
            }
          }} />
        <div ref={list} id={`${id}-list`} className="laps-picker-list" role="listbox" aria-label={`Driver ${slot}`}>
          {filtered.map(d => <button key={d.number} id={`${id}-driver-${d.number}`} type="button" role="option" tabIndex={-1}
            aria-selected={d.number === driver.number} disabled={d.number === other}
            className={`laps-picker-option${d.number === activeNumber ? ' is-active' : ''}`}
            style={{ '--driver-color': d.color } as CSSProperties}
            onMouseDown={event => event.preventDefault()} onClick={() => choose(d.number)}>
            <span className="laps-picker-number">{d.number}</span>
            <span><strong>{d.surname}</strong><small>{d.team}</small></span>
            <span className="laps-picker-status">{d.number === other ? `IN ${slot === 'A' ? 'B' : 'A'}` : d.number === driver.number ? <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden><path d="m3 8 3 3 7-7" stroke="currentColor" strokeWidth="1.5" /></svg> : null}</span>
          </button>)}
        </div>
        {!filtered.length && <p className="laps-picker-empty" role="status">No matching drivers</p>}
      </div>, document.body,
    )}
  </>
}
