# Results design

Design read: an F1 results redesign for race fans, with the drama of a post-race broadcast and the clarity of a timing sheet. Native CSS, the existing Bebas/Geist typography, and the existing GSAP setup. Design variance 8, motion 7, density 6; data display remains a semantic table.

## Composition

- A circuit-photo podium with actual driver portraits, a dominant winner, stepped P2/P3 and a brief chequered-line/portrait reveal.
- Qualifying celebrates pole, displays the pole sitter's three stages and all drivers' Q1/Q2/Q3 times with stage-relative gaps. Sprint qualifying uses SQ labels. Practice has a single-driver composition with best lap and laps completed.
- Race highlights use measured gains, consecutive classified finishing gaps and team points from this session.
- The grid comparison joins actual starting-grid positions to published classified finishes. Selecting a driver highlights their path and gain. The drawing can replay. This is a start/end comparison, not an invented lap-by-lap trajectory.
- The official grid is keyed to qualifying, not the race: Zandvoort race 11353 uses grid 11349; Monza race 11361 uses grid 11357. Sprint races use their own Sprint Qualifying / Shootout grid. If that publication is absent, the visual becomes an actual recorded position trace.
- Race table rows expand to show a driver’s position history and recorded pit-stop laps. Small portraits link the names to the podium; names also lead to driver pages.
- Existing route and session controls remain. Optional `?session=<key>` opens a specific valid session; the selector updates it for copyable URLs. Existing URLs retain their behavior. Metadata stays noindex as before.

## Data correctness

Source semantics: https://openf1.org/docs/#session-result and https://openf1.org/docs/#starting-grid. Grid/session mapping verified against https://github.com/br-g/openf1/blob/main/src/openf1/services/f1_scraping/starting_grid.py and real 2026 payloads.

- Prefer published session results, including unclassified and DSQ rows, over the last live position sample. Position data remains the fallback before publication or during an outage.
- A missing roster entry no longer drops a classified driver: the number remains until the name is available.
- Preserve qualifying null stages and lapped strings at the normalization boundary. Previously Q1 gaps became `+0.056 LAP`, and null stages became zeros. Madrid qualifying now shows Norris 1:31.824 and Antonelli +0.011s (Q3).
- Preserve unknown points as distinct from confirmed zero via `points_available`. Do not invent points for unpublished or shortened races.
- Fetch grid/history/stops only for races, after classification. Unavailable pit data is null, not zero stops. Optional enrichment cannot blank the classification.
- Keep the existing latest-wins, live polling and retained-data behavior. Retained rows keep their original session type and circuit, with an explicit label while a different session is loading.
- Exclude pit-lane starts, missing grids, DNS, DSQ and DNF from numeric gains. Do not subtract lapped strings to claim a close finish.

## Interaction and responsive behavior

- No new dependency, top-level navigation or global layout change.
- Native select and buttons provide keyboard equivalents for chart pointer interaction. Expansion uses aria-expanded/aria-controls; classification uses table headers and caption.
- Reduced-motion disables all reveal/drawing/transition effects. Session changes remount the experience; polling retains it and does not replay entrance animations.
- On phones the winner occupies one row with P2/P3 paired beneath. Qualifying timing columns scroll horizontally while driver identity stays visible. Race lap/stop columns move into the expanded row; a compact points/gap view remains.

## Validation

Type checking, production build, normalization/classification/history regression tests, and the full existing suite. Desktop/mobile Lighthouse checks and rendered screenshots. Exact measurements and the final manual interaction checks are recorded with task delivery.

Final checks (2026-09-13): TypeScript clean; production build completed; all 200 tests across 17 files passed. Final production Lighthouse: Zandvoort race at 1200px scored 98 performance / 100 accessibility (LCP 1.14s, CLS 0.0081); Zandvoort sprint at 320px scored 82 / 100 (CLS 0). No Lighthouse run warnings. Qualifying at desktop/mobile, Monza race at 390px, and the separate practice composition were also visually reviewed and scored 100 accessibility.

Manual browser checks: round/session switching, keyboard selection of a driver, replay activation, opening Norris’s race detail (72 laps; stops on laps 2, 21 and 47), and keyboard collapse all passed. The final production preview is served on port 3100. Team-detail work from the preceding task remains intact and uncommitted; no deployment was performed in this task.
