import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  resolveDriverParams,
  resolveTeamParams,
  resolveSlugs,
  ACRONYM_RE,
  SLUG_RE,
  MIN_DRIVERS,
  MIN_TEAMS,
} from '@/lib/static-params'
import { FALLBACK_DRIVER_ACRONYMS, FALLBACK_TEAM_SLUGS } from '@/lib/roster-fallback'
import type { SeasonBundle } from '@/lib/season-data'

// The regression these tests exist to prevent:
//
// generateStaticParams returned [] whenever the season bundle was blocked,
// and Next accepts an empty param list as a legitimate answer. The build
// then "succeeded" while prerendering 33 fewer pages (22 drivers + 11
// teams) — and since generateStaticParams runs only at build time, ISR
// could not repair it before the next deploy. Every poisoned-input shape
// below was observed against this repo for real.

const bundle = (over: Partial<SeasonBundle>): SeasonBundle =>
  ({
    blocked: false,
    complete: true,
    computedAt: new Date().toISOString(),
    completedRaces: 11,
    seasonYear: 2026,
    driverStandings: [],
    teamStandings: [],
    lastRace: null,
    winnersByRound: {},
    resultsByRound: {},
    meetings: [],
    sessions: [],
    ...over,
  }) as SeasonBundle

const drivers = (acrs: string[]) =>
  bundle({ driverStandings: acrs.map((a) => ({ nameAcronym: a })) as SeasonBundle['driverStandings'] })
const teams = (names: string[]) =>
  bundle({ teamStandings: names.map((t) => ({ teamName: t })) as SeasonBundle['teamStandings'] })

const realDrivers = [...FALLBACK_DRIVER_ACRONYMS]
const realTeams = ['Mercedes', 'Ferrari', 'McLaren', 'Red Bull Racing', 'Alpine',
  'Racing Bulls', 'Haas F1 Team', 'Williams', 'Audi', 'Aston Martin', 'Cadillac']

afterEach(() => vi.restoreAllMocks())
const silenceWarn = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('healthy bundle', () => {
  it('uses live data when the roster is plausible', () => {
    const r = resolveDriverParams(drivers(realDrivers))
    expect(r.source).toBe('bundle')
    expect(r.values).toHaveLength(22)
  })

  it('emits canonical LOWERCASE driver params', () => {
    const r = resolveDriverParams(drivers(realDrivers))
    expect(r.values.every((v) => v.acronym === v.acronym.toLowerCase())).toBe(true)
    expect(r.values).toContainEqual({ acronym: 'ver' })
  })

  it('slugifies team names from the bundle', () => {
    const r = resolveTeamParams(teams(realTeams))
    expect(r.source).toBe('bundle')
    expect(r.values).toContainEqual({ slug: 'haas-f1-team' })
    expect(r.values).toHaveLength(11)
  })
})

describe('poisoned input falls back instead of under-building', () => {
  it('blocked placeholder → committed roster, not []', () => {
    silenceWarn()
    const d = resolveDriverParams({ blocked: true })
    const t = resolveTeamParams({ blocked: true })
    expect(d.source).toBe('fallback')
    expect(t.source).toBe('fallback')
    expect(d.values).toHaveLength(FALLBACK_DRIVER_ACRONYMS.length)
    expect(t.values).toHaveLength(FALLBACK_TEAM_SLUGS.length)
    // the exact silent-loss case: never zero
    expect(d.values.length).toBeGreaterThanOrEqual(MIN_DRIVERS)
    expect(t.values.length).toBeGreaterThanOrEqual(MIN_TEAMS)
  })

  it('empty standings on a non-blocked bundle → fallback', () => {
    silenceWarn()
    expect(resolveDriverParams(drivers([])).source).toBe('fallback')
    expect(resolveTeamParams(teams([])).source).toBe('fallback')
  })

  it('CHALLENGE HTML parsed into the roster → fallback (shape-checked)', () => {
    silenceWarn()
    // what a Vercel Security Checkpoint body degrades into if anything
    // downstream coerces it: strings that are not acronyms
    const poisoned = ['<!DOCTYPE html>', 'Vercel Security Checkpoint', 'html', 'div', 'script']
    const r = resolveDriverParams(drivers(poisoned))
    expect(r.source).toBe('fallback')
    expect(r.values.length).toBe(FALLBACK_DRIVER_ACRONYMS.length)
  })

  it('SSO login-redirect markup → fallback', () => {
    silenceWarn()
    const r = resolveTeamParams(teams(['<html>', 'Sign in to Vercel', '']))
    expect(r.source).toBe('fallback')
  })

  it('a THREE-LETTER but non-acronym string does not satisfy the floor by shape alone', () => {
    silenceWarn()
    // 'div' is 3 chars but lowercase — the acronym shape is uppercase-only
    const r = resolveDriverParams(drivers(Array.from({ length: 30 }, () => 'div')))
    expect(r.source).toBe('fallback')
  })

  it('a partial roster below the floor → fallback, not a short build', () => {
    silenceWarn()
    const r = resolveDriverParams(drivers(realDrivers.slice(0, 5)))
    expect(r.source).toBe('fallback')
    expect(r.values).toHaveLength(FALLBACK_DRIVER_ACRONYMS.length)
  })

  it('deduplicates a roster that repeats entries', () => {
    const r = resolveDriverParams(drivers([...realDrivers, ...realDrivers]))
    expect(r.source).toBe('bundle')
    expect(r.values).toHaveLength(22)
  })
})

describe('loud failure when there is no usable source at all', () => {
  // The condition: bundle poisoned AND the committed fallback unusable
  // (file emptied, corrupted, or filtered to nothing by shape). The build
  // must STOP — shipping a partial site silently is the whole bug.
  const id = (s: string) => ({ v: s })

  it('throws rather than returning a short list', () => {
    expect(() => resolveSlugs('drivers', [], [], MIN_DRIVERS, ACRONYM_RE, id)).toThrow()
  })

  it('throws when BOTH sides are non-empty but shape-invalid', () => {
    expect(() =>
      resolveSlugs('drivers', ['<html>', 'div'], ['not-an-acronym', ''], MIN_DRIVERS, ACRONYM_RE, id)
    ).toThrow(/refusing to build/)
  })

  it('names the counts, the floor, and the remedy in the message', () => {
    let msg = ''
    try {
      resolveSlugs('teams', ['<html>'], [], MIN_TEAMS, SLUG_RE, id)
    } catch (e) {
      msg = (e as Error).message
    }
    expect(msg).toContain('refusing to build')
    expect(msg).toContain(`floor of ${MIN_TEAMS}`)
    expect(msg).toContain('challenge HTML')
    expect(msg).toContain('sync-roster')
  })

  it('does NOT throw while the fallback is still healthy', () => {
    expect(() =>
      resolveSlugs('drivers', [], FALLBACK_DRIVER_ACRONYMS, MIN_DRIVERS, ACRONYM_RE, id)
    ).not.toThrow()
  })

  it('a fallback one short of the floor still throws — no off-by-one leniency', () => {
    const justUnder = FALLBACK_DRIVER_ACRONYMS.slice(0, MIN_DRIVERS - 1)
    expect(() => resolveSlugs('drivers', [], justUnder, MIN_DRIVERS, ACRONYM_RE, id)).toThrow()
    const exactly = FALLBACK_DRIVER_ACRONYMS.slice(0, MIN_DRIVERS)
    expect(() => resolveSlugs('drivers', [], exactly, MIN_DRIVERS, ACRONYM_RE, id)).not.toThrow()
  })
})

describe('sanity floors', () => {
  it('are set below the real roster so a healthy build never trips them', () => {
    expect(MIN_DRIVERS).toBeLessThanOrEqual(FALLBACK_DRIVER_ACRONYMS.length)
    expect(MIN_TEAMS).toBeLessThanOrEqual(FALLBACK_TEAM_SLUGS.length)
  })

  it('are high enough to catch the observed failure (0 pages)', () => {
    expect(MIN_DRIVERS).toBeGreaterThan(0)
    expect(MIN_TEAMS).toBeGreaterThan(0)
  })
})
