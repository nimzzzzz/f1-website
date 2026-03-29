'use client'

import { useState, useEffect } from 'react'
import { List, X, Television } from '@phosphor-icons/react'

const NAV_LINKS = ['Racing', 'Teams', 'Drivers', 'Schedule', 'Results']

export default function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-zinc-950/90 backdrop-blur-md border-b border-zinc-800/40'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-[1400px] mx-auto px-6 md:px-12 h-16 flex items-center justify-between">
        {/* Wordmark */}
        <a href="#" className="flex items-center gap-2.5">
          <svg width="30" height="20" viewBox="0 0 30 20" fill="none" aria-hidden="true">
            <rect x="0" y="0" width="7" height="20" rx="1" fill="#DC2626" />
            <rect x="11.5" y="0" width="7" height="20" rx="1" fill="#DC2626" />
            <rect x="23" y="0" width="7" height="20" rx="1" fill="#DC2626" />
          </svg>
          <span className="text-[11px] font-black tracking-[0.3em] uppercase text-zinc-100">
            Formula 1
          </span>
        </a>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="text-[13px] font-medium text-zinc-500 hover:text-zinc-100 transition-colors duration-200 tracking-wide"
            >
              {link}
            </a>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-5">
          <a
            href="#"
            className="text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors duration-200"
          >
            Sign in
          </a>
          <a
            href="#"
            className="inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2 bg-red-600 text-white hover:bg-red-500 transition-colors duration-200 tracking-wide active:scale-[0.98] active:-translate-y-[1px]"
          >
            <Television size={13} weight="fill" />
            F1 TV Pro
          </a>
        </div>

        {/* Mobile toggle */}
        <button
          className="md:hidden text-zinc-400 hover:text-zinc-100 transition-colors p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? <X size={22} /> : <List size={22} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-zinc-800/60 bg-zinc-950/95 backdrop-blur-md px-6 py-6 flex flex-col gap-1">
          {NAV_LINKS.map((link) => (
            <a
              key={link}
              href="#"
              className="py-3 text-sm text-zinc-400 hover:text-zinc-100 transition-colors border-b border-zinc-900"
            >
              {link}
            </a>
          ))}
          <a
            href="#"
            className="mt-5 flex items-center justify-center gap-2 py-3 bg-red-600 text-white text-sm font-semibold"
          >
            <Television size={14} weight="fill" />
            F1 TV Pro
          </a>
        </div>
      )}
    </nav>
  )
}
