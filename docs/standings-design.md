# Standings design trial

A championship timing tower for F1 fans. Preserve the existing black/red brand, oversized outlined positions, Bebas surnames, mono points, and both complete standings. Design variance 6/10, motion 6/10, density 5/10. This is a data page, so the design skill's landing-page restrictions on tables, repeated rows, and team colours do not apply.

The schedule tells a chronological story with alternating race photographs and a vertical spine. Standings instead uses horizontal points traces, a fixed rank/name/points alignment, and individual driver or constructor reveals. The site's existing menu and other pages are unchanged by this trial.

## What changed

- The championship leader keeps the red position and has a visible portrait or car. Other rows reveal their image, team-colour wash, and profile invitation on hover or keyboard focus. The sweep responds once to engagement rather than looping.
- Thin rulers show each points total relative to the leader. They draw on arrival without obscuring or counting up the actual scores. Equal totals and zero points are represented accurately; the text preserves fractional points.
- Each gap explicitly names the position immediately above. Both championships have table, row, cell, and column-header semantics.
- Available driver/team names link to their existing profiles with a full-row hit area. An unknown profile stays as readable text instead of linking to a 404. Missing artwork leaves the data intact. Tsunoda's official 2026 Racing Bulls portrait is now included in both the curated source list and local manifest, enabling his existing profile route too.
- In-page jumps connect the two championships and transfer focus after scrolling.
- Phone rows give more width to surnames, wrap team details, and stack the points unit. The reading zone softly brings portraits into view on touch devices. Reduced motion disables automatic animation and scroll smoothing; the standings also remain visible before hydration or without JavaScript.

## Implementation

Scoped to `app/standings`. Native CSS and two IntersectionObservers; no added dependencies, continuous scroll handlers, or new data requests. Server-rendered season snapshots, background refresh, outage handling, metadata, and route URLs are retained. Images use the existing local media manifest through Next Image, with responsive sizes and lazy loading below the leader.

Typography/image interaction reference: [Codrops ImageExpansionTypography](https://github.com/codrops/ImageExpansionTypography). The timing tower implementation is original; no demo code or assets were copied. Observer lifecycle checked against [MDN](https://developer.mozilla.org/en-US/docs/Web/API/Intersection_Observer_API).

## Verification

163 existing tests pass. Production build and TypeScript validation pass. Browser review covers desktop and phone presentation, the constructors jump and focus transfer, row focus, and a team profile destination. The server response contains all 34 rows, both tables, and six column headers without a loading skeleton. Adding Tsunoda's portrait brings the available profile links to 34.

Final Lighthouse at a narrow 320px phone width: performance 93, accessibility 100, FCP 1.1 seconds, LCP 3.2 seconds, TBT 10 ms, CLS 0. The standard mobile run scored 91/100 for performance and 100/100 for accessibility. These are local simulated results, not field measurements; LCP remains above the 2.5-second target. Reduced-motion behavior was reviewed in code, not separately emulated in the browser.
