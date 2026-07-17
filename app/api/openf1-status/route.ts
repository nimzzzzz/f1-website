// Server-side probe for the openf1 live-session lockout. Browsers can't
// read the API's 401 (its error responses lack CORS headers), so the client
// asks this same-origin route, which can see the real status.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const res = await fetch('https://api.openf1.org/v1/meetings?year=2026', {
      cache: 'no-store',
    })
    return Response.json({ blocked: res.status === 401, status: res.status })
  } catch {
    // openf1 unreachable entirely — that's an outage, not the lockout
    return Response.json({ blocked: false, status: 0 })
  }
}
