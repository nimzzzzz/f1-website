'use client'

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
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

/**
 * Broadcast shorthand. A weekend has at most five sessions and the world
 * already calls them FP1, SQ, SPR, QUALI and RACE — spelling out "PRACTICE
 * 1" costs the row the horizontal space it needs to fit a phone.
 */
function shortName(name: string): string {
  const n = name.toUpperCase()
  const fp = n.match(/^PRACTICE\s*(\d)$/)
  if (fp) return `FP${fp[1]}`
  if (n === 'SPRINT QUALIFYING') return 'SQ'
  if (n === 'SPRINT') return 'SPR'
  if (n === 'QUALIFYING') return 'QUALI'
  return n
}

// TWO CONTROLS, BECAUSE THERE ARE TWO QUESTIONS.
//
// This was one listbox holding every session of every round: measured at
// 131 options across 27 groups, 540x621px — 69% of the viewport on desktop
// and 70% on a phone. Choosing "the race at Zandvoort" meant scrolling a
// list of a hundred-odd rows to find a weekend, then a session inside it.
// That is two different questions wearing one control, and the big one
// (which weekend, 27 answers) was hiding the small one (which session, 3-5).
//
// So: the ROUND is the page title and opens a panel of rounds only. The
// SESSION is an inline row under it, always visible, one tap, no panel —
// which is how a broadcast lower-third does it, and it fits because a
// weekend never has more than five sessions.
//
// WHAT THE PANEL MUST STILL SATISFY. It is portalled to document.body and
// that is load-bearing, not stylistic. The site's reveal utilities
// (FadeUp / ClipReveal) leave a GSAP transform on their wrapper, and a
// transform creates a STACKING CONTEXT — so a panel rendered in place
// paints under later siblings no matter what z-index it carries. This was
// measured on /results, where the podium surnames drew straight through
// the session rows. Portalling to the body root is the only fix a future
// reveal wrapper cannot re-break.
//
// Portalling forces `fixed` positioning measured from the trigger, which
// is only correct while the trigger does not move. Scroll is therefore
// locked while open AND the panel re-measures on scroll and resize. The
// lock alone was in fact holding — wheel, PageDown, End and a real touch
// drag were all measured as blocked, on desktop and mobile — but it does
// not survive a programmatic window.scrollTo, which the router and any
// scrollIntoView can produce. Re-measuring costs nothing and removes the
// dependency on the lock being perfect.

const PANEL_GAP = 12
const VIEWPORT_PAD = 16
const PANEL_WIDTH = 340

export default function SessionPicker({ sessions, selectedKey, onSelect, label }: Props) {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [rect, setRect] = useState<{ top: number; left: number; width: number; maxH: number } | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()

  useEffect(() => setMounted(true), [])

  const selected = sessions.find((s) => s.session_key === selectedKey) ?? null

  // ── rounds, newest first; sessions within a round in running order ──
  const rounds = useMemo(() => {
    const byMeeting = new Map<number, Session[]>()
    for (const s of sessions) {
      const list = byMeeting.get(s.meeting_key)
      if (list) list.push(s)
      else byMeeting.set(s.meeting_key, [s])
    }
    return [...byMeeting.entries()]
      .map(([meetingKey, list]) => {
        const ordered = [...list].sort(
          (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
        )
        return { meetingKey, sessions: ordered, first: ordered[0] }
      })
      .sort((a, b) => new Date(b.first.date_start).getTime() - new Date(a.first.date_start).getTime())
  }, [sessions])

  const currentRound = useMemo(
    () => rounds.find((r) => r.sessions.some((s) => s.session_key === selectedKey)) ?? rounds[0] ?? null,
    [rounds, selectedKey]
  )

  /**
   * Changing round keeps the session TYPE where it exists. Someone
   * comparing the race at Spa with the race at Monza should not be handed
   * FP1 for their trouble; falling back to the race, then to the last
   * session, covers a test weekend that has neither.
   */
  const pickWithinRound = useCallback(
    (round: { sessions: Session[] }) => {
      const want = selected?.session_name?.toUpperCase()
      const same = want ? round.sessions.find((s) => s.session_name.toUpperCase() === want) : undefined
      const race = round.sessions.find((s) => s.session_name.toUpperCase() === 'RACE')
      return (same ?? race ?? round.sessions[round.sessions.length - 1])?.session_key ?? null
    },
    [selected]
  )

  const place = useCallback(() => {
    const t = triggerRef.current
    if (!t) return
    const r = t.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2)
    const below = window.innerHeight - r.bottom - PANEL_GAP - VIEWPORT_PAD
    const above = r.top - PANEL_GAP - VIEWPORT_PAD
    // Flip above the trigger when there is materially more room there —
    // a trigger low in the viewport would otherwise get a panel squeezed
    // into a sliver.
    const flip = below < 220 && above > below
    setRect({
      top: flip ? Math.max(VIEWPORT_PAD, r.top - PANEL_GAP - Math.min(above, 420)) : r.bottom + PANEL_GAP,
      left: Math.max(VIEWPORT_PAD, Math.min(r.left, window.innerWidth - VIEWPORT_PAD - width)),
      width,
      maxH: Math.max(180, Math.min(420, flip ? above : below)),
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
      const items = [...(panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])]
      if (!items.length) return
      if (e.key === 'Tab') {
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
        const i = items.indexOf(document.activeElement as HTMLElement)
        const next =
          e.key === 'ArrowDown' ? (i + 1) % items.length : (i - 1 + items.length) % items.length
        items[next < 0 ? 0 : next]?.focus()
        return
      }
      if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault()
        ;(e.key === 'Home' ? items[0] : items[items.length - 1])?.focus()
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
    // capture:true so a scroll on ANY ancestor re-anchors the panel — but
    // NOT the panel's own overflow scroll. Re-placing on that produced a
    // new rect object every time the list scrolled, which re-ran the
    // open-focus effect and yanked focus back to the current round: End
    // and Home appeared to do nothing, and arrow navigation would have
    // snapped back the moment it scrolled the list.
    const onScroll = (e: Event) => {
      const t = e.target as Node | null
      if (t && panelRef.current && (t === panelRef.current || panelRef.current.contains(t))) return
      place()
    }
    window.addEventListener('scroll', onScroll, { passive: true, capture: true })
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', onScroll, { capture: true })
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

  // Focus the current round ONCE, when the panel opens. Keyed on a ref
  // rather than on `rect` because rect changes on every re-anchor, and
  // re-running this would fight the user for the focus ring.
  const focusedOnOpen = useRef(false)
  useEffect(() => {
    if (!open) {
      focusedOnOpen.current = false
      return
    }
    if (focusedOnOpen.current || !rect) return
    const items = panelRef.current?.querySelectorAll<HTMLElement>('[role="option"]')
    if (!items?.length) return
    focusedOnOpen.current = true
    const idx = Math.max(0, rounds.findIndex((r) => r.meetingKey === currentRound?.meetingKey))
    items[Math.min(idx, items.length - 1)]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rect])

  const panel =
    open && rect ? (
      <div
        ref={panelRef}
        id={listboxId}
        role="listbox"
        aria-label="Select round"
        // z-[145] sits above page content but below the menu takeover (150)
        // and the top bar (160), so site chrome stays reachable.
        className="fixed z-[145] overflow-y-auto overscroll-contain border border-[var(--line)] bg-[var(--surface)] py-2 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.85)]"
        style={{ top: rect.top, left: rect.left, width: rect.width, maxHeight: rect.maxH }}
      >
        {rounds.map((round) => {
          const isCurrent = round.meetingKey === currentRound?.meetingKey
          const liveHere = round.sessions.some((s) => getSessionStatus(s) === 'live')
          return (
            <button
              key={round.meetingKey}
              type="button"
              role="option"
              aria-selected={isCurrent}
              onClick={() => {
                const next = pickWithinRound(round)
                if (next !== null && next !== selectedKey) onSelect(next)
                close()
              }}
              className={`label-mono flex w-full items-center justify-between gap-4 px-5 py-2.5 text-left transition-[color,transform] duration-200 hover:translate-x-1 hover:text-[var(--accent-text)] motion-reduce:transition-none ${
                isCurrent ? 'text-[var(--text)]' : 'text-[var(--text-dim)]'
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                {isCurrent && <span aria-hidden className="inline-block h-[2px] w-3 shrink-0 bg-[var(--accent)]" />}
                <span className="truncate">{round.first.location.toUpperCase()}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2.5 tabular-nums">
                {formatSessionDate(round.first.date_start)}
                {liveHere && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none"
                  />
                )}
              </span>
            </button>
          )
        })}
      </div>
    ) : null

  const roundSessions = currentRound?.sessions ?? []

  return (
    <div>
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
          {currentRound ? currentRound.first.location : 'Select round'}
        </span>
        <span className="flex items-center gap-3">
          {/* The trigger carries no LIVE badge: it was a free-running CSS
              pulse driven purely by the calendar, so it read identically
              whether data was arriving or the feed had been dead for an
              hour. LiveBeat on the metadata line is the single indicator
              wired to actual data flow. The per-option dots stay — there,
              "this session is running" is a true calendar fact and it is
              precisely what you are choosing between. */}
          <span
            aria-hidden
            className={`label-mono inline-block text-[var(--text-dim)] transition-transform duration-200 group-hover:text-[var(--accent-text)] motion-reduce:transition-none ${
              open ? 'rotate-180' : ''
            }`}
          >
            ▾
          </span>
        </span>
      </button>

      {/* THE SESSION ROW. Always visible, no panel, one tap.
          radiogroup rather than a listbox: this is a visible set of
          mutually exclusive choices, all of them on screen, which is what
          radio semantics describe. Roving tabindex keeps it one Tab stop
          with arrows moving between sessions — the same contract the
          drivers gallery arrows use. */}
      {roundSessions.length > 0 && (
        <div
          role="radiogroup"
          aria-label={label ? `${label.toUpperCase()} SESSION` : 'Select session'}
          className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-2"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
            e.preventDefault()
            const i = roundSessions.findIndex((s) => s.session_key === selectedKey)
            const n = roundSessions.length
            const next = e.key === 'ArrowRight' ? (i + 1) % n : (i - 1 + n) % n
            const target = roundSessions[next < 0 ? 0 : next]
            if (target) {
              onSelect(target.session_key)
              // Focus follows selection, which is what radiogroup arrow
              // navigation is specified to do.
              requestAnimationFrame(() => {
                const el = document.getElementById(`ses-${target.session_key}`)
                el?.focus()
              })
            }
          }}
        >
          {roundSessions.map((s) => {
            const isSelected = s.session_key === selectedKey
            const status = getSessionStatus(s)
            return (
              <button
                key={s.session_key}
                id={`ses-${s.session_key}`}
                type="button"
                role="radio"
                aria-checked={isSelected}
                tabIndex={isSelected ? 0 : -1}
                onClick={() => onSelect(s.session_key)}
                className={`label-mono tap-44 inline-flex items-center gap-2 border px-3.5 py-2 transition-colors duration-200 motion-reduce:transition-none ${
                  isSelected
                    ? 'border-[var(--accent)] text-[var(--text)]'
                    : 'border-[var(--line)] text-[var(--text-dim)] hover:border-[var(--text-dim)] hover:text-[var(--text)]'
                }`}
              >
                {shortName(s.session_name)}
                {status === 'live' && (
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--accent)] motion-reduce:animate-none"
                  />
                )}
                {status === 'live' && <span className="sr-only">(live)</span>}
              </button>
            )
          })}
        </div>
      )}

      {mounted && panel ? createPortal(panel, document.body) : null}
    </div>
  )
}
