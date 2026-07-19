'use client'

import { circuitPhoto } from '@/lib/circuit-photos-manifest'
import { circuitImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'

// The circuit-photo backdrop system, shared by the NOW section and the
// schedule rounds: the circuit's official hero photo sunk deep into the
// black — or, when no photo exists (Madring, any future circuit), the
// carbon line-art icon rendered huge and very faint. Both variants live
// inside the SAME frame: identical fade overlays, identical grade
// philosophy, so they read as one design element everywhere.
//
// Absolute layer behind the caller's content — zero layout participation,
// zero CLS. Missing photo AND icon → renders nothing (plain layout stands).
//
// presence — wrapper opacity: callers dim past/cancelled rounds below
//            upcoming ones so the timeline's progression reads in the
//            backdrops too (1 = the NOW-section look).
// lift     — hero emphasis: raises the deep grade's brightness so the
//            next race reads clearly more present than every other round.
export default function CircuitBackdrop({
  circuitShortName,
  countryName,
  eager = false,
  presence = 1,
  lift = false,
  forceIcon = false,
}: {
  circuitShortName: string
  countryName: string
  eager?: boolean
  presence?: number
  lift?: boolean
  forceIcon?: boolean
}) {
  const photo = forceIcon ? null : circuitPhoto(circuitShortName)
  const icon = circuitImage(countryName)
  if (!photo && !icon) return null

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
      style={{
        opacity: presence,
        ...(lift ? { filter: 'brightness(1.45)' } : {}),
      }}
    >
      {photo ? (
        // ── photo variant: full-bleed, deep dark grade ──
        <TreatedImage
          src={photo}
          treatment="backdrop"
          fit="cover"
          position="center 38%"
          fade={false}
          eager={eager}
          sizes="100vw"
          className="absolute inset-0"
        />
      ) : (
        // ── line-art variant: the carbon icon, huge and barely-there ──
        <div className="absolute right-[-8vw] top-1/2 h-[70vh] max-h-full w-[72vw] -translate-y-1/2">
          <TreatedImage
            src={icon}
            treatment="line"
            fit="contain"
            position="center"
            fade={false}
            eager={eager}
            sizes="72vw"
            className="absolute inset-0 opacity-[0.07]"
          />
        </div>
      )}

      {/* shared fades — no hard boundary on any edge, heavier at the
          bottom so the frame dissolves into the page background */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to top, var(--bg) 4%, transparent 48%), linear-gradient(to bottom, var(--bg) 0%, transparent 22%), linear-gradient(to right, var(--bg) 0%, transparent 30%), linear-gradient(to left, var(--bg) 0%, transparent 25%)',
        }}
      />
    </div>
  )
}
