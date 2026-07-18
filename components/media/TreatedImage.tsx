'use client'

import Image from 'next/image'

// All official imagery renders through this — never raw. Fixed-aspect box
// with a dim surface placeholder (zero CLS, no broken images), the site's
// dark treatment baked in, and a bottom fade into the background.
//
// mono — default: grayscale, sits as atmosphere behind type
// team — keeps colour at reduced saturation where team colour IS the data
// line — circuit carbon icons inverted to thin dim line art on black

export type Treatment = 'mono' | 'team' | 'line'

const FILTERS: Record<Treatment, string> = {
  mono: 'grayscale(0.85) contrast(1.05) brightness(0.9)',
  team: 'saturate(0.75) contrast(1.03) brightness(0.92)',
  line: 'invert(1) brightness(1.65) opacity(0.75)',
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
  priority?: boolean
  className?: string
}) {
  return (
    <div
      className={`relative overflow-hidden ${src ? '' : 'bg-[var(--surface)]'} ${className}`}
      style={aspect ? { aspectRatio: aspect } : undefined}
    >
      {src && (
        <>
          <Image
            src={src}
            alt={alt}
            fill
            sizes={sizes}
            priority={priority}
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
