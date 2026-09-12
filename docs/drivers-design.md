# Drivers design

The horizontal gallery keeps its large race numbers, standing portraits, car entrances and light sweeps. The season-record block was removed at the user’s request; points sit beside the team name. Recent form shows up to five actual GP entries, with no artificial zero results for absent rounds.

The existing rail supports portrait previews, direct selection, arrow/Home/End keyboard control and Escape dismissal. Explicit return links restore the driver by acronym rather than championship index. Stacked cards include a scroll margin so the fixed header clears the card on return.

The profile combines a close portrait, visible season totals, the restored winding season line, an opposing-portrait comparison and a photographic season highlight. The line’s glowing trace and moving marker follow the reading position. Race labels stay readable before arrival, and assistive text always contains exact points while the decorative count-up runs. Grand Prix and sprint points stay separate.

The line uses actual field sizes and classified positions, including P21/P22. Unclassified outcomes leave a visible gap, including first/last-round retirements and one-entry seasons. A vertical SVG clip reveals disconnected segments without drawing later subpaths prematurely. Resize and live snapshot updates rebuild the geometry. Reduced-motion preference changes switch to a complete static line. No-entry, upcoming and cancelled rounds retain compact calendar rows. Circuit art is resolved by meeting, never country fallback.

Each entered round with a paired result can open its teammate comparison. The season-highlight button returns to the exact race and moves keyboard focus there. The highlight is the earliest occurrence of the best classified finish; none is invented for drivers without one.

The comparison pairs the highest-scoring other driver listed in the current team. Its points use only GP rounds both entered; its head-to-head score uses rounds both classified. Historical team identity is not retained per result, so the page notes that prior team changes may be included. Career data remains an expandable archive, separate from current-season totals.

## Motion and assets

- [Vercel React View Transitions skill](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-view-transitions): unique shared portrait/number names and forward/backward navigation. Next 16.3 supports this without a new runtime dependency.
- [Codrops ImageToContent](https://github.com/codrops/ImageToContent): shared-portrait visual inspiration; no demo source copied.
- [GSAP ScrollTrigger](https://gsap.com/docs/v3/Plugins/ScrollTrigger/): existing gallery scrub and restored season trace.


Unsupported View Transition browsers navigate normally. Uncached destinations may show the existing fallback before a shared pair becomes available. Live snapshot refreshes do not trigger page transitions. Reduced motion disables page transitions while preserving data and controls.

## Verification

- 174 unit tests: season/duel data, fractional and sprint points, reserve entries, P22, outcome gaps, empty seasons, curve-to-reading-position mapping.
- TypeScript and production build pass.
- Gallery rendered at 1050 × 650, mobile 320px and reduced motion. All three accessibility checks scored 100 with no failed audits. The flags and season-record block have been removed.
- Restored line rendered at a long mobile circuit name and consecutive Leclerc retirements; both accessibility checks scored 100. Screenshots show the trace stopping at the reading line and retaining its gaps.
- Reports and screenshots: `/tmp/lights-out-line-spa-mobile.*`, `/tmp/lights-out-line-out-desktop.*`.
