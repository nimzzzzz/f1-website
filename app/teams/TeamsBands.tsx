'use client'

import { teamToSlug } from '@/lib/team-data'
import { carImage, teamLogoImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'
import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

// Constructor bands — identity SSR'd by app/teams/page.tsx from the server
// bundle; this component owns reveals, hover, and navigation.
export interface BandTeam {
  name: string
  colour: string
  points: number
  position: number
  wins: number
  drivers: { surname: string; driverNumber: number }[]
}

const pad2 = (n: number) => String(n).padStart(2, '0')

export default function TeamsBands({
  teams,
  seasonYear,
  asOf,
}: {
  teams: BandTeam[]
  seasonYear: number | null
  asOf: string | null
}) {
  return (
    <div className="relative overflow-x-clip px-6 pb-28 pt-20 md:px-14">
      <FadeUp>
        <p className="strip-header flex flex-wrap gap-x-4 text-[var(--text-dim)]">
          CONSTRUCTORS&rsquo; CHAMPIONSHIP{seasonYear ? ` — ${seasonYear}` : ''}
          {asOf && <span>AS OF {asOf}</span>}
        </p>
      </FadeUp>

      <div className="mt-12">
        {teams.map((team, idx) => {
          const slug = teamToSlug(team.name)
          const car = carImage(slug)
          const logo = teamLogoImage(slug)
          // The top two bands sit in the opening viewport at common heights —
          // load their imagery eagerly so it's painted, not popped in on scroll.
          const aboveFold = idx < 2
          return (
            <ClipReveal key={team.name}>
              <TransitionLink
                href={`/teams/${slug}`}
                className="group relative block overflow-hidden border-t border-[var(--line)] py-10 md:py-12"
              >
                {/* the car — low-saturation livery riding the band, under the
                    numeral. Desktop-only (hidden md:block): kept lazy so mobile
                    never fetches it — in the SSR HTML the scanner loads the
                    in-viewport top bands immediately on desktop anyway. */}
                {car && (
                  <TreatedImage
                    src={car}
                    treatment="team"
                    position="right bottom"
                    sizes="32vw"
                    className="pointer-events-none absolute bottom-0 right-[7vw] hidden h-[88%] w-[32vw] max-w-[500px] opacity-90 md:block"
                  />
                )}

                {/* constructors position — outline numeral behind the band */}
                <span
                  aria-hidden
                  className="outline-numeral pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 leading-none"
                  style={{ fontSize: 'clamp(7rem, 15vw, 13rem)' }}
                >
                  {pad2(team.position)}
                </span>

                {/* the team's colour as a thin leading rule — their accent */}
                <span
                  aria-hidden
                  className="absolute left-0 top-0 h-[2px] w-16 md:w-24"
                  style={{ backgroundColor: team.colour }}
                />

                <div className="relative flex flex-wrap items-baseline gap-x-10 gap-y-4">
                  <div className="flex items-center gap-4 transition-transform duration-300 group-hover:translate-x-3 motion-reduce:transition-none md:gap-5">
                    {logo && (
                      <TreatedImage
                        src={logo}
                        treatment="mono"
                        eager={aboveFold}
                        fade={false}
                        position="center"
                        sizes="48px"
                        className="h-8 w-8 shrink-0 opacity-70 md:h-10 md:w-10"
                      />
                    )}
                    <h2
                      className="uppercase leading-[0.9] text-[var(--text)]"
                      style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.6rem, 6.5vw, 6rem)' }}
                    >
                      {team.name}
                    </h2>
                  </div>
                  <span className="shrink-0">
                    <span
                      className="font-mono tabular-nums text-[var(--text)]"
                      style={{ fontSize: 'clamp(1.4rem, 2.8vw, 2.4rem)' }}
                    >
                      <CountUp value={team.points} />
                    </span>
                    <span className="label-mono ml-2 text-[var(--text-dim)]">PTS</span>
                  </span>
                </div>

                <div className="label-mono relative mt-4 flex flex-wrap items-center gap-x-8 gap-y-2 text-[var(--text-dim)]">
                  {team.drivers.map((d) => (
                    <span key={d.driverNumber}>
                      {d.surname} <span className="opacity-60">#{d.driverNumber}</span>
                    </span>
                  ))}
                  {team.wins > 0 && <span>· {team.wins} WIN{team.wins > 1 ? 'S' : ''}</span>}
                  <span className="opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
                    TEAM →
                  </span>
                </div>
              </TransitionLink>
            </ClipReveal>
          )
        })}
      </div>
    </div>
  )
}
