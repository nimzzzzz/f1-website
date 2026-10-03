# LIGHTS OUT Fantasy: first playable build

## Delivered

`/fantasy`, linked from the existing site menu. No additional site navigation.

- Personal team name, five colour choices and an automatically derived monogram.
- Three unique drivers under a $60.0m budget, assigned Team leader, Charger and Teammate rival roles. Selecting a current squad member swaps roles.
- Searchable driver market, price/name sorting, affordability filtering and original-resolution local portraits.
- A complete local 24-round practice season against 15 labelled computer opponents.
- Season standings, shared ranks for tied totals, movement since the previous round, and latest-race standings.
- Six four-race, 16-team elimination cups. Fixed draw within a cup; standings seed the next cup. Elimination leaves season scoring intact and provides consolation matchups.
- Cup history, selectable bracket matches, explicit tie rules, trophies and individual race debriefs.
- Saved original lineups, recomputed scores, reload persistence, cross-tab updates, corrupt-save validation and storage failure notices.

This is **practice**, not an operational shared competition. The page states that races and opponents are simulated. No fabricated result is presented as an actual Grand Prix, and no browser score is sent to a public leaderboard. No sign-in form, fake invitation link or inactive join button is shipped. The route is noindex until the public game is ready.

## Rules in this build

Rules live in `lib/fantasy/rules.ts`; no scoring lives in UI components. Fantasy prices are fixed practice values in integer tenths of a million, not official F1 Fantasy prices. The practice roster is a sample based on the repository's roster snapshot; it is not represented as live eligibility.

Qualifying P1-P10: 10 through 1. Race P1-P10: 25, 18, 15, 12, 10, 8, 6, 4, 2, 1. Finish: +2. DNF: -5 with qualifying points retained. DNS: no race/finish points. DSQ: -10 replaces all awards. Sprint scoring is outside this first ruleset.

Leader: add qualifying and race-position points a second time. Charger: +2 per net position gained, capped at +20, only with a valid grid and classified finish. Rival: +5 for outqualifying the teammate, +8 for beating them in the race. Race bonus requires the selected driver to finish and the teammate either to finish behind or retire; DNS/DSQ opponents do not qualify. Missing or ambiguous teammates award no bonus.

Cup ties: total points, role bonus total, Leader total, higher pre-published cup seed. Season ties share rank. Cup trophies never add championship points. In cup one the fixed draw is the seed; later draws seed from standings at the beginning of the cup. No reseeding halfway through a cup.

`practice.ts` generates reproducible fictional results and computer lineups. A completed round stores its submitted lineup once. Future squad changes cannot change past scores. Browser storage is convenience persistence only and is deliberately editable; it is never a trusted competition store.

## Design

New game surface inside the existing dark LIGHTS OUT brand: Bebas display type, Geist body/mono, the existing garage image, high-resolution driver portraits. Sharp panel edges, driver photography and a personalised team accent. Badge shape is reserved for team identity. The design skill is applied to the garage's visual composition; its landing-page restrictions do not govern game tables or forms.

Design variance 8, motion 5, density 6. Entrance movement establishes the garage/driver hierarchy; portrait hover acknowledges selection; start lights and score entrances mark a round transition. CSS gates all animation behind `prefers-reduced-motion: no-preference`. Native dialogs provide modal semantics, Escape dismissal and focus restoration. The existing menu and all other pages remain intact.

Phone layout stacks portraits, wraps the team identity, and keeps wide tables/brackets in their own labelled horizontal scroll areas. Native dialog scroll regions carry `data-lenis-prevent`. Font subsets include newly rendered directional glyphs.

## Shared competition work still required

The repository has no player accounts or database. An asynchronous question about existing services was sent during the build. There is no configured backend to activate here.

The production connection must provide:

1. Verified player identity and a persistent team per season, with unique server-owned identifiers. Keep the separate predictions game's rules, entries and scores in separate tables.
2. A versioned driver market and actual eligible roster per round, preserving transfers and reserve appearances. Round prices must be frozen before players submit.
3. Server-clock lineup deadlines from verified session dates, with a defined postponement/cancellation policy. Lock qualifying-scoring picks before the first scored qualifying session. Never accept browser-supplied lock times or scores.
4. Transactional lineup submission: unique round entry, three distinct eligible drivers, one role each, budget and ownership checked on the server. Keep opponent lineups private until lock.
5. Final, trusted qualifying results, actual starting grids and race classifications. Show results as provisional until verified. Use idempotent, versioned scoring and re-score affected cup paths if classifications change.
6. Server-persisted cup draws and membership. Decide how to handle incomplete groups, byes, late entry and cancelled weekends before opening enrollment. Start fresh cups for new entrants; never fabricate human opponents to fill a bracket.
7. Shared global/private season standings and league invites with server-enforced membership. Add abuse protection to account and entry endpoints.

Do not turn the current practice mode into public play by merely uploading local totals or replacing computer display names. The practice adapter should remain available as a sandbox alongside the production adapter.

## Verification

- 16 new domain tests cover role math, invalid/missing inputs, role swaps, exact budgets, bad saves, historical lineup preservation, deterministic practice results, all tiebreaks, fixed draws, advancing winners, cup resets, consolation opponents and full 24-round seasons.
- Full suite: 256 tests across 22 files. TypeScript passed.
- Production build passed; existing season data refresh encountered upstream rate limits and successfully retained its cached/fallback data. Fantasy itself makes no upstream calls.
- Browser checks: selecting a driver updates budget and requires save; a four-round cup awarded a trophy and started cup two; reload kept the saved score, lineup and history; season table and cup history reflected the same results; team name/colour editing persisted; 390px phone layout had no document overflow or broken driver images.

## Decision room

Every race debrief now compares all six permutations of the original three drivers against that race's results. The recorded lineup is marked, alternatives show their totals and point difference, and selecting one exposes its three role bonuses. Base points remain unchanged. The highest score is explicitly hindsight, never a forecast or an edit to saved results. `compareRoles` is a pure scoring helper with tests for uniqueness, ordering and immutable input.
