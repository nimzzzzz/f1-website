'use client'

import { useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import MenuOverlay from './MenuOverlay'

// Site chrome: fixed top bar + full-screen menu takeover. Route content
// (server or client) passes through untouched. Live-session lockouts are
// invisible here by design: the data layer serves last-known data through
// them, so there is no banner to show.
export default function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const pathname = usePathname()
  // Owned here so the menu can return focus to the exact control that
  // opened it. Relying on document.activeElement is unreliable: Safari does
  // not focus a button on click, so a mouse user closing the menu would
  // have focus restored to <body> and lose their place entirely.
  const menuTriggerRef = useRef<HTMLButtonElement>(null)

  // The fade belongs to ROUTE CHANGES only. On the document's first paint
  // there is no outgoing page to soften the swap from, and the animation is
  // not free: an opacity animation (fill: both keeps applying a value even at
  // opacity 1) makes <main> a STACKING CONTEXT, which trapped the intro's
  // fixed z-[200] overlay inside it and let the z-[160] top bar paint over
  // the intro. Skipping it until the first client navigation keeps the
  // document's initial render context-free — so a full-screen takeover
  // rendered by a page still covers the shell — and costs nothing, since
  // there was nothing to fade from.
  const firstPath = useRef(pathname)
  const navigated = useRef(false)
  if (pathname !== firstPath.current) navigated.current = true

  return (
    <>
      {/* First focusable thing in the document: lets a keyboard or screen
          reader user jump the fixed top bar and the ticker instead of tabbing
          through them on every route. Visually hidden until focused, then it
          appears in the site's own register. */}
      <a href="#main" className="skip-link">
        SKIP TO CONTENT
      </a>
      <TopBar
        menuOpen={menuOpen}
        onToggleMenu={() => setMenuOpen((v) => !v)}
        triggerRef={menuTriggerRef}
      />
      <MenuOverlay
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        returnFocusTo={menuTriggerRef}
      />
      {/* keyed per route so the incoming page's fade restarts on navigation.
          The fade lives HERE rather than around the whole tree so the top bar
          and menu stay mounted (the ticker keeps running, menu state holds).
          .route-fade is a plain CSS animation — no JS on the nav path, and it
          is disabled outright under reduced motion. */}
      <main
        id="main"
        tabIndex={-1}
        key={pathname}
        className={`min-h-[100dvh] overflow-x-clip pt-16 ${navigated.current ? 'route-fade' : ''}`}
      >
        {children}
      </main>
    </>
  )
}
