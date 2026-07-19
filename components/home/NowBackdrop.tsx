'use client'

import { circuitPhoto } from '@/lib/circuit-photos-manifest'
import { circuitImage } from '@/lib/media-manifest'
import TreatedImage from '@/components/media/TreatedImage'

// The NOW section's atmospheric backdrop: the circuit's official hero
// photo sunk deep into the black — or, when no photo exists (Madring,
// any future circuit), the carbon line-art icon rendered huge and very
// faint. Both variants live inside the SAME frame: identical fade
// overlays, identical grade philosophy, so they read as one design
// element rather than "photo circuits" vs "fallback circuits".
//
// Absolute layer behind the section content — zero layout participation,
// zero CLS. Missing photo AND icon → renders nothing (plain NOW stands).
export default function NowBackdrop({
  circuitShortName,
  countryName,
}: {
  circuitShortName: string
  countryName: string
}) {
  // QA override: /?backdrop=icon forces the line-art variant
  const forceIcon =
    typeof window !== 'undefined' &&
    new URLSearchParams(window.location.search).get('backdrop') === 'icon'
  const photo = forceIcon ? null : circuitPhoto(circuitShortName)
  const icon = circuitImage(countryName)
  if (!photo && !icon) return null

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {photo ? (
        // ── photo variant: full-bleed, deep dark grade ──
        <TreatedImage
          src={photo}
          treatment="backdrop"
          fit="cover"
          position="center 38%"
          fade={false}
          eager
          sizes="100vw"
          className="absolute inset-0"
        />
      ) : (
        // ── line-art variant: the carbon icon, huge and barely-there ──
        <div className="absolute right-[-8vw] top-1/2 h-[70vh] w-[72vw] -translate-y-1/2">
          <TreatedImage
            src={icon}
            treatment="line"
            fit="contain"
            position="center"
            fade={false}
            eager
            sizes="72vw"
            className="absolute inset-0 opacity-[0.07]"
          />
        </div>
      )}

      {/* shared fades — no hard boundary on any edge, heavier at the
          bottom so the section dissolves into the page background */}
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
