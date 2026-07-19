'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import type { Driver, Meeting } from '@/lib/openf1'
import { getCachedLatestDrivers } from '@/lib/client-cache'
import { getRaceMeetings } from '@/lib/openf1'
import { fetchSeasonData, bundleAsOf, type SeasonBundle } from '@/lib/season-data'
import { DRIVER_PHOTOS, CAREER_STATS, DRIVER_NATIONALITIES } from '@/lib/driver-data'
import { teamToSlug } from '@/lib/team-data'
import { driverImage, carImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'
import { ClipReveal, CountUp, FadeUp } from '@/components/motion/reveals'
import { TransitionLink } from '@/components/motion/TransitionProvider'

interface SeasonRecordRow {
  round: number
  circuit: string
  position: number | null
  points: number
  out: boolean
}

export default function DriverPage() {
  const params = useParams()
  const acronym = (params.acronym as string).toUpperCase()
  const [driver, setDriver] = useState<Driver | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [bundle, setBundle] = useState<SeasonBundle | null>(null)

  useEffect(() => {
    getCachedLatestDrivers().then((drivers) => {
      const found = drivers.find((d) => d.name_acronym === acronym)
      if (found) setDriver(found)
      else setNotFound(true)
    }).finally(() => setLoading(false))
  }, [acronym])

  // Season record + stats from the server bundle — no client pipelines.
  useEffect(() => {
    let alive = true
    fetchSeasonData().then((b) => {
      if (alive && b) setBundle(b)
    })
    return () => {
      alive = false
    }
  }, [])

  // The hero photo is derivable from the URL acronym alone — no data fetch.
  // Rendering it (priority) even while the driver record is still loading puts
  // its <link rel=preload> in the SSR HTML, so it downloads in the first
  // request wave instead of waiting ~2s for JS to hydrate and fetch.
  const heroPhoto = driverImage(acronym) ?? DRIVER_PHOTOS[acronym] ?? null

  if (loading) {
    return (
      <div className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-16 pt-8 md:px-14">
        {heroPhoto && (
          <TreatedImage
            src={heroPhoto}
            treatment="mono"
            priority
            sizes="(min-width: 768px) 42vw, 62vw"
            className="pointer-events-none absolute right-0 top-0 h-full w-[62%] md:w-[42%]"
          />
        )}
        <div className="relative">
          <div className="h-3 w-32 animate-pulse rounded bg-white/5" />
          <div className="mt-8 h-40 w-[60%] animate-pulse rounded bg-white/5" />
        </div>
      </div>
    )
  }

  if (notFound || !driver) {
    return (
      <div className="flex min-h-[calc(100dvh-4rem)] flex-col items-start justify-center gap-6 px-6 md:px-14">
        <p className="label-mono text-[var(--text-dim)]">DRIVER NOT FOUND</p>
        <TransitionLink
          href="/drivers"
          className="label-mono text-[var(--text)] transition-colors hover:text-[var(--accent)]"
        >
          ← THE GRID
        </TransitionLink>
      </div>
    )
  }

  // Same URL-derived asset preloaded above (cache hit); openf1 headshot only
  // as a last resort when the acronym has no local/curated image.
  const photo = heroPhoto ?? driver.headshot_url
  const car = driver.team_name ? carImage(teamToSlug(driver.team_name)) : null
  const career = CAREER_STATS[acronym]
  const nationality = DRIVER_NATIONALITIES[acronym] ?? driver.country_code ?? ''
  const teamColor = `#${driver.team_colour || 'F5F5F3'}`

  // ── bundle joins ──
  const standing = bundle?.driverStandings.find((d) => d.driverNumber === driver.driver_number)
  const asOf = bundle ? bundleAsOf(bundle) : null

  let record: SeasonRecordRow[] = []
  if (bundle) {
    const ordered: Meeting[] = getRaceMeetings(bundle.meetings).sort(
      (a, b) => new Date(a.date_start).getTime() - new Date(b.date_start).getTime()
    )
    record = ordered
      .map((m, i) => {
        const rows = bundle.resultsByRound[m.meeting_key]
        if (!rows) return null
        const mine = rows.find((r) => r.d === driver.driver_number)
        if (!mine) return null
        return {
          round: i + 1,
          circuit: m.circuit_short_name,
          position: mine.p,
          points: mine.pts,
          out: Boolean(mine.out),
        }
      })
      .filter((r): r is SeasonRecordRow => r !== null)
  }
  const bestFinish = record.reduce<number | null>(
    (best, r) => (r.position !== null && !r.out && (best === null || r.position < best) ? r.position : best),
    null
  )

  return (
    <div className="overflow-x-clip">
      {/* ─── hero: arriving from the gallery, same grammar ─── */}
      <section className="relative flex min-h-[calc(100dvh-4rem)] flex-col justify-end overflow-hidden px-6 pb-16 pt-8 md:px-14">
        {/* driver photo, dark-treated, behind the number */}
        {photo && (
          <TreatedImage
            src={photo}
            treatment="mono"
            priority
            sizes="(min-width: 768px) 42vw, 62vw"
            className="pointer-events-none absolute right-0 top-0 h-full w-[62%] md:w-[42%]"
          />
        )}

        {/* the race number — massive, team-colour outline (gallery grammar) */}
        <span
          aria-hidden
          className="pointer-events-none absolute right-[2vw] top-1/2 -translate-y-1/2 leading-none"
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'clamp(14rem, 30vw, 26rem)',
            color: 'transparent',
            WebkitTextStroke: `2px ${teamColor}`,
            opacity: 0.55,
          }}
        >
          {driver.driver_number}
        </span>

        <TransitionLink
          href="/drivers"
          className="strip-header absolute left-6 top-8 text-[var(--text-dim)] transition-colors hover:text-[var(--accent)] md:left-14"
        >
          ← THE GRID
        </TransitionLink>

        <div className="relative">
          <p className="label-mono mb-3 text-[var(--text-dim)]">{driver.first_name?.toUpperCase()}</p>
          <h1
            className="uppercase leading-[0.85] text-[var(--text)]"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(4rem, 11vw, 11rem)' }}
          >
            {driver.last_name}
          </h1>
          <div className="label-mono mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--text-dim)]">
            <span className="flex items-center gap-2">
              <span aria-hidden className="inline-block h-[2px] w-3" style={{ backgroundColor: teamColor }} />
              {driver.team_name?.toUpperCase()}
            </span>
            {nationality && <span>{nationality.toUpperCase()}</span>}
            <span>#{driver.driver_number}</span>
            {standing && <span className="text-[var(--text)]">CHAMPIONSHIP P{standing.position}</span>}
          </div>
        </div>
      </section>

      {/* ─── season stats: asymmetric numerals, not a card grid ─── */}
      {standing && (
        <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-24">
          <FadeUp>
            <p className="label-mono mb-12 flex flex-wrap gap-x-4 text-[var(--text-dim)]">
              THIS SEASON{asOf && <span>AS OF {asOf}</span>}
            </p>
          </FadeUp>
          <div className="flex flex-wrap items-baseline gap-x-16 gap-y-10 md:gap-x-24">
            <div>
              <span
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(4.5rem, 10vw, 9rem)' }}
              >
                <CountUp value={Math.floor(standing.points)} />
              </span>
              <p className="label-mono mt-3 text-[var(--text-dim)]">POINTS</p>
            </div>
            <div>
              <span
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(2.6rem, 5.5vw, 5rem)' }}
              >
                <CountUp value={standing.wins} />
              </span>
              <p className="label-mono mt-3 text-[var(--text-dim)]">WINS</p>
            </div>
            <div>
              <span
                className="font-mono tabular-nums leading-none text-[var(--text)]"
                style={{ fontSize: 'clamp(2.6rem, 5.5vw, 5rem)' }}
              >
                <CountUp value={standing.podiums} />
              </span>
              <p className="label-mono mt-3 text-[var(--text-dim)]">PODIUMS</p>
            </div>
            {bestFinish !== null && (
              <div>
                <span
                  className="font-mono tabular-nums leading-none"
                  style={{
                    fontSize: 'clamp(1.9rem, 4vw, 3.4rem)',
                    color: bestFinish === 1 ? 'var(--accent)' : 'var(--text)',
                  }}
                >
                  P{bestFinish}
                </span>
                <p className="label-mono mt-3 text-[var(--text-dim)]">BEST FINISH</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ─── season record: one typographic row per grand prix ─── */}
      {record.length > 0 && (
        <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-24">
          <FadeUp>
            <p className="label-mono mb-10 text-[var(--text-dim)]">
              SEASON RECORD — {String(record.length).padStart(2, '0')} ROUNDS
            </p>
          </FadeUp>
          <div>
            {record.map((r) => (
              <ClipReveal key={r.round}>
                <div
                  className="flex items-baseline gap-5 border-t border-[var(--line)] py-3 md:gap-8"
                  style={r.out ? { opacity: 0.35 } : undefined}
                >
                  <span
                    className="outline-numeral w-12 shrink-0 leading-none"
                    style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem' }}
                  >
                    {String(r.round).padStart(2, '0')}
                  </span>
                  <p
                    className={`min-w-0 flex-1 truncate uppercase leading-none text-[var(--text)] ${
                      r.out ? 'line-through decoration-1' : ''
                    }`}
                    style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.4rem, 2.4vw, 2rem)' }}
                  >
                    {r.circuit}
                  </p>
                  <span
                    className="label-mono w-14 shrink-0 text-right tabular-nums"
                    style={{
                      color: r.out
                        ? 'var(--text-dim)'
                        : r.position === 1
                        ? 'var(--accent)'
                        : 'var(--text)',
                    }}
                  >
                    {r.out ? 'DNF' : r.position !== null ? `P${r.position}` : '—'}
                  </span>
                  <span className="label-mono w-20 shrink-0 text-right tabular-nums text-[var(--text-dim)]">
                    {r.points > 0 ? `+${Math.floor(r.points)} PTS` : '—'}
                  </span>
                </div>
              </ClipReveal>
            ))}
          </div>
        </section>
      )}

      {/* ─── the machine: car render, team colour kept at low saturation ─── */}
      {car && (
        <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-24">
          <FadeUp>
            <p className="label-mono mb-10 text-[var(--text-dim)]">
              THE CAR — {driver.team_name?.toUpperCase()}
            </p>
          </FadeUp>
          <div className="relative max-w-5xl">
            <span
              aria-hidden
              className="absolute -top-4 left-0 h-[2px] w-16 md:w-24"
              style={{ backgroundColor: teamColor }}
            />
            <TreatedImage
              src={car}
              treatment="team"
              aspect="21/9"
              position="center"
              sizes="(min-width: 768px) 70vw, 100vw"
              className="w-full"
            />
          </div>
        </section>
      )}

      {/* ─── career + info: kept content, mono treatment ─── */}
      <section className="border-t border-[var(--line)] px-6 py-20 md:px-14 md:py-24">
        <div className="grid grid-cols-1 gap-16 md:grid-cols-2">
          {career && (
            <div>
              <FadeUp>
                <p className="label-mono mb-8 text-[var(--text-dim)]">CAREER</p>
              </FadeUp>
              <div>
                {[
                  ['GRANDS PRIX', career.grandsPrix],
                  ['WORLD TITLES', career.championships],
                  ['WINS', career.wins],
                  ['PODIUMS', career.podiums],
                  ['POLE POSITIONS', career.poles],
                  ['CAREER POINTS', career.points],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="label-mono flex items-baseline justify-between border-t border-[var(--line)] py-3"
                  >
                    <span className="text-[var(--text-dim)]">{label}</span>
                    <span
                      className="font-mono text-base tabular-nums"
                      style={{ color: (value as number) > 0 ? 'var(--text)' : 'var(--text-dim)' }}
                    >
                      {value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div>
            <FadeUp>
              <p className="label-mono mb-8 text-[var(--text-dim)]">DRIVER</p>
            </FadeUp>
            <p className="max-w-md text-sm leading-relaxed text-[var(--text-dim)]">
              {driver.full_name} is competing in the {bundle?.seasonYear ?? 2026} Formula 1 World
              Championship with {driver.team_name}.
            </p>
            <div className="mt-8">
              {[
                ['NUMBER', `#${driver.driver_number}`],
                ['TEAM', driver.team_name],
                ...(nationality ? [['NATIONALITY', nationality.toUpperCase()]] : []),
                ...(career && career.championships > 0
                  ? [['WORLD CHAMPION', `${career.championships}×`]]
                  : []),
              ].map(([label, value]) => (
                <div
                  key={label as string}
                  className="label-mono flex items-baseline justify-between border-t border-[var(--line)] py-3"
                >
                  <span className="text-[var(--text-dim)]">{label}</span>
                  <span className="text-[var(--text)]">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
