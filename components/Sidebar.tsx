'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Gauge,
  List,
  X,
  IdentificationCard,
  VideoCamera,
} from '@phosphor-icons/react'

const MAIN_LINKS = [
  { href: '/', label: 'Overview', icon: House },
  { href: '/schedule', label: 'Schedule', icon: CalendarBlank },
  { href: '/drivers', label: 'Drivers', icon: Users },
  { href: '/teams', label: 'Teams', icon: Buildings },
  { href: '/results', label: 'Results', icon: Trophy },
  { href: '/standings', label: 'Standings', icon: ChartBar },
]

const DATA_LINKS = [
  { href: '/laps', label: 'Lap Times', icon: Timer },
  { href: '/positions', label: 'Positions', icon: MapPin },
  { href: '/pit-stops', label: 'Pit Stops', icon: Wrench },
  { href: '/weather', label: 'Weather', icon: CloudSun },
  { href: '/race-control', label: 'Race Control', icon: Flag },
  { href: '/stints', label: 'Tyres & Stints', icon: Gauge },
  { href: '/sports-cards', label: "F1 Sports Cards", icon: IdentificationCard },
  { href: '/highlights', label: 'Highlights', icon: VideoCamera },
]

const NAV_LINKS = [...MAIN_LINKS, ...DATA_LINKS]

export default function Sidebar() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  const NavLink = ({ href, label, icon: Icon }: { href: string; label: string; icon: typeof House }) => {
    const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
    return (
      <Link
        key={href}
        href={href}
        onClick={() => setOpen(false)}
        className={[
          'group relative flex items-center gap-3 px-6 py-2.5 text-sm font-medium transition-all duration-200',
          isActive
            ? 'text-zinc-100 bg-zinc-800/40'
            : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/20',
        ].join(' ')}
      >
        {/* Active accent bar with glow */}
        <span
          className={[
            'absolute left-0 top-1/2 -translate-y-1/2 w-[3px] rounded-r-full transition-all duration-200',
            isActive
              ? 'h-5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
              : 'h-0 bg-red-500/0 group-hover:h-3 group-hover:bg-red-500/40',
          ].join(' ')}
        />
        {/* Hover background slide-in from left */}
        <span className="absolute inset-0 origin-left scale-x-0 bg-zinc-800/20 transition-transform duration-200 group-hover:scale-x-100" />
        <Icon size={17} weight={isActive ? 'fill' : 'regular'} className="relative z-10 shrink-0" />
        <span className="relative z-10">{label}</span>
      </Link>
    )
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-6 pt-8 pb-6 border-b border-zinc-800/50">
        <div className="relative flex items-center gap-3 mb-2">
          {/* Red radial gradient glow behind logo */}
          <div className="absolute -left-2 -top-2 w-12 h-12 rounded-full bg-[radial-gradient(circle,rgba(220,38,38,0.15)_0%,transparent_70%)] pointer-events-none" />
          {/* F1 three-bar SVG icon */}
          <svg width="28" height="20" viewBox="0 0 28 20" fill="none" aria-hidden="true" className="relative z-10">
            <rect y="0" width="28" height="4" rx="1" fill="#DC2626" />
            <rect y="8" width="20" height="4" rx="1" fill="#DC2626" />
            <rect y="16" width="24" height="4" rx="1" fill="#DC2626" />
          </svg>
          <span className="relative z-10 text-base font-black tracking-tight text-zinc-100 drop-shadow-[0_0_6px_rgba(220,38,38,0.15)]">
            Nimas F1 Tracker
          </span>
        </div>
        <p className="text-[10px] font-bold tracking-[0.25em] uppercase text-zinc-600">
          2026 Season
        </p>
      </div>

      {/* Navigation — scrollbar hidden via inline style + Tailwind arbitrary properties */}
      <nav
        className="flex-1 py-4 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:[display:none]"
      >

        {/* Main navigation links */}
        {MAIN_LINKS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} />
        ))}

        {/* Section separator */}
        <div className="flex items-center gap-3 px-6 py-3 my-1">
          <div className="flex-1 h-px bg-zinc-800/60" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-zinc-700 select-none">
            Data
          </span>
          <div className="flex-1 h-px bg-zinc-800/60" />
        </div>

        {/* Data navigation links */}
        {DATA_LINKS.map(({ href, label, icon }) => (
          <NavLink key={href} href={href} label={label} icon={icon} />
        ))}
      </nav>
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-60 flex-col bg-zinc-950 shadow-[inset_-1px_0_0_rgba(63,63,70,0.3),inset_-4px_0_8px_rgba(0,0,0,0.15)] z-40">
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

      {/* Mobile overlay with framer-motion */}
      <AnimatePresence>
        {open && (
          <div className="md:hidden fixed inset-0 z-50 flex">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            {/* Panel */}
            <motion.aside
              initial={{ x: '-100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '-100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300 }}
              className="relative w-64 h-full bg-zinc-950 shadow-[inset_-1px_0_0_rgba(63,63,70,0.3),inset_-4px_0_8px_rgba(0,0,0,0.15)] flex flex-col z-10"
            >
              <button
                onClick={() => setOpen(false)}
                className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-100 transition-colors"
                aria-label="Close menu"
              >
                <X size={18} />
              </button>
              <SidebarContent />
            </motion.aside>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}
