import { ImageResponse } from 'next/og'

// MOCKUP ONLY — see the driver card.
export const runtime = 'nodejs'

export async function GET() {
  const r = { round: 12, name: 'DUTCH GRAND PRIX', circuit: 'ZANDVOORT', date: 'AUG 21 — AUG 23' }
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
                    background: '#0a0a0a', padding: 64, position: 'relative' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'monospace',
                      fontSize: 22, letterSpacing: 6, color: 'rgba(245,245,243,0.55)' }}>
          <div style={{ display: 'flex' }}>LIGHTS OUT</div>
          <div style={{ display: 'flex' }}>2026</div>
        </div>
        <div style={{ position: 'absolute', right: 56, top: 70, fontSize: 340, fontWeight: 800,
                      color: 'transparent', WebkitTextStroke: '3px rgba(245,245,243,0.10)', display: 'flex' }}>
          {String(r.round).padStart(2, '0')}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, fontFamily: 'monospace',
                        fontSize: 22, letterSpacing: 6, color: '#e10600' }}>
            <div style={{ display: 'flex', width: 34, height: 3, background: '#e10600' }} />
            <div style={{ display: 'flex' }}>ROUND {String(r.round).padStart(2, '0')}</div>
          </div>
          <div style={{ display: 'flex', fontSize: 118, fontWeight: 800, color: '#f5f5f3',
                        lineHeight: 1, marginTop: 10 }}>{r.circuit}</div>
          <div style={{ display: 'flex', gap: 22, marginTop: 24, fontFamily: 'monospace',
                        fontSize: 24, letterSpacing: 4, color: 'rgba(245,245,243,0.55)' }}>
            <div style={{ display: 'flex' }}>{r.name}</div>
            <div style={{ display: 'flex' }}>·</div>
            <div style={{ display: 'flex' }}>{r.date}</div>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
