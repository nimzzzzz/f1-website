'use client'

import Image from 'next/image'

// All official imagery renders through this — never raw. Fixed-aspect box
// with a dim surface placeholder (zero CLS, no broken images), the site's
// dark treatment baked in, and a bottom fade into the background.
//
// mono     — default: grayscale, sits as atmosphere behind type
// team     — keeps colour at reduced saturation where team colour IS the data
// line     — circuit carbon icons inverted to thin dim line art on black
// backdrop — full-bleed photography sunk deep into the black: near-mono,
//            heavily darkened so display type stays fully legible on top

export type Treatment = 'mono' | 'team' | 'line' | 'backdrop'

const FILTERS: Record<Treatment, string> = {
  mono: 'grayscale(0.85) contrast(1.05) brightness(0.9)',
  team: 'saturate(0.75) contrast(1.03) brightness(0.92)',
  line: 'invert(1) brightness(1.65) opacity(0.75)',
  backdrop: 'grayscale(0.85) contrast(1.1) brightness(0.38)',
}

/**
 * Encode quality, set by how hard the treatment grades the image.
 *
 * A backdrop is pushed to 38% brightness and 85% grey before anyone sees
 * it, then has a gradient laid over it. Detail that survives that is not
 * detail a viewer can resolve, so paying q75 for it buys nothing — the
 * circuit photos are the heaviest images on the site and /schedule draws
 * one per round. The line art is a flat two-tone invert, which compresses
 * to almost nothing at any setting.
 *
 * The undergraded treatments keep Next's default: mono and team are the
 * driver and car renders, shown near full brightness, where banding in a
 * livery gradient WOULD be visible.
 */
const QUALITY: Record<Treatment, number | undefined> = {
  mono: undefined,
  team: undefined,
  line: 60,
  backdrop: 45,
}

export default function TreatedImage({
  src,
  alt = '',
  treatment = 'mono',
  aspect,
  fade = true,
  fit = 'contain',
  position = 'bottom',
  sizes = '50vw',
  priority = false,
  eager = false,
  className = '',
}: {
  src: string | null
  alt?: string
  treatment?: Treatment
  /** CSS aspect-ratio for the box, e.g. '3/4'. Omit when the parent sizes the box. */
  aspect?: string
  fade?: boolean
  fit?: 'contain' | 'cover'
  position?: string
  sizes?: string
  /** Above-the-fold LCP candidate: eager + high fetch priority + SSR preload. */
  priority?: boolean
  /** Fetch immediately (not lazy) at normal priority — for below-fold images
   *  we want warmed during free loading time (e.g. behind the intro), without
   *  stealing priority from the real LCP. */
  eager?: boolean
  className?: string
}) {
  // The fill Image needs a positioned box. Callers often position the box
  // themselves (absolute overlays); an inline relative would override their
  // class, and a `relative` class would conflict — so self-position only
  // when the caller didn't.
  const positioned = /(^|\s)(absolute|fixed|sticky)(\s|$)/.test(className)
  return (
    <div
      className={`overflow-hidden ${src ? '' : 'bg-[var(--surface)]'} ${className}`}
      style={{
        ...(aspect ? { aspectRatio: aspect } : {}),
        ...(positioned ? {} : { position: 'relative' as const }),
      }}
    >
      {src && (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            quality={QUALITY[treatment]}
            priority={priority}
            loading={priority ? undefined : eager ? 'eager' : undefined}
            unoptimized={src.endsWith('.svg')}
            className={fit === 'cover' ? 'object-cover' : 'object-contain'}
            style={{ filter: FILTERS[treatment], objectPosition: position }}
          />
          {fade && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: 'linear-gradient(to top, var(--bg) 2%, transparent 42%)' }}
            />
          )}
        </>
      )}
    </div>
  )
}
