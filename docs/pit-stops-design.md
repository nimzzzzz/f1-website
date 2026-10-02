# Pit Stops design

Design read: an F1 pit-lane experience for fans exploring when teams called their drivers in and how long each visit took. The signature is a replayable pit bay with a real team car, floor markings and a large timing board. Native CSS and the existing GSAP, Bebas and Geist stack; no new dependency. DESIGN_VARIANCE 8, MOTION_INTENSITY 7, VISUAL_DENSITY 7. The design-taste skill informs composition and motion; accessible data-interface conventions govern tables and native controls.

## Audit and preservation

The old page featured one giant fastest-stop number, a session average and a plain visit list. It called OpenF1's pit_duration a stop time, although that field includes the whole pit-lane visit. The existing menu, session picker, `/pit-stops` route, noindex metadata, brand and shared fetching/freshness system remain. Previously approved pages are unchanged.

## Composition and interactions

- **Box. Box.** A team car enters and exits an illustrated pit bay while the clock counts to the recorded duration. Select a quick visit or inspect any row to load its car, driver, lap, visit number and available tyre change. Replay is explicitly condensed and illustrative, not tracked car movement.
- **Two timing measurements.** Stationary service and total pit-lane time are separate. Comparison defaults to stationary when published, otherwise lane time. Missing stationary data disables that comparison and explains what the clock shows. Every visit remains available in the log, including visits without a selected measurement.
- **Quickest visits.** Five compact quick picks, with team colour, driver, lap and recorded time. Horizontal scrolling on phones keeps them readable.
- **The call to box.** Stacked team-coloured bars group visits by lap window. Selecting a populated window filters the visit log. Empty windows retain their position. The axis ends at the last recorded visit; unknown laps are explicitly excluded from the chart.
- **Every visit. Every second.** Search by driver/team/number, order by race or selected timing, inspect a visit and paginate through every record. The table includes both timing measures and available tyre changes. A sticky driver column preserves identity when scrolling horizontally on phones.
- **The team picture.** Teams ordered by median selected timing, with best timing and timed/total coverage. Lane comparisons are explicitly described as complete visits, including traffic and extended holds; they are not labelled crew service speed.

## Data semantics

Source: https://openf1.org/docs/#pit (reviewed 2026-10-02).

- `lane_duration` is total pit-lane time. `pit_duration` is its deprecated alias. `stop_duration` is stationary time and may be null. Never substitute a lane duration for stationary time.
- Positive finite durations only. Reject stationary values exceeding known lane time. Missing values remain N/A. Durations over a minute use minutes:seconds, with correct centisecond rounding.
- Filter all records and roster joins to the displayed session. Normalize dates for duplicate detection, preserve completed timing fields against incomplete duplicate records, and preserve distinct visits on the same lap.
- Chronological per-driver visit numbers and totals are derived from the recorded visits. Missing roster entries use neutral driver numbers, with no invented team identity or team ranking.
- Tyre changes require exact adjacent stint boundaries for the same driver and session. A later unrelated stint cannot be attached to a drive-through.
- Extended lane holds remain visible and included in medians. There is no hidden cutoff or invented correction for unusual source values.
- Pit visits are primary data; drivers and stints are optional enrichment. Partial context failure cannot hide timing. Live polling, retained-session labels, retry states and `?session=` links use the existing shared system.

## Motion and responsive behaviour

Replay starts when the bay becomes visible and its car is loaded. The clock uses a DOM reference, avoiding a React render every animation frame. GSAP timelines clean up on selection, replay and unmount. Reduced-motion preference presents the recorded result, disables replay and suppresses CSS animation. Lane mode does not invent a stationary hold; stationary mode holds the car for a condensed service phase.

The bay and timing board sit side by side on desktop and stack on phones. Long timings have compact typography. Tables and lap windows scroll inside their own containers with the existing Lenis integration. Inspect and pagination actions move keyboard focus and scroll through the existing Lenis instance, with a native fallback.

Cars use the existing 3392px originals on larger screens and the existing 1280px variant at 420px and below, sufficient for the displayed car even at 3× density. Portraits retain their original resolution. The car request has high fetch priority.

## Validation

All 226 tests across 20 files pass, and the production build passes including TypeScript. Eleven new data tests cover separate timings, legacy alias fallback, invalid values, duplicate records, session/roster boundaries, visit numbering, rounding, rankings, medians including extended holds, lap windows and exact tyre changes.

Desktop browser checks verified the moving car and count-up replay, Williams/SAINZ selection, the seven visits in Monza's lap 26–30 window, clearing the window, Russell search and inspection of his 30:46.20 lane visit. Inspect correctly returns focus to the pit bay and changes to the Mercedes car and Russell portrait.

The initial 1661px production audit scored 96 performance / 100 accessibility. The final 320px audit scored 83 performance / 100 accessibility, with simulated mobile LCP 4.23s and CLS 0.0302. All accessibility audits, including unweighted checks, pass after replacing the lap-window label override with visible text plus screen-reader context. A second 320px tall-viewport audit confirmed the lower team summaries, including long times, render without overlap and also scored 100 accessibility with no failures or warnings. The final production build passes. Initial review ran locally on port 3100. Production deployment uses the repository’s GitHub-to-Vercel integration.
