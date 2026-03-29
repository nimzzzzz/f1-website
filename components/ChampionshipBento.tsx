'use client'

import { memo } from 'react'
import { Trophy, CaretUp, CaretDown, Minus, ArrowRight } from '@phosphor-icons/react'

const WDC = [
  { pos: 1, name: 'Max Verstappen',  abbr: 'VER', team: 'Red Bull Racing', pts: 287, nat: 'NED', color: '#3671C6', delta: 0  },
  { pos: 2, name: 'Charles Leclerc', abbr: 'LEC', team: 'Ferrari',         pts: 261, nat: 'MON', color: '#E8002D', delta: 1  },
  { pos: 3, name: 'Lando Norris',    abbr: 'NOR', team: 'McLaren',         pts: 244, nat: 'GBR', color: '#FF8000', delta: -1 },
  { pos: 4, name: 'Carlos Sainz',    abbr: 'SAI', team: 'Ferrari',         pts: 219, nat: 'ESP', color: '#E8002D', delta: 0  },
  { pos: 5, name: 'Lewis Hamilton',  abbr: 'HAM', team: 'Mercedes',        pts: 178, nat: 'GBR', color: '#27F4D2', delta: 2  },
  { pos: 6, name: 'George Russell',  abbr: 'RUS', team: 'Mercedes',        pts: 164, nat: 'GBR', color: '#27F4D2', delta: -1 },
  { pos: 7, name: 'Oscar Piastri',   abbr: 'PIA', team: 'McLaren',         pts: 149, nat: 'AUS', color: '#FF8000', delta: 0  },
]

const WCC = [
  { pos: 1, team: 'Red Bull Racing', pts: 390, color: '#3671C6' },
  { pos: 2, team: 'Ferrari',         pts: 362, color: '#E8002D' },
  { pos: 3, team: 'McLaren',         pts: 311, color: '#FF8000' },
  { pos: 4, team: 'Mercedes',        pts: 267, color: '#27F4D2' },
  { pos: 5, team: 'Aston Martin',    pts: 168, color: '#358C75' },
]

// Leader card — isolated memoized per taste-skill Bento Paradigm
const LeaderCard = memo(function LeaderCard({ d }: { d: typeof WDC[0] }) {
  return (
    <div
      className="relative overflow-hidden p-8 md:p-10"
      style={{
        background: 'rgba(255,255,255,0.018)',
        borderRight: '1px solid rgba(255,255,255,0.04)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 24px 48px -20px rgba(0,0,0,0.6)',
      }}
    >
      {/* Team color accent — top */}
      <div
        className="absolute top-0 inset-x-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, ${d.color} 0%, transparent 70%)` }}
      />

      {/* Large ghost position number */}
      <div
        className="absolute bottom-4 right-6 text-[10rem] font-black leading-none select-none pointer-events-none"
        style={{ color: 'rgba(255,255,255,0.025)' }}
      >
        01
      </div>

      <div className="relative z-10">
        {/* Label */}
        <div className="flex items-center gap-2.5 mb-7">
          <Trophy size={13} weight="fill" className="text-yellow-500" />
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-zinc-500">
            Championship Leader
          </span>
          <span
            className="w-1.5 h-1.5 rounded-full animate-pulse ml-1"
            style={{ backgroundColor: d.color }}
          />
        </div>

        <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.22em] uppercase mb-1.5">
          {d.nat} &mdash; {d.team}
        </p>
        <h2 className="text-4xl md:text-[3.5rem] font-black tracking-tighter leading-none text-zinc-100 mb-8">
          {d.name}
        </h2>

        {/* Stat row */}
        <div className="flex items-end gap-8">
          <div>
            <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.22em] uppercase mb-1">
              Points
            </p>
            <p className="text-6xl font-black tracking-tighter text-zinc-100 tabular-nums leading-none">
              {d.pts}
            </p>
          </div>
          <div className="pb-1 border-l border-zinc-800 pl-7">
            <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.22em] uppercase mb-1">
              Rounds
            </p>
            <p className="text-2xl font-bold tracking-tighter text-zinc-400 tabular-nums">
              3<span className="text-zinc-700">/24</span>
            </p>
          </div>
          <div className="pb-1 border-l border-zinc-800 pl-7">
            <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.22em] uppercase mb-1">
              Wins
            </p>
            <p className="text-2xl font-bold tracking-tighter text-zinc-400 tabular-nums">
              1
            </p>
          </div>
        </div>
      </div>
    </div>
  )
})

export default function ChampionshipBento() {
  const maxPts = WCC[0].pts

  return (
    <section className="py-24 md:py-32 max-w-[1400px] mx-auto px-6 md:px-12">
      {/* Section header */}
      <div className="flex items-end justify-between mb-12 md:mb-16">
        <div style={{ paddingLeft: '0' }}>
          <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
            2025 Season
          </p>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-100">
            Championship
          </h2>
          <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-600">
            Standings
          </h2>
        </div>
        <a
          href="#"
          className="hidden md:flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors duration-200 group"
        >
          Full standings
          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
        </a>
      </div>

      {/* Bento grid — DESIGN_VARIANCE: 8, asymmetric 2fr 1fr 1fr */}
      <div
        className="grid grid-cols-1 md:grid-cols-[2fr_1fr_1fr]"
        style={{ border: '1px solid rgba(255,255,255,0.04)', gap: '1px', background: 'rgba(255,255,255,0.04)' }}
      >
        {/* 1. Large leader card */}
        <LeaderCard d={WDC[0]} />

        {/* 2. WDC driver list */}
        <div
          className="p-6 md:p-8"
          style={{ background: 'rgba(255,255,255,0.015)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.28em] uppercase mb-6">
            Drivers Championship
          </p>
          <div className="flex flex-col divide-y divide-zinc-800/40">
            {WDC.map((d, i) => (
              <div
                key={d.pos}
                className="flex items-center gap-3 py-3 group hover:bg-zinc-800/20 transition-colors duration-150 -mx-2 px-2 rounded-sm"
              >
                <span className="text-[12px] font-bold text-zinc-700 w-4 tabular-nums">{d.pos}</span>
                <div className="w-[3px] h-5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-zinc-200 truncate">{d.abbr}</p>
                  <p className="text-[10px] text-zinc-600 truncate">{d.team}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[13px] font-bold text-zinc-100 tabular-nums">{d.pts}</span>
                  {d.delta > 0 && <CaretUp size={10} weight="fill" className="text-emerald-500" />}
                  {d.delta < 0 && <CaretDown size={10} weight="fill" className="text-red-500" />}
                  {d.delta === 0 && <Minus size={10} className="text-zinc-700" />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 3. WCC bar chart */}
        <div
          className="p-6 md:p-8 flex flex-col"
          style={{ background: 'rgba(255,255,255,0.012)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <p className="text-[10px] font-bold text-zinc-500 tracking-[0.28em] uppercase mb-6">
            Constructors Championship
          </p>
          <div className="flex flex-col gap-5 flex-1">
            {WCC.map((t) => {
              const pct = (t.pts / maxPts) * 100
              return (
                <div key={t.pos}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-semibold text-zinc-300 truncate max-w-[120px]">
                      {t.team}
                    </span>
                    <span className="text-[12px] font-bold text-zinc-100 tabular-nums">{t.pts}</span>
                  </div>
                  <div className="h-px w-full bg-zinc-800 relative">
                    <div
                      className="absolute inset-y-0 left-0 h-[2px]"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: t.color,
                        transition: 'width 1.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Gap callout */}
          <div className="mt-8 pt-6 border-t border-zinc-800/40">
            <p className="text-[10px] font-semibold text-zinc-600 tracking-[0.22em] uppercase mb-1.5">
              Gap to P2
            </p>
            <p className="text-3xl font-black tracking-tighter text-zinc-100">
              +28{' '}
              <span className="text-base font-medium text-zinc-500">pts</span>
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
