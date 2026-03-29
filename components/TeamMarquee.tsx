'use client'

// Isolated memoized perpetual animation component — per taste-skill MOTION_ENGINE rules
import { memo } from 'react'

const TEAMS = [
  'Oracle Red Bull Racing',
  'Scuderia Ferrari',
  'McLaren F1 Team',
  'Mercedes-AMG Petronas F1',
  'Aston Martin Aramco Cognizant',
  'BWT Alpine F1 Team',
  'Williams Racing',
  'MoneyGram Haas F1 Team',
  'Stake F1 Kick Sauber',
  'Visa Cash App RB F1 Team',
]

const TeamMarquee = memo(function TeamMarquee() {
  const items = [...TEAMS, ...TEAMS, ...TEAMS]
  return (
    <div
      className="border-y border-zinc-800/40 py-3.5 overflow-hidden select-none bg-zinc-950"
      aria-hidden="true"
    >
      <div
        className="flex whitespace-nowrap animate-marquee"
        style={{ willChange: 'transform' }}
      >
        {items.map((team, i) => (
          <span key={i} className="inline-flex items-center shrink-0 px-6">
            <span className="text-[10px] font-bold tracking-[0.28em] uppercase text-zinc-700">
              {team}
            </span>
            <span className="ml-6 text-zinc-800">&#xB7;</span>
          </span>
        ))}
      </div>
    </div>
  )
})

export default TeamMarquee
