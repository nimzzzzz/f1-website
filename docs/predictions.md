# Predictions: first playable release

Route: `/predictions`. Independent from Fantasy, with its own rules, storage, points and leaderboard. This is explicitly **practice mode**, using 24 fictional weekends and 15 computer opponents. No real deadlines, accounts, database, public competition, entry fees or prizes are connected. The route is noindex until shared play is ready.

## The game

Make six calls: Grand Prix qualifying pole (10), race winner (25), P2 (15), P3 (15), biggest mover (10), full safety car yes/no (5). Select three different podium drivers; picking an already selected podium driver swaps their position. Pole and mover can overlap the podium.

A podium driver in a different place earns 5 instead of the exact award. Biggest mover means the largest gain from starting grid to finish, among finishers; all tied biggest movers qualify. VSC alone does not count. Incorrect calls score zero.

Choose one confidence call to double that answer's award, including partial podium points. Maximum base total: 80. Maximum boosted ticket: 105, with a perfect winner boost. The rules dialog and result receipt show the scoring explicitly.

Drafts save automatically. Sealing copies the draft into an immutable-by-UI entry. Players cannot edit a sealed ticket, including after reload. Revealing scores the entry and opens the next weekend with an empty ticket. A pending entry never contributes to standings, and cannot be revealed twice. Season and latest-weekend tables share tied ranks. Every completed ticket stays available in the archive.

## State and data boundary

- `lib/predictions/game.ts`: pure scoring, validation, deterministic practice outcomes, CPU tickets, standings and save parsing.
- `app/predictions/`: the mint call-sheet interface, compact driver picker, ticket seal, result receipt, history and leaderboard.
- `components/games/GameDialog.tsx`: native modal/focus/scroll behavior shared with Fantasy, styled by each game.
- Storage key: `lights-out:predictions:practice:v1`. Only validated picks and entry state are stored; totals are recomputed. Fantasy's storage is separate. Historical entries are not affected by draft changes.
- Full-resolution local driver images are cropped in the interface; no enlarged timing-feed thumbnails.
- No scoring endpoint trusts browser input. There is no production scoring endpoint in this release. Client-side storage and deterministic outcomes are intentionally inspectable practice data, not a cheat-resistant online competition.

## Connecting real weekly play

Requires an account/database provider, then server-owned fixtures and qualifying lock times, authenticated entries, immutable ticket snapshots, transaction-backed idempotent scoring from finalized race data, corrections with audit history, and shared league/leaderboard records. Keep Fantasy and Predictions competitions and scoring versions separate. Apply the same published weekend result to everyone. Confirm race eligibility and exception rules before inviting players to a real season.

## Verification

Unit coverage includes exact/partial/boosted scoring, tied movers, duplicate podium swaps, sealed snapshots, double scoring prevention, season cap, malformed saves, historical scoring independence and shared leaderboard ranks. Browser QA covers selection/search, seal/reload/reveal, leaderboard/history, compact widths, and the shared Fantasy modal.
