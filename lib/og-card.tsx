import { readFileSync } from 'node:fs'
import path from 'node:path'

// SHARE CARDS, in the site's language.
//
// TWO THINGS SATORI CANNOT DO, and what stands in for them:
//
// 1. The oversized OUTLINE NUMERAL — the site's signature, the ghost round
//    number behind the season strip and the car number behind a driver.
//    Neither obvious route works: -webkit-text-stroke is ignored outright
//    (the first mockup simply had no numeral), and SVG <text stroke> is a
//    hard build error ("not currently supported, please convert them to
//    <path>"). See the numeral note below — it is solid, on evidence.
//
// 2. Eight-digit hex (#RRGGBBAA) in gradients, which is why the livery
//    wash was missing from the mockup rather than merely faint. Written as
//    rgba() instead — see liveryWash below.
//
// FONTS ARE LOCAL. geist ships real TTFs inside node_modules, so the mono
// register is EXACT (it is the site's own --font-mono) and nothing is
// fetched at build time. That matters: a build here has already been
// broken once by a Google Fonts hiccup, and share cards are not worth
// reintroducing that dependency for. The display face is Geist Black
// rather than Bebas Neue — Bebas only exists as a next/font download, and
// tight-tracked Black is the closest local match.

const FONT_DIR = path.join(process.cwd(), 'node_modules/geist/dist/fonts')

const readFont = (rel: string) => readFileSync(path.join(FONT_DIR, rel))

export const ogFonts = [
  { name: 'Geist', data: readFont('geist-sans/Geist-Black.ttf'), weight: 900 as const, style: 'normal' as const },
  { name: 'Geist', data: readFont('geist-sans/Geist-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
  { name: 'GeistMono', data: readFont('geist-mono/GeistMono-Medium.ttf'), weight: 500 as const, style: 'normal' as const },
]

export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = 'image/png'

const BG = '#0a0a0a'
const TEXT = '#f5f5f3'
const DIM = 'rgba(245,245,243,0.55)'

/** hex -> rgba(), because Satori will not parse #RRGGBBAA. */
export function liveryWash(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * THE NUMERAL IS SOLID, and the outline was abandoned on evidence.
 *
 * Three attempts at the site's hollow numeral, none of which Satori can do:
 *   -webkit-text-stroke   ignored outright — the first cards had no numeral.
 *   SVG <text stroke>     hard build error: "not currently supported,
 *                         please convert them to <path>".
 *   text-shadow ring      renders, but WRONG: each offset copy is occluded
 *                         by its neighbours, so only fragments of the ring
 *                         survive. Rendered side by side against solid, the
 *                         McLaren "1" came out as a broken top serif, half a
 *                         stem and a floating bottom bar. It reads as a
 *                         rendering fault, not a design choice.
 *
 * Solid is also the better call on its own merits, independent of Satori.
 * The outline earns its place ON THE SITE because it is enormous, sits
 * against depth, and has content showing through it. A share card is flat,
 * fixed at 1200x630, and is usually first seen at thumbnail size — where a
 * hairline is the first thing to disappear. The filled team colour survives
 * scaling and carries the livery, which is the card's whole job.
 */
/**
 * The numeral, filled. See the note above for why it is not hollow.
 */
function SolidNumeral({ value, colour, size }: { value: string; colour: string; size: number }) {
  return (
    <div
      style={{
        display: 'flex',
        fontSize: size,
        fontWeight: 900,
        lineHeight: 1,
        letterSpacing: -size * 0.02,
        color: colour,
      }}
    >
      {value}
    </div>
  )
}

function Frame({ children, wash }: { children: React.ReactNode; wash?: string }) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: BG,
        padding: 64,
        position: 'relative',
        fontFamily: 'Geist',
      }}
    >
      {wash && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            // Satori needs explicit dimensions here: an inset-0 box with no
            // children collapsed to nothing, which is why the mockup's
            // livery wash was missing rather than merely subtle.
            width: OG_SIZE.width,
            height: OG_SIZE.height,
            display: 'flex',
            backgroundImage: `linear-gradient(105deg, ${wash} 0%, ${BG} 64%)`,
          }}
        />
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          position: 'relative',
          fontFamily: 'GeistMono',
          fontSize: 21,
          letterSpacing: 6,
          color: DIM,
        }}
      >
        <div style={{ display: 'flex' }}>LIGHTS OUT</div>
        <div style={{ display: 'flex' }}>2026</div>
      </div>
      {children}
    </div>
  )
}

export function DriverCard(d: {
  number: number
  first: string
  surname: string
  team: string
  colour: string
  /**
   * The ONLY part that needs the season compute. Omitted when the bundle is
   * unavailable, which drops one line rather than collapsing the card: the
   * numeral, the name and the livery all come from the committed roster, so
   * the card is still unmistakably this site and still worth sharing.
   * This matters because social platforms cache an OG image on first fetch
   * and never re-read it — a wordmark baked during one bad build would sit
   * in their caches long after the route healed.
   */
  standing?: { position: number; points: number }
}) {
  const colour = d.colour.startsWith('#') ? d.colour : `#${d.colour}`
  const Numeral = SolidNumeral
  return (
    <Frame wash={liveryWash(colour, 0.22)}>
      <div style={{ position: 'absolute', right: 54, top: 84, display: 'flex' }}>
        <Numeral value={String(d.number)} colour={colour} size={330} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', fontFamily: 'GeistMono', fontSize: 21, letterSpacing: 6, color: DIM }}>
          {d.first.toUpperCase()}
        </div>
        <div style={{ display: 'flex', fontSize: 126, fontWeight: 900, color: TEXT, lineHeight: 1, marginTop: 8, letterSpacing: -2 }}>
          {d.surname.toUpperCase()}
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 18,
            marginTop: 26,
            fontFamily: 'GeistMono',
            fontSize: 23,
            letterSpacing: 4,
            color: DIM,
          }}
        >
          <div style={{ display: 'flex', width: 26, height: 3, background: colour }} />
          <div style={{ display: 'flex' }}>{d.team.toUpperCase()}</div>
          {d.standing && (
            <div style={{ display: 'flex', color: TEXT }}>
              P{d.standing.position} · {Math.floor(d.standing.points)} PTS
            </div>
          )}
        </div>
      </div>
    </Frame>
  )
}

export function TeamCard(t: {
  name: string
  colour: string
  /** Compute-derived; omitted when unavailable. See DriverCard.standing. */
  standing?: { position: number; points: number; drivers: string[] }
}) {
  const colour = t.colour.startsWith('#') ? t.colour : `#${t.colour}`
  // Unlike a driver's car number, a constructor's numeral IS the standing —
  // there is no static equivalent to fall back to. So when the standing is
  // gone the numeral goes with it, and the name centres rather than sitting
  // at the foot of an empty card. A hole where a numeral belongs reads as a
  // broken render; a centred wordplate reads as a deliberate one.
  return (
    <Frame wash={liveryWash(colour, 0.22)}>
      {t.standing && (
        <div style={{ position: 'absolute', right: 54, top: 96, display: 'flex' }}>
          <SolidNumeral value={`P${t.standing.position}`} colour={colour} size={300} />
        </div>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          marginTop: 'auto',
          marginBottom: t.standing ? 0 : 'auto',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'GeistMono', fontSize: 21, letterSpacing: 6, color: DIM }}>
          <div style={{ display: 'flex', width: 30, height: 3, background: colour }} />
          <div style={{ display: 'flex' }}>CONSTRUCTOR</div>
        </div>
        <div style={{ display: 'flex', fontSize: 112, fontWeight: 900, color: TEXT, lineHeight: 1, marginTop: 10, letterSpacing: -2 }}>
          {t.name.toUpperCase()}
        </div>
        {t.standing && (
          <div style={{ display: 'flex', gap: 20, marginTop: 26, fontFamily: 'GeistMono', fontSize: 23, letterSpacing: 4, color: DIM }}>
            <div style={{ display: 'flex' }}>
              {t.standing.drivers.map((d) => d.toUpperCase()).join(' · ')}
            </div>
            <div style={{ display: 'flex', color: TEXT }}>{Math.floor(t.standing.points)} PTS</div>
          </div>
        )}
      </div>
    </Frame>
  )
}

export function RaceCard(r: { round: number; name: string; circuit: string; dates: string }) {
  const pad = String(r.round).padStart(2, '0')
  return (
    <Frame>
      <div style={{ position: 'absolute', right: 54, top: 70, display: 'flex' }}>
        <SolidNumeral value={pad} colour="rgba(245,245,243,0.10)" size={360} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', marginTop: 'auto', position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontFamily: 'GeistMono', fontSize: 21, letterSpacing: 6, color: '#e10600' }}>
          <div style={{ display: 'flex', width: 32, height: 3, background: '#e10600' }} />
          <div style={{ display: 'flex' }}>ROUND {pad}</div>
        </div>
        <div style={{ display: 'flex', fontSize: 112, fontWeight: 900, color: TEXT, lineHeight: 1, marginTop: 10, letterSpacing: -2 }}>
          {r.circuit.toUpperCase()}
        </div>
        <div style={{ display: 'flex', gap: 20, marginTop: 26, fontFamily: 'GeistMono', fontSize: 23, letterSpacing: 4, color: DIM }}>
          <div style={{ display: 'flex' }}>{r.name.toUpperCase()}</div>
          <div style={{ display: 'flex' }}>·</div>
          <div style={{ display: 'flex' }}>{r.dates}</div>
        </div>
      </div>
    </Frame>
  )
}

/**
 * The last resort, and it should be near-unreachable: it means even the
 * committed roster had no row for this slug.
 */
export function Wordmark() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BG,
        color: TEXT,
        fontFamily: 'Geist',
        fontSize: 84,
        fontWeight: 900,
        letterSpacing: -2,
      }}
    >
      LIGHTS OUT
    </div>
  )
}
