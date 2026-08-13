import { describe, it, expect, beforeEach } from 'vitest'
import { buildUpstreamUrl, ENDPOINT_PARAMS } from '@/lib/openf1-proxy-policy'
import { rateLimit, clientKey, __resetRateLimit } from '@/lib/rate-limit'

const build = (endpoint: string, qs: string) =>
  buildUpstreamUrl(endpoint, new URLSearchParams(qs))

describe('the proxy constructs upstream URLs rather than forwarding them', () => {
  it('allows exactly what the app emits', () => {
    expect(build('sessions', 'year=2026')).toEqual({
      ok: true,
      url: 'https://api.openf1.org/v1/sessions?year=2026',
    })
    expect(build('laps', 'session_key=11342')).toEqual({
      ok: true,
      url: 'https://api.openf1.org/v1/laps?session_key=11342',
    })
    expect(build('session_result', 'meeting_key=1290')).toEqual({
      ok: true,
      url: 'https://api.openf1.org/v1/session_result?meeting_key=1290',
    })
  })

  it('rejects an endpoint that is not allowlisted', () => {
    expect(build('secrets', 'session_key=1').ok).toBe(false)
    expect(build('car_data', 'session_key=1').ok).toBe(false)
  })

  it('rejects unknown parameters instead of silently dropping them', () => {
    // Dropping them would let a caller mint unlimited DISTINCT client URLs
    // that all collapse to one upstream call — confusing, and it hides
    // mistakes. Rejecting says what happened.
    const r = build('laps', 'session_key=11342&junk=1')
    expect(r.ok).toBe(false)
    expect(r.ok === false && r.reason).toMatch(/junk/)
  })

  it('CANNOT be used to mint unbounded cache entries', () => {
    // The cardinality attack: unique query strings, each a new cache entry
    // and a new upstream request. Every one of these is now refused.
    for (let i = 0; i < 50; i++) {
      expect(build('laps', `session_key=11342&cachebust=${i}`).ok).toBe(false)
    }
  })

  it('collapses parameter ORDER to one canonical cache key', () => {
    const a = build('drivers', 'session_key=1&meeting_key=2')
    const b = build('drivers', 'meeting_key=2&session_key=1')
    expect(a.ok && b.ok).toBe(true)
    expect(a).toEqual(b)
  })

  it('rejects repeated parameters', () => {
    expect(build('laps', 'session_key=1&session_key=2').ok).toBe(false)
  })

  it('rejects non-integer and out-of-range values', () => {
    expect(build('laps', 'session_key=abc').ok).toBe(false)
    expect(build('laps', 'session_key=-1').ok).toBe(false)
    expect(build('laps', 'session_key=1.5').ok).toBe(false)
    expect(build('laps', 'session_key=1e5').ok).toBe(false)
    expect(build('laps', 'session_key=').ok).toBe(false)
    expect(build('sessions', 'year=1776').ok).toBe(false)
    expect(build('laps', 'driver_number=9999').ok).toBe(false)
  })

  it('rejects zero-padded spellings — one value, one cache key', () => {
    expect(build('laps', 'session_key=011342').ok).toBe(false)
  })

  it('refuses a selector-less request that would pull the whole dataset', () => {
    expect(build('laps', '').ok).toBe(false)
    expect(build('position', '').ok).toBe(false)
  })

  it('cannot be steered to another host by the endpoint segment', () => {
    // params.path is joined with '/', so a traversal attempt arrives as a
    // single string; it simply is not an allowlisted endpoint.
    expect(build('../../evil', 'session_key=1').ok).toBe(false)
    expect(build('https://evil.test/x', 'session_key=1').ok).toBe(false)
    for (const r of [build('meetings', 'year=2026')]) {
      expect(r.ok && r.url.startsWith('https://api.openf1.org/v1/')).toBe(true)
    }
  })

  it('every allowlisted endpoint only accepts integer params', () => {
    for (const [endpoint, spec] of Object.entries(ENDPOINT_PARAMS)) {
      for (const [param, { min, max }] of Object.entries(spec)) {
        expect(Number.isInteger(min) && Number.isInteger(max)).toBe(true)
        expect(build(endpoint, `${param}=${min}`).ok).toBe(true)
        expect(build(endpoint, `${param}=${max + 1}`).ok).toBe(false)
      }
    }
  })

  it('excludes the two dead endpoints', () => {
    // Measured: no page or component references getTeamRadio or
    // getIntervals. intervals was the largest payload the proxy could be
    // made to cache (~4.2 MB for one session).
    expect(build('team_radio', 'session_key=1').ok).toBe(false)
    expect(build('intervals', 'session_key=1').ok).toBe(false)
  })
})

describe('per-client rate limiting', () => {
  beforeEach(() => __resetRateLimit())

  it('allows a normal browsing burst and stops a runaway', () => {
    for (let i = 0; i < 60; i++) {
      expect(rateLimit('1.2.3.4', 60, 60_000).allowed).toBe(true)
    }
    const over = rateLimit('1.2.3.4', 60, 60_000)
    expect(over.allowed).toBe(false)
    expect(over.retryAfter).toBeGreaterThan(0)
  })

  it('buckets clients independently', () => {
    for (let i = 0; i < 60; i++) rateLimit('1.1.1.1', 60, 60_000)
    expect(rateLimit('1.1.1.1', 60, 60_000).allowed).toBe(false)
    expect(rateLimit('2.2.2.2', 60, 60_000).allowed).toBe(true)
  })

  it('takes the leftmost x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1, 10.0.0.2' })
    expect(clientKey(h)).toBe('9.9.9.9')
  })

  it('falls back rather than throwing when identity is absent', () => {
    expect(clientKey(new Headers())).toBe('unknown')
  })

  it('bounds the key length so a huge header cannot bloat the map', () => {
    const h = new Headers({ 'x-forwarded-for': 'x'.repeat(5000) })
    expect(clientKey(h).length).toBeLessThanOrEqual(64)
  })
})
