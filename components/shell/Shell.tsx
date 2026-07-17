'use client'

import { useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import TopBar from './TopBar'
import MenuOverlay from './MenuOverlay'
import LiveSessionNotice from '@/components/LiveSessionNotice'
import { useApiBlocked } from './useApiBlocked'

// Site chrome: fixed top bar + full-screen menu takeover. Route content
// (server or client) passes through untouched. During openf1's live-session
// lockout, non-home routes get the shared notice banner at their top level
// (home handles its own full-size treatment).
export default function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const apiBlocked = useApiBlocked()
  const pathname = usePathname()

  return (
    <>
      <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="min-h-[100dvh] overflow-x-clip pt-16">
        {apiBlocked && pathname !== '/' && <LiveSessionNotice variant="banner" />}
        {children}
      </main>
    </>
  )
}
