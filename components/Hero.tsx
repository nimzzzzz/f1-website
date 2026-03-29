'use client'

import { memo, useEffect, useState } from 'react'
import { ArrowRight, Play, FlagCheckered, Timer } from '@phosphor-icons/react'

const RACE = {
  name: 'JAPANESE GRAND PRIX',
  circuit: 'Suzuka International Racing Course',
  date: 'March 30, 2025',
  round: 4,
  totalRounds: 24,
  laps: '53 Laps · 307.471 km',
  daysUntil: 3,
  leader: 'Max Verstappen',
  team: 'Oracle Red Bull Racing',
  points: 287,
  racesRemaining: 21,
}

// Isolated memoized perpetual counter — MOTION_INTENSITY: 6
const AnimatedPoints = memo(function AnimatedPoints({ target }: { target: number }) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    const timeout = setTimeout(() => {
      let current = 0
      const step = Math.ceil(target / 55)
      const id = setInterval(() => {
        current = Math.min(current + step, target)
        setValue(current)
        if (current >= target) clearInterval(id)
      }, 18)
      return () => clearInterval(id)
    }, 700)
    return () => clearTimeout(timeout)
  }, [target])

  return <>{String(value).padStart(3, '0')}</>
})

export default function Hero() {
  return (
    <section className="relative min-h-[100dvh] flex flex-col justify-end overflow-hidden">
      {/* Background with heavy dark overlay — image adds texture regardless of what picsum returns */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: `url(https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Norris_%26_Piastri_on_the_grid_-_Chinese_GP_2024.jpg/1920px-Norris_%26_Piastri_on_the_grid_-_Chinese_GP_2024.jpg)`,
        }}
      />
      {/* Layered gradients — asymmetric, left-heavy (DESIGN_VARIANCE: 8) */}
      <div className="absolute inset-0 bg-gradient-to-r from-zinc-950 via-zinc-950/88 to-zinc-950/30" />
      <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/15 to-zinc-950/60" />

      {/* Red accent line — top edge */}
      <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-red-600 via-red-500/60 to-transparent z-10" />

      {/* Abstract speed lines — decorative SVG */}
      <div className="absolute right-0 top-1/4 w-[40vw] h-[60vh] opacity-[0.04] pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 400 400" fill="none" className="w-full h-full">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
            <line
              key={i}
              x1="400"
              y1={40 + i * 48}
              x2="0"
              y2={200 + i * 20}
              stroke="white"
              strokeWidth="1"
            />
          ))}
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-12 w-full pb-16 md:pb-24">
        {/* Season badge */}
        <div className="mb-10">
          <div className="inline-flex items-center gap-2 border border-red-600/25 bg-red-600/08 px-3 py-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[10px] font-bold tracking-[0.35em] uppercase text-red-400">
              2025 FIA Formula One World Championship
            </span>
          </div>
        </div>

        {/* Asymmetric headline — DESIGN_VARIANCE: 8, left-aligned, no center */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-10 lg:gap-16 items-end">
          <div>
            <p className="text-[11px] font-semibold text-zinc-500 tracking-[0.35em] uppercase mb-5">
              Round {RACE.round} of {RACE.totalRounds} &mdash; {RACE.daysUntil} Days Away
            </p>
            {/* Giant asymmetric headline */}
            <h1 className="text-[clamp(3.8rem,9.5vw,8.5rem)] font-black tracking-tighter leading-[0.92] uppercase text-zinc-100">
              Japanese
            </h1>
            <h1 className="text-[clamp(3.8rem,9.5vw,8.5rem)] font-black tracking-tighter leading-[0.92] uppercase">
              <span className="text-red-500">Grand Prix</span>
            </h1>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 mt-5">
              <p className="text-zinc-400 text-base font-medium">{RACE.circuit}</p>
              <span className="text-zinc-700">·</span>
              <p className="text-zinc-600 text-sm">{RACE.laps}</p>
            </div>
          </div>

          {/* Right: championship leader card */}
          <div className="hidden lg:block">
            <div
              className="border border-zinc-800/60 p-6 relative overflow-hidden"
              style={{
                background: 'rgba(255,255,255,0.02)',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              <div className="absolute top-0 left-0 h-[2px] w-full bg-gradient-to-r from-blue-500 to-transparent" />
              <p className="text-[10px] font-semibold text-zinc-500 tracking-[0.25em] uppercase mb-4">
                Championship Leader
              </p>
              <p className="text-lg font-bold text-zinc-100 leading-tight">{RACE.leader}</p>
              <p className="text-xs text-zinc-600 mt-0.5 mb-5">{RACE.team}</p>
              <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.2em] uppercase mb-1">Points</p>
              <p className="text-5xl font-black tracking-tighter text-zinc-100 tabular-nums">
                <AnimatedPoints target={RACE.points} />
              </p>
            </div>
          </div>
        </div>

        {/* Bottom action bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 md:gap-8 mt-12 pt-8 border-t border-zinc-800/40">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Timer size={14} className="text-zinc-700" />
            {RACE.date}
          </div>
          <div className="hidden sm:block h-3 w-px bg-zinc-800" />
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <FlagCheckered size={14} className="text-zinc-700" />
            {RACE.racesRemaining} races remaining
          </div>

          <div className="sm:ml-auto flex items-center gap-4">
            <button className="group flex items-center gap-2 text-[13px] font-medium text-zinc-500 hover:text-zinc-100 transition-colors duration-200">
              <Play size={13} weight="fill" className="text-red-500" />
              Watch Highlights
            </button>
            <a
              href="#"
              className="group inline-flex items-center gap-2 text-[13px] font-semibold px-5 py-2.5 bg-red-600 text-white hover:bg-red-500 transition-colors duration-200 tracking-wide active:scale-[0.98] active:-translate-y-[1px]"
            >
              Race Preview
              <ArrowRight
                size={14}
                className="group-hover:translate-x-0.5 transition-transform duration-200"
              />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}
