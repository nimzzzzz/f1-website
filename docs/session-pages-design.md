# Tyre Stints, Weather and Race Control

Three distinct session experiences within the existing Lights Out brand. The site menu, session picker, routes, server metadata, original-resolution portraits and shared data/freshness handling remain. Earlier Pit Stops work is preserved. A small existing root-layout issue found during browser checks was also fixed: the intro fallback style and script now sit inside a valid document head rather than directly under the html element. Their behaviour is unchanged. No new dependencies or global navigation were added.

The design-taste skill informs composition and motion; accessible data-interface conventions govern charts, tables and controls. Design dials (variance / motion / density): Stints 8 / 6 / 7, Weather 7 / 5 / 6, Race Control 8 / 5 / 7. Existing Bebas and Geist fonts, restrained team/compound/signal colours, sharp rules and dark surfaces hold the pages together without repeating one layout.

## Audit and direction

- **Tyre Stints:** the old chart concatenated runs and enforced a minimum width, hiding gaps and stretching short stints. The new strategy wall places inclusive ranges on a true lap scale. A compound-distribution wheel, explicit lap playback and driver inspector make the changes across the field explorable. The wheel's grey remainder represents missing coverage. Driver order is not race position.
- **Weather:** the old display emphasised the final sample and a shortened history. The new trackside instruments link track/air temperatures, wind bearing and speed, humidity, pressure and rain to every recorded observation. A temperature trace uses actual timestamps, with keyboard scrubbing, optional replay and a complete paginated log.
- **Race Control:** the old page was mainly a long filtered message list. The new broadcast panel highlights one original call, alongside its actual time, lap and scope. A category timeline, message scrubber, previous/next controls, searchable feed and pagination retain the full record. Clicking a timeline category selects within that row, using the same full-session time scale.

## Source fidelity

Reviewed the official OpenF1 [stints](https://openf1.org/docs/#stints), [weather](https://openf1.org/docs/#weather) and [race-control](https://openf1.org/docs/#race-control) references on 2026-10-02. Each page links its source.

- All records and driver joins are constrained to the displayed session. Deduplication preserves complete observations when another copy is partial. Missing values remain unavailable; zero temperature, zero wind and a fresh tyre age of zero are valid values.
- Stint length includes both start and end laps. Tyre age at the selected lap's start is recorded initial age plus completed laps in that stint. Gaps, overlapping ranges and open-ended stints do not establish the current tyre. Open ranges remain in the driver's stint selector. Compound names do not identify an event's C-number or quantify wear.
- Weather rainfall is yes/no/unknown, not a probability or measurement of intensity. It does not establish whether the surface is dry. Temperatures are °C, wind is m/s, humidity is %, pressure is mbar. Wind bearing preserves the feed's reported direction. Charts break across missing temperatures and gaps over three minutes; all logged readings remain accessible. Observations are not forecasts.
- Race-control text is preserved verbatim. Local sector/driver calls remain distinct from track/session calls. Sector numbers may refer to smaller track segments, not only the three timing sectors. The featured call is explicitly historical, not a reconstructed current flag state. Deployment counts exclude safety-car ending calls and negations. Decisions includes investigations as well as penalties and does not equate them. Untimed messages remain searchable and selectable but are not placed on the time axis.
- All displayed times are labelled UTC. `?session=` links initialise valid sessions and update when selecting another session. Loading, empty, unavailable, retry and retained-session states use the existing data system.

## Interaction and motion

Playback is explicit and advances through discrete laps/readings, without per-frame React updates. It stops at the end, on selection, when the tab is hidden and when reduced motion is requested. Intervals and preference listeners clean up. Reduced motion also suppresses decorative entrances and transitions.

Charts have native keyboard-operable slider equivalents and readable selected values. Native driver selectors use ordinary text sizes. Inspect and pagination actions move focus and scroll using the existing Lenis instance. Wide strategy charts, weather tables and the race-control timeline scroll within their own containers on phones; the page itself remains constrained to the viewport. Weather uses different line patterns as well as colours; stints and flags retain text labels.

## Validation

All 240 tests across 21 files pass. Fourteen new tests cover inclusive stint boundaries, starting tyre age, duplicates, gaps, overlaps, session isolation, unknown compounds, missing versus zero weather values, rainfall flags, invalid bearings, actual-time paths, exact-message deduplication, local versus track scope, deployment counting and category-specific timeline selection. TypeScript passes during production compilation.

Desktop production audits of all three initial implementations scored 99 performance / 100 accessibility, with no failed accessibility audits, including unweighted checks. Browser checks verified driver/stint selection, keyboard scrubbing, replay completion, driver filtering, weather log pagination and inspection, safety-car filtering, original-message inspection, driver-text search, message pagination, and first-message keyboard selection. Phone checks include 390px and 320px layouts with no page-level horizontal overflow. Final 320px production audits scored 87 / 100 for Stints, 89 / 100 for Weather, and 89 / 100 for Race Control (performance / accessibility). All accessibility audits pass, including unweighted checks. CLS was 0, 0 and 0.021 respectively. Simulated mobile LCP was 4.1s, 3.7s and 3.8s; the unchanged shared shell remains part of those measurements. Final pointer testing also confirmed a click in the Safety Car timeline row selects the correct safety-car call.

The final targeted production build of all three redesigned pages and their session-data proxy passes. Full-site rebuilds were attempted twice but timed out fetching external race data for existing driver/team pages and share images; those unrelated routes were not changed to hide the failure. Initial review ran locally on port 3100. Production deployment uses the repository’s GitHub-to-Vercel integration, with a full build performed on Vercel.
