'use client'

import { useState, type ReactNode } from 'react'
import TopBar from './TopBar'
import MenuOverlay from './MenuOverlay'

// Site chrome: fixed top bar + full-screen menu takeover. Route content
// (server or client) passes through untouched.
export default function Shell({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <>
      <TopBar menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((v) => !v)} />
      <MenuOverlay open={menuOpen} onClose={() => setMenuOpen(false)} />
      <main className="min-h-[100dvh] overflow-x-clip pt-16">{children}</main>
    </>
  )
}
