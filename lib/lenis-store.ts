import type Lenis from 'lenis'

// The live Lenis instance, registered by LenisProvider. Consumers that
// need to arrest scroll momentum (the season index snaps arrival inertia
// to its pin start) read it here; null when smoothing is off
// (reduced motion) or before mount.
let instance: Lenis | null = null

export const setLenis = (l: Lenis | null) => {
  instance = l
}

export const getLenis = (): Lenis | null => instance
