'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import {
  House,
  CalendarBlank,
  Users,
  Buildings,
  Trophy,
  ChartBar,
  Timer,
  MapPin,
  Wrench,
  CloudSun,
  Flag,
  Radio,
  Gauge,
  List,
  X,
} from '@phosphor-icons/react'

const NAV_LINKS = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/schedule', label: 'Schedule', icon: CalendarBlank },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/teams', label: 'Teams', icon: Buildings },
  { href: '/results', label: 'Results', icon: Trophy },
  { href: '/standings', label: 'Standings', icon: ChartBar },
  { href: '/laps', label: 'Lap Times', icon: Timer },
  { href: '/positions', label: 'Positions', icon: MapPin },
  { href: '/pit-stops', label: 'Pit Stops', icon: Wrench },
  { href: '/weather', label: 'Weather', icon: CloudSun },
  { href: '/race-control', label: 'Race Control', icon: Flag },
  { href: '/team-radio', label: 'Team Radio', icon: Radio },
  { href: '/stints', label: 'Tyres & Stints', icon: Gauge },
]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6 border-b border-zinc-800/50">
        <div className="flex items-center gap-3 mb-2">
          {/* F1 three-bar SVG icon */}
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true">
            <rect y="0" width="28" height="4" rx="1" fill="#DC2626" />
            <rect y="8" width="20" height="4" rx="1" fill="#DC2626" />
            <rect y="16" width="24" height="4" rx="1" fill="#DC2626" />
          </svg>
          <span className="text-base font-black tracking-tight text-zinc-100">Nimas F1 Tracker</span>
        </div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600">
          2026 Season
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_LINKS.map(({ href, label, icon: Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              className={[
                'flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-colors duration-150',
                'border-l-2',
                isActive
                  ? 'border-red-500 text-zinc-100 bg-zinc-800/30'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20',
              ].join(' ')}
            >
              <Icon size={17} weight={isActive ? 'fill' : 'regular'} />
              {label}
            </Link>
          )
        })}
      </nav>

    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col bg-zinc-950 border-r border-zinc-800/50 z-40">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger button */}
      <button
        onClick={() => setOpen(true)}
        className="md:hidden fixed top-4 right-4 z-50 p-2.5 rounded-lg bg-zinc-900 border border-zinc-800/50 text-zinc-400 hover:text-zinc-100 transition-colors"
        aria-label="Open menu"
      >
        <List size={20} />
      </button>

      {/* Mobile overlay */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          {/* Panel */}
          <aside className="relative w-64 h-full bg-zinc-950 border-r border-zinc-800/50 flex flex-col z-10">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
              aria-label="Close menu"
            >
              <X size={18} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}
    </>
  )
}
