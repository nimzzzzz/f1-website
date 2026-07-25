'use client'

import { useState, type ReactNode } from 'react'
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

  return (
    <>
      <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      {/* keyed per route so the incoming page's fade restarts on navigation.
          The fade lives HERE rather than around the whole tree so the top bar
          and menu stay mounted (the ticker keeps running, menu state holds).
          .route-fade is a plain CSS animation — no JS on the nav path, and it
          is disabled outright under reduced motion. */}
      <main key={pathname} className="route-fade min-h-[100dvh] overflow-x-clip pt-16">
        {children}
      </main>
    </>
  )
}
