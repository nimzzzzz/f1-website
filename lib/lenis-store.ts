import type Lenis from 'lenis'

// The live Lenis instance, registered by LenisProvider. Consumers that
// need to arrest scroll momentum (the season index parks arrival inertia
// at its pin start) read it here; null when smoothing is off
// (reduced motion) or before mount.
//
// Stored on window, not in module state: bundler chunking can duplicate a
// tiny module into several chunks, giving the provider and the consumer
// DIFFERENT copies of a module-level variable — observed live as
// getLenis() returning null while Lenis ran. window is one per page.

declare global {
  interface Window {
    __lenis?: Lenis | null
  }
}

export const setLenis = (l: Lenis | null) => {
  if (typeof window !== 'undefined') window.__lenis = l
}

export const getLenis = (): Lenis | null =>
  typeof window !== 'undefined' ? window.__lenis ?? null : null
