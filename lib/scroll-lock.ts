/** Overlays may overlap or close out of order. Only the final owner unlocks. */
export function createScrollLock(read: () => string, write: (value: string) => void) {
  const owners = new Set<symbol>()
  let original = ''
  return () => {
    const owner = Symbol('scroll-lock')
    if (!owners.size) { original = read(); write('hidden') }
    owners.add(owner)
    return () => {
      if (!owners.delete(owner)) return
      if (!owners.size) write(original)
    }
  }
}

declare global { interface Window { __lightsOutScrollLock?: ReturnType<typeof createScrollLock> } }

export function lockPageScroll(): () => void {
  if (typeof window === 'undefined') return () => {}
  // Window keeps ownership consistent even if consumers land in separate bundles.
  window.__lightsOutScrollLock ??= createScrollLock(
    () => document.body.style.overflow,
    value => { document.body.style.overflow = value },
  )
  return window.__lightsOutScrollLock()
}
