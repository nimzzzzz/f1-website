import { ImageResponse } from 'next/og'

// MOCKUP ONLY — not wired to any route's metadata. Built so the shape can
// be judged before committing to a whole set. Data is hardcoded here; a
// real implementation would read the season bundle at build/revalidate
// time, never at request time.
export const runtime = 'nodejs'

export async function GET() {
  const d = { number: 1, surname: 'VERSTAPPEN', first: 'MAX',
    team: 'RED BULL RACING', colour: '#3671C6', position: 6, points: 109 }
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    background: '#0a0a0a', padding: 64, position: 'relative' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex',
          background: `linear-gradient(105deg, ${d.colour}33 0%, #0a0a0a 62%)` }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative',
                      fontFamily: 'monospace', fontSize: 22, letterSpacing: 6,
                      color: 'rgba(245,245,243,0.55)' }}>
          <div style={{ display: 'flex' }}>LIGHTS OUT</div>
          <div style={{ display: 'flex' }}>2026</div>
        </div>
        <div style={{ position: 'absolute', right: 56, top: 96, fontSize: 300, fontWeight: 800,
                      color: 'transparent', WebkitTextStroke: `3px ${d.colour}`, display: 'flex' }}>
          {d.number}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', position: 'relative' }}>
          <div style={{ display: 'flex', fontFamily: 'monospace', fontSize: 22, letterSpacing: 6,
                        color: 'rgba(245,245,243,0.55)' }}>{d.first}</div>
          <div style={{ display: 'flex', fontSize: 132, fontWeight: 800, color: '#f5f5f3',
                        lineHeight: 1, marginTop: 6 }}>{d.surname}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginTop: 26,
                        fontFamily: 'monospace', fontSize: 24, letterSpacing: 4,
                        color: 'rgba(245,245,243,0.55)' }}>
            <div style={{ display: 'flex', width: 26, height: 3, background: d.colour }} />
            <div style={{ display: 'flex' }}>{d.team}</div>
            <div style={{ display: 'flex', color: '#f5f5f3' }}>P{d.position} · {d.points} PTS</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
