// When may the intro play?
//
// Rule: on a genuine NEW DOCUMENT at "/" — fresh load, reload, new tab, direct
// link — and never on an App Router client navigation back to "/" mid-session.
//
// The distinction is drawn from module scope rather than storage: this module
// is evaluated exactly once per document, so ENTRY_PATH records where the
// document itself was opened. A client-side route change never re-evaluates
// it, while a reload always does — which is why a reload still plays the intro
// (a sessionStorage flag would suppress it).
const ENTRY_PATH = typeof window === 'undefined' ? null : window.location.pathname

// Set once the intro has been handed a document. Guards the case of loading
// "/" (intro plays), navigating away, then coming back to "/" — same document,
// so it must not play a second time.
let consumed = false

// Safe to call during render: no side effects, same answer until consume().
export function introMayPlay(): boolean {
  // Server render only happens for a real document request, and the intro
  // SSRs its <video> so the webm starts downloading with the HTML. Returning
  // true here keeps the first client render identical (no hydration mismatch)
  // — the client's own ENTRY_PATH check then agrees on a fresh "/" load.
  if (typeof window === 'undefined') return true
  if (consumed) return false
  return ENTRY_PATH === '/'
}

export function consumeIntro(): void {
  consumed = true
}
