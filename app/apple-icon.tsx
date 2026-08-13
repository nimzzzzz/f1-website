import { ImageResponse } from 'next/og'

// Generated rather than committed as a binary: the mark is two type tokens
// the site already owns (the accent and the near-black ground), so it can
// never drift from them.
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0a0a0a',
        }}
      >
        {/* Five lights out — the site's name, as a mark. */}
        <div style={{ display: 'flex', gap: 12 }}>
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              style={{ width: 20, height: 20, borderRadius: 20, background: '#e10600' }}
            />
          ))}
        </div>
      </div>
    ),
    size
  )
}
