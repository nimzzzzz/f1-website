// What the openf1 proxy is allowed to forward.
//
// The endpoint allowlist alone was not enough: the route forwarded whatever
// query string arrived. Three consequences, all reachable by anyone who can
// hit the site:
//
//   • CACHE CARDINALITY. One unstable_cache entry is minted per distinct
//     upstream URL. `?session_key=1&x=1`, `?x=2`, `?x=3`… are all distinct
//     URLs that pass the endpoint check, so an unbounded number of cache
//     entries could be minted from a single endpoint. Even without junk
//     params, `?a=1&b=2` and `?b=2&a=1` are the same query and were two
//     entries.
//   • PAYLOAD SIZE. /laps and /position over a full race are large; nothing
//     bounded what came back or how long we would wait for it.
//   • COST. Every miss is an upstream request the site pays for.
//
// The fix is to stop forwarding and start CONSTRUCTING: only known
// parameters, only validated values, re-emitted in a canonical order. A
// request is either expressible in that vocabulary or it is rejected — so
// the set of upstream URLs this proxy can ever produce is finite and
// enumerable, rather than being whatever the caller typed.

export interface ParamSpec {
  /** Inclusive bounds for the integer value. */
  min: number
  max: number
}

/** Every parameter the application actually emits, per endpoint. */
export const ENDPOINT_PARAMS: Record<string, Record<string, ParamSpec>> = {
  // openf1 keys are 4–6 digit integers today; the ceiling is generous
  // headroom, not a prediction.
  meetings: { year: { min: 2000, max: 2100 } },
  sessions: { year: { min: 2000, max: 2100 } },
  drivers: { session_key: KEY(), meeting_key: KEY() },
  session_result: { session_key: KEY(), meeting_key: KEY() },
  // getLaps' shipped signature can emit driver_number and limit even though
  // only session_key is used today. Allowing them costs nothing — they are
  // integer-validated like everything else, and `limit` only ever SHRINKS a
  // response — and it avoids a future caller silently 400ing.
  laps: { session_key: KEY(), driver_number: { min: 1, max: 99 }, limit: { min: 1, max: 10000 } },
  position: { session_key: KEY() },
  pit: { session_key: KEY() },
  stints: { session_key: KEY() },
  race_control: { session_key: KEY() },
  weather: { session_key: KEY() },
  // team_radio and intervals are deliberately absent. lib/openf1 exports
  // getTeamRadio and getIntervals, but no page or component references
  // either — measured, not assumed. team_radio was already missing from the
  // old endpoint allowlist, so that path has never worked through the proxy
  // at all. intervals was allowed, and at ~4.2 MB for one race session it
  // was by far the largest payload the proxy could be made to fetch and
  // cache; dropping it takes the biggest reachable response down to /laps
  // at ~670 KB, which is what the size cap is sized against. Adding either
  // back would widen the surface for code nothing calls.
}

function KEY(): ParamSpec {
  return { min: 1, max: 99_999_999 }
}

export type PolicyResult =
  | { ok: true; url: string }
  | { ok: false; reason: string }

const UPSTREAM = 'https://api.openf1.org/v1'

/**
 * Build the upstream URL from an allowlisted endpoint and a validated,
 * canonically ordered subset of the caller's parameters.
 *
 * Unknown parameters are REJECTED rather than dropped: silently ignoring
 * them would let a caller mint distinct client-side URLs that all collapse
 * to one upstream call, which is confusing to debug and hides mistakes.
 */
export function buildUpstreamUrl(endpoint: string, search: URLSearchParams): PolicyResult {
  const spec = ENDPOINT_PARAMS[endpoint]
  if (!spec) return { ok: false, reason: 'endpoint not allowed' }

  const keys = [...new Set([...search.keys()])]
  for (const k of keys) {
    if (!(k in spec)) return { ok: false, reason: `parameter not allowed: ${k}` }
    // A repeated parameter is ambiguous and doubles as a cardinality trick.
    if (search.getAll(k).length > 1) return { ok: false, reason: `parameter repeated: ${k}` }
  }

  // Canonical order, so ?a=1&b=2 and ?b=2&a=1 are ONE cache entry.
  const out = new URLSearchParams()
  for (const k of Object.keys(spec).sort()) {
    const raw = search.get(k)
    if (raw === null) continue
    // Strict integer only — no leading +, no whitespace, no exponent, no
    // "01" (which would be a second spelling of the same key).
    if (!/^[0-9]{1,9}$/.test(raw)) return { ok: false, reason: `parameter not an integer: ${k}` }
    if (raw.length > 1 && raw.startsWith('0')) return { ok: false, reason: `parameter padded: ${k}` }
    const n = Number(raw)
    const { min, max } = spec[k]
    if (n < min || n > max) return { ok: false, reason: `parameter out of range: ${k}` }
    out.set(k, String(n))
  }

  // Every endpoint needs at least one selector; a bare /laps would ask
  // openf1 for the entire dataset.
  if ([...out.keys()].length === 0) return { ok: false, reason: 'no selector parameter' }

  const qs = out.toString()
  return { ok: true, url: `${UPSTREAM}/${endpoint}${qs ? `?${qs}` : ''}` }
}
