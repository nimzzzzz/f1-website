# Lap Times design

Design read: an F1 timing redesign for curious race fans, with a precise broadcast language. The signature interaction is a condensed sector replay. Native CSS/SVG, existing GSAP and Bebas/Geist typography; no new dependency. DESIGN_VARIANCE 7, MOTION_INTENSITY 6, VISUAL_DENSITY 7. The design-taste skill applies to composition and motion; the timing tables and native form controls follow accessible data-interface conventions.

## Audit and preservation

The previous page used a giant fastest-lap time, five fastest laps (potentially repeating drivers), unlabelled sector columns, and a nested list capped at 200 rows. Mobile hid all sector information and wrapped 22 driver filters. The existing menu, session controls, route `/laps`, noindex metadata, brand fonts, colours, and shared fetching/freshness system remain. Prior accepted Results and Team Detail work is preserved.

## Composition and interaction

- Chasing Thousandths: a compact session-best stamp and two driver/lap selectors with local portraits and team colours. A and B are consistently identified, including a dashed second series for drivers on the same team.
- Sector Duel: three sequential sector-duration animations, each showing the sector gain and cumulative lead. The finish readout uses the actual lap totals. Playback is explicitly condensed, not GPS telemetry or a real-time race replay. Replay works by button and native keyboard activation. Driver/lap changes reset the sequence.
- Pace, Lap by Lap: actual timed laps on a responsive graph. Clicking selects the nearest lap number; a labelled native range input provides keyboard and touch access to identical values. The readouts load laps into either side of the duel. Default focus shows laps within 115% of each driver's best, explicitly counts slower laps outside the view, and can be disabled. Paths break at missing/out/filtered laps. Recorded pit markers remain visible even when the pit lap is outside the focused timing range. Tyre stints use actual lap ranges, not inferred degradation.
- The Lap That Could Have Been: personal best S1/S2/S3, their source lap numbers, their sum and possible improvement over the actual best. Clearly theoretical, potentially combining separate conditions. A short assembly motion starts on entry and when the selected driver changes.
- One Lap, Every Driver: one best lap per driver, gap, available tyre context, and labelled sectors. Fastest sectors in this table are highlighted. Selecting a driver loads their best into Duel A. Mobile can scroll the table horizontally while retaining driver identity.
- Every Lap, in Detail: search by name/team/number, driver filter, lap/fastest/highest-lap sorting, optional out/untimed laps, 30-row pagination with every row reachable. Expansions expose sector times, speed-trap readings and tyre age on mobile too. Explicit actions take a lap to either side of the duel. Pagination moves focus to the log heading, not a disappearing button.

## Data semantics

Source: https://openf1.org/docs/#laps and https://openf1.org/docs/#stints (reviewed 2026-09-13). Madrid qualifying 11365 was checked against real lap and stint payloads.

- Reject zero, negative and non-finite lap/sector times; keep partial/out laps accessible in the log. Deduplicate driver/lap pairs, preserving a complete duplicate against a subsequent untimed row.
- Timed laps exclude pit out laps. Do not call the remainder clean: deleted laps, traffic, fuel, and caution effects are not fully described by the lap endpoint. The page explains this limit.
- Best-lap rows survive missing roster records as Driver plus number. No fabricated portrait, team or name.
- Missing sector times cannot become a zero or an invented cumulative gap. At the line, actual total lap durations are authoritative.
- Ideal lap requires sufficient positive sector data; suppress when missing sectors would falsely produce a theoretical time slower than the actual best.
- Stint joins require matching session, driver and inclusive lap range. Tyre age is described at lap start, including tyre age at stint start.
- Context loads after primary data, distinguishing unavailable tyre/pit feeds (null) from confirmed empty feeds ([]). Live polling bypasses context TTL caches. Partial context failure cannot hide lap timings.
- Existing latest-wins and retained-data handling is preserved. The entire experience is keyed to the displayed data's session; a new selection cannot relabel old lap data as the new session. Copied `?session=` URLs are supported and update with the existing picker.

## Motion and responsive checks

All animations clean up on selection/unmount. GSAP matchMedia and CSS reduced-motion handling present finished, readable states. No global scroll handler, perpetual decoration, additional menu, external image service, or new package. Existing dark theme and semantic racing colours are retained; generic marketing-skill restrictions do not override the user's approved timing graphics or existing design system.

## Validation

Pure timing tests cover invalid/partial records, duplicate completion, missing roster, one-best ranking, real Madrid split deltas (0.089 / 0.291 / 0.011s), missing cumulative sectors, ideal-lap integrity, millisecond rounding, session/driver/stint joins, pit markers, focus exclusions and graph gaps. Fetch-contract tests cover nullable enrichment, rejected requests and forced live refresh. TypeScript and the initial production build pass; all 215 tests in 19 files pass.

Browser review covered desktop and 390/320px layouts, the visible replay reset, driver selection, graph keyboard scrubbing (lap 11 to 12), loading a graph lap into Duel B, Tsunoda search (11 timed laps), sector expansion (29.352 / 33.940 / 32.240, speed trap 299 km/h), Space-key collapse, 312 total laps with out laps included, pagination through page 8/11, fastest-first sorting returning to page 1, and qualifying-to-practice switching. Practice correctly changed to Russell 1:34.077; retained qualifying data was explicitly labelled during loading.

Review found and fixed a leaderboard accessible-name mismatch, truncated phone selectors, pit markers lost outside the focused timing range, and a conflict between native scrollIntoView and Lenis. The final section-jump helper uses the existing Lenis instance, with native fallback and reduced-motion support. The native computer-use connection closed before a final manual check of that last scroll adjustment; its integration was typechecked and built. Rendering/accessibility checks continue through Lighthouse.

The first desktop production audit scored 99 performance / 100 accessibility, LCP 1.04s, CLS 0.0009. After the name-label fix, the 320px Zandvoort race audit scored 84 / 100, LCP 4.31s on simulated mobile throttling, CLS 0.0700, and no failed accessibility checks (including unweighted checks).

Final production verification: build completed and all 215 tests / 19 files passed after the last code changes. Madrid qualifying at 1200px: 99 performance / 100 accessibility, LCP 1.036s, CLS 0.0006, no run warnings and no failed accessibility checks. Zandvoort race at 320px on the final build: 100 accessibility, no warnings or failed accessibility checks. The production preview is running on port 3100. No deployment or commit was performed.

The narrow race graph was additionally rendered inside a tall 390px viewport to verify the actual plot, slider, inspection panels, and tyre strip; Chrome full-page captures omitted some off-screen painted layers. The in-viewport graph rendered correctly, with 100 accessibility.

## Picker and portrait correction — 2026-10-02

Replaced the headline-sized native driver select with a portalled, searchable picker capped at 300 × 350px. It shows driver number, surname, team, current selection and the driver already used in the other slot. Keyboard arrows/Enter, Escape, focus return, outside dismissal and native wheel/touch scrolling work with the existing Lenis body lock. The panel repositions within the visual viewport.

Scoped comparison-portrait media queries to the comparison cards: leaderboard portraits remain 38 × 48px on desktop and 28 × 44px on phones, including the previously broken >=1500px and <=360px breakpoints. Replaced all 23 local portraits with official 1336 × 3840 originals (formerly 720 × 2069); source URLs in DRIVER_PHOTOS now preserve original resolution on future media fetches. Lap Times serves these originals without further lossy optimization or thumbnail downsampling. Smaller leaderboard portraits remain lazy-loaded and reuse the same image as the duel.

Validation: 215 tests / 19 files pass; TypeScript and production build pass. Manual browser checks verified searching for Tsunoda, Enter selecting his 1:34.084 lap, arrow navigation, wheel scrolling, Escape/focus return, and the picker fitting a 320 × 780 viewport. Lighthouse accessibility checks at 1661px and 320px both scored 100 with no failed audits or warnings. Wide-screen screenshots confirm compact leaderboard rows and correct comparison portraits. These changes are part of the release containing the previously accepted Team Detail and Results redesigns.
