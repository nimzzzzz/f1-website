'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Session } from '@/lib/openf1'

interface Props {
  sessions: Session[]
  selectedKey: number | null
  onSelect: (key: number) => void
  label?: string
}

function getSessionStatus(session: Session): 'live' | 'completed' | 'upcoming' {
  const now = new Date()
  const start = new Date(session.date_start)
  const end = new Date(session.date_end)
  if (start <= now && now < end) return 'live'
  if (end < now) return 'completed'
  return 'upcoming'
}

function formatSessionDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

// The session picker in the design language: the selected session IS the
// page title (Bebas button), and the list opens as a compact overlay in
// menu grammar — mono, dim, hover accent.
//
// THE PANEL IS PORTALLED TO document.body, and that is load-bearing.
//
// Rendered in place, the panel was unreadable on every page that uses it:
// page content painted straight through it (measured on /results — the
// podium surnames drawing over the session rows). The cause is NOT a
// missing background; the surface class resolves correctly to
// rgba(10,10,10,.98) and is present in the shipped CSS. It is paint order.
// The site's reveal utilities (FadeUp / ClipReveal) leave a GSAP transform
// on their wrapper, and a transform creates a STACKING CONTEXT. On
// /results both the header and the podium block sit in their own
// transformed reveal wrappers, siblings with z-index:auto — so they paint
// in DOM ORDER, and the podium, being later, wins. No z-index the panel
// could carry would help: z-[140] only ever competed inside the header's
// own trapped subtree.
//
// This is the third appearance of this landmine in this codebase (an
// animation-created stacking context trapped the intro under the top bar;
// a GSAP transform stacked with an inline one on the page-transition
// panel). Portalling to the body root is the only fix that cannot be
// re-broken by a reveal wrapper being added or moved later.
//
// Positioning is therefore `fixed`, measured from the trigger, and body
// scroll is locked while open — which also keeps the panel anchored to its
// trigger (LenisProvider watches body[style] and stops its virtual scroll
// when overflow goes hidden, so no explicit Lenis call is needed here).

const PANEL_GAP = 20 // px below the trigger
const VIEWPORT_PAD = 16

export default function SessionPicker({ sessions, selectedKey, onSelect, label }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => setMounted(true), [])

  const selected = sessions.find((s) => s.session_key === selectedKey) ?? null

  // Group sessions by meeting (existing grouping logic preserved)
  const grouped = sessions.reduce<Record<number, Session[]>>((acc, s) => {
    if (!acc[s.meeting_key]) acc[s.meeting_key] = []
    acc[s.meeting_key].push(s)
    return acc
  }, {})
  const sortedMeetingKeys = Object.keys(grouped)
    .map(Number)
    .sort((a, b) => {
      const aFirst = grouped[a][0]
      const bFirst = grouped[b][0]
      return new Date(bFirst.date_start).getTime() - new Date(aFirst.date_start).getTime()
    })
  const flatKeys = sortedMeetingKeys.flatMap((mk) =>
    [...grouped[mk]]
      .sort((a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime())
      .map((s) => s.session_key)
  )

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const top = r.bottom + PANEL_GAP
    setRect({
      top,
      left: Math.max(VIEWPORT_PAD, Math.min(r.left, window.innerWidth - VIEWPORT_PAD - 320)),
      width: Math.min(540, window.innerWidth - VIEWPORT_PAD * 2),
      maxH: Math.max(180, window.innerHeight - top - VIEWPORT_PAD),
    })
  }, [])

  // Measure before paint so the panel never appears at a stale position.
  useLayoutEffect(() => {
    if (open) place()
  }, [open, place])

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        close()
        return
      }
      if (e.key === 'Tab') {
        // keep focus inside the open panel
        const items = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
        if (!items || items.length === 0) return
        const first = items[0]
        const last = items[items.length - 1]
        if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
        return
      }
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
        if (!items.length) return
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next = e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
        items[next < 0 ? 0 : next].focus()
      }
    }
    const onPointer = (e: MouseEvent) => {
      const target = e.target as Node
      if (panelRef.current?.contains(target)) return
      if (triggerRef.current?.contains(target)) return // the trigger toggles itself
      close(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', place)
    }
  }, [open, close, place])

  // Body scroll lock. LenisProvider observes body[style] and stops its
  // virtual scroll on overflow:hidden, so this covers smooth scrolling too.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [open])

  // Move focus to the selected (or first) option when the panel opens.
  useEffect(() => {
    if (!open || !rect) return
    const items = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    if (!items?.length) return
    const idx = Math.max(0, flatKeys.indexOf(selectedKey ?? -1))
    items[Math.min(idx, items.length - 1)]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rect])

  const panel =
    open && rect ? (
      <div
        ref={panelRef}
        id={listboxId}
        role="listbox"
        aria-label={label ? label.toUpperCase() : 'Select session'}
        // z-[145] sits above all page content but below the menu takeover
        // (150) and the top bar (160), so site chrome stays reachable.
        // Portalled to <body>, so no page stacking context can trap it.
        className="fixed z-[145] overflow-y-auto overscroll-contain border border-[var(--line)] bg-[var(--surface)] py-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
        style={{ top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxH }}
      >
        {sortedMeetingKeys.map((meetingKey) => {
          const meetingSessions = [...grouped[meetingKey]].sort(
            (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
          )
          const first = meetingSessions[0]
          return (
            <div key={meetingKey} className="border-b border-[var(--line)] py-2 last:border-b-0">
              <p className="label-mono px-5 py-2 text-[var(--text-dim)] opacity-70">
                {first.location.toUpperCase()} — {first.country_name.toUpperCase()}
              </p>
              {meetingSessions.map((s) => {
                const status = getSessionStatus(s)
                const isSelected = s.session_key === selectedKey
                return (
                  <button
                    key={s.session_key}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onSelect(s.session_key)
                      close()
                    }}
                    className={`label-mono flex w-full items-center justify-between gap-6 px-5 py-2.5 text-left transition-[color,transform] duration-200 hover:translate-x-1 hover:text-[var(--accent)] focus-visible:text-[var(--accent)] focus-visible:outline-none motion-reduce:transition-none ${
                      isSelected ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      {isSelected && (
                        <span aria-hidden className="inline-block h-[2px] w-3 bg-[var(--accent)]" />
                      )}
                      {s.session_name.toUpperCase()}
                    </span>
                    <span className="flex shrink-0 items-center gap-3 tabular-nums">
                      {formatSessionDate(s.date_start)}
                      {status === 'live' && (
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none" />
                      )}
                      {status === 'upcoming' && <span className="opacity-60">SOON</span>}
                    </span>
                  </button>
                )
              })}
            </div>
          )
        })}
      </div>
    ) : null

  return (
    <div className="relative">
      {label && <p className="label-mono mb-2 text-[var(--text-dim)]">{label.toUpperCase()}</p>}

      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? close(false) : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={open ? listboxId : undefined}
        className="group flex flex-wrap items-baseline gap-x-4 gap-y-1 text-left"
      >
        <span
          className="uppercase leading-[0.9] text-[var(--text)]"
          style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2rem, 4.6vw, 4rem)' }}
        >
          {selected ? `${selected.location} — ${selected.session_name}` : 'Select session'}
        </span>
        <span className="flex items-center gap-3">
        {/* The trigger no longer carries its own LIVE badge. It was a
            free-running CSS pulse driven purely by the calendar, so it read
            identically whether data was arriving or the feed had been dead
            for an hour — the exact "says LIVE while frozen" claim the
            polling work exists to remove. LiveBeat, on the metadata line
            directly below, is now the single indicator and is wired to
            actual data flow. The per-option dots in the list below stay:
            there, "this session is running" is a true calendar fact and it
            is precisely what you are choosing between. */}
          <span
            aria-hidden
            className={`label-mono inline-block text-[var(--text-dim)] transition-transform duration-200 group-hover:text-[var(--accent)] motion-reduce:transition-none ${
              open ? 'rotate-180' : ''
            }`}
          >
            ▾
          </span>
        </span>
      </button>

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
