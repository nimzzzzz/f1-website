import { MapPin, CalendarBlank, ArrowRight, CheckCircle } from '@phosphor-icons/react/dist/ssr'

const RACES = [
  { r: 1,  name: 'Bahrain Grand Prix',         country: 'Bahrain',      date: 'Mar 2',  status: 'done',     winner: 'Verstappen', wTeam: 'RBR' },
  { r: 2,  name: 'Saudi Arabian Grand Prix',   country: 'Saudi Arabia', date: 'Mar 9',  status: 'done',     winner: 'Leclerc',    wTeam: 'FER' },
  { r: 3,  name: 'Australian Grand Prix',      country: 'Australia',    date: 'Mar 16', status: 'done',     winner: 'Norris',     wTeam: 'MCL' },
  { r: 4,  name: 'Japanese Grand Prix',        country: 'Japan',        date: 'Mar 30', status: 'next',     winner: null,         wTeam: null  },
  { r: 5,  name: 'Chinese Grand Prix',         country: 'China',        date: 'Apr 6',  status: 'upcoming', winner: null,         wTeam: null  },
  { r: 6,  name: 'Miami Grand Prix',           country: 'USA',          date: 'May 4',  status: 'upcoming', winner: null,         wTeam: null  },
  { r: 7,  name: 'Emilia Romagna Grand Prix',  country: 'Italy',        date: 'May 18', status: 'upcoming', winner: null,         wTeam: null  },
  { r: 8,  name: 'Monaco Grand Prix',          country: 'Monaco',       date: 'May 25', status: 'upcoming', winner: null,         wTeam: null  },
]

const UPCOMING = RACES.filter((r) => r.status === 'upcoming')
const PAST_AND_NEXT = RACES.filter((r) => r.status !== 'upcoming')

export default function RaceCalendar() {
  return (
    <section className="py-24 md:py-32 border-t border-zinc-800/30">
      <div className="max-w-[1400px] mx-auto px-6 md:px-12">
        {/* Header */}
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] items-end gap-6 mb-14">
          <div style={{ paddingLeft: '20vw' }} className="md:pl-0">
            <p className="text-[11px] font-bold text-red-500 tracking-[0.3em] uppercase mb-3">
              Race Calendar
            </p>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-100">
              2025 Season
            </h2>
            <h2 className="text-4xl md:text-5xl font-black tracking-tighter leading-none text-zinc-600">
              Schedule
            </h2>
          </div>
          <a
            href="#"
            className="hidden md:flex items-center gap-2 text-[13px] text-zinc-500 hover:text-zinc-100 transition-colors group"
          >
            Full calendar
            <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform duration-200" />
          </a>
        </div>

        {/* Asymmetric 2-col grid — left: past/next, right: upcoming + progress */}
        <div className="grid grid-cols-1 md:grid-cols-[2fr_1fr] gap-px bg-zinc-800/25">
          {/* Left column: completed + next */}
          <div className="divide-y divide-zinc-800/25 bg-zinc-950">
            {PAST_AND_NEXT.map((race) => (
              <div
                key={race.r}
                className="group flex items-center gap-5 px-6 py-5 hover:bg-zinc-900/50 transition-colors duration-200 cursor-pointer"
              >
                {/* Round */}
                <span className="text-[11px] font-bold text-zinc-700 w-6 shrink-0 tabular-nums">
                  R{race.r}
                </span>

                {/* Status dot */}
                <div className="shrink-0 w-4 flex justify-center">
                  {race.status === 'done' && (
                    <CheckCircle size={14} weight="fill" className="text-zinc-600" />
                  )}
                  {race.status === 'next' && (
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
                  )}
                </div>

                {/* Race info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-[13px] font-bold truncate ${
                      race.status === 'next' ? 'text-zinc-100' : 'text-zinc-400'
                    }`}
                  >
                    {race.name}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <div className="flex items-center gap-1">
                      <MapPin size={10} className="text-zinc-700" />
                      <span className="text-[11px] text-zinc-600">{race.country}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <CalendarBlank size={10} className="text-zinc-700" />
                      <span className="text-[11px] text-zinc-600">{race.date}</span>
                    </div>
                  </div>
                </div>

                {/* Result / badge */}
                <div className="shrink-0 text-right">
                  {race.status === 'done' && race.winner && (
                    <>
                      <p className="text-[12px] font-semibold text-zinc-400">{race.winner}</p>
                      <p className="text-[10px] text-zinc-600">{race.wTeam}</p>
                    </>
                  )}
                  {race.status === 'next' && (
                    <span className="text-[10px] font-bold text-red-500 tracking-[0.2em] uppercase border border-red-600/30 px-2 py-0.5">
                      Next
                    </span>
                  )}
                </div>

                <ArrowRight
                  size={13}
                  className="text-zinc-800 group-hover:text-zinc-500 transition-colors duration-200 shrink-0"
                />
              </div>
            ))}
          </div>

          {/* Right column: upcoming list + season progress */}
          <div className="bg-zinc-900/25">
            {/* Upcoming races list */}
            <div className="p-6 md:p-8 border-b border-zinc-800/25 relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-red-950/10 to-transparent pointer-events-none" />
              <p className="text-[10px] font-bold text-zinc-500 tracking-[0.28em] uppercase mb-5">
                Coming Up
              </p>
              <div className="flex flex-col gap-4">
                {UPCOMING.map((race) => (
                  <div key={race.r} className="flex items-center gap-4">
                    <span className="text-[10px] font-bold text-zinc-700 w-5 tabular-nums shrink-0">
                      R{race.r}
                    </span>
                    <div>
                      <p className="text-[13px] font-semibold text-zinc-300 leading-tight">
                        {race.country}
                      </p>
                      <p className="text-[11px] text-zinc-600">{race.date}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Season progress bar */}
            <div className="p-6 md:p-8">
              <p className="text-[10px] font-bold text-zinc-500 tracking-[0.28em] uppercase mb-5">
                Season Progress
              </p>
              <div className="flex gap-[2px] flex-wrap">
                {Array.from({ length: 24 }, (_, i) => (
                  <div
                    key={i}
                    className={`h-5 flex-1 min-w-[8px] max-w-[12px] transition-colors duration-300 ${
                      i < 3
                        ? 'bg-zinc-500'
                        : i === 3
                        ? 'bg-red-600'
                        : 'bg-zinc-800/70'
                    }`}
                    title={`Round ${i + 1}`}
                  />
                ))}
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-zinc-700">R1</span>
                <span className="text-[10px] text-zinc-700">R24</span>
              </div>
              <p className="text-xs text-zinc-600 mt-3 font-medium">
                3 of 24 rounds completed
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
