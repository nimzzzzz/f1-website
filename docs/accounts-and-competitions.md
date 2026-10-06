# The paddock: accounts and online games

The website can run without Supabase. `/login` and `/play/fantasy` or `/play/predictions` then show an explicit opening-soon state, with working practice links. No local score is presented as online competition.

## Connect once

1. Create a Supabase project in the site owner's account. The owner must complete account sign-in, Terms acceptance and any requested credential creation. No paid plan is required by this code.
2. Apply `supabase/migrations/202610070001_games.sql` through the Supabase SQL editor or migration tooling. This migration is for a new project and runs in a transaction. It creates profiles for existing users too.
3. Add the project's `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` to Vercel's production environment and `.env.local` for local testing. Redeploy after changing environment variables. The publishable key is designed to be public; table policies remain the access boundary.
4. Enable email authentication. In both the **Magic Link** and **Confirm signup** templates, include `<p>Your LIGHTS OUT access code: {{ .Token }}</p>`. The website verifies a six-digit code, not a link. Set a short OTP expiry (10 minutes recommended). Set the Site URL to `https://f1-website-three.vercel.app`. Keep email confirmation enabled and Supabase rate limits enabled.
5. Configure a verified email sender / custom SMTP for public sign-ups. Supabase's default mail service is restricted and is not a general production sender. Test a new sign-up and returning sign-in from two permitted email accounts before announcing online play. No signup is claimed to work until this test passes.
6. In a private local environment only, set `SUPABASE_SERVICE_ROLE_KEY` for the administration script. It is unnecessary for ordinary site routes; those use the publishable key plus the verified user's session and database policies. Do not place this key in a browser variable, commit or chat message.

Official setup: https://supabase.com/docs/guides/auth/server-side/creating-a-client and https://supabase.com/docs/guides/auth/auth-email-passwordless . Email delivery: https://supabase.com/docs/guides/auth/auth-smtp .

## What the site provides

- `/login`: animated garage entrance, immediate form availability, one-time code entry, resend cooldown, errors, reduced-motion support. Signing in creates the profile if necessary. No password is stored by the website.
- `/account`: public display name and private email, explicit per-game cloud save/restore, conflict detection, previous local backup recovery, local-device sign-out.
- `/play/fantasy` and `/play/predictions`: real event entries, server-clock deadlines at **Grand Prix qualifying** (not sprint qualifying), hidden picks before the deadline, independent global and private-league boards, full scoring receipts after final results.
- Private leagues: random 128-bit invite codes, 16-member cap, owner can replace the code. Existing members remain. All members may share the current code. Up to ten owned leagues. Joining a league includes all that season's game points.
- Fantasy league cups: four-race blocks, seeding by earlier season points then membership time/id. Membership is determined at the first race's entry deadline. Late joiners wait for the next cup. Missing entries score zero; empty bracket slots are byes. Equal match points use role bonuses, leader points, then seed. Cancelled races advance the higher seed. Corrections recalculate brackets. At least two eligible members are required. Global competition currently provides the season board; knockout brackets run within private leagues.
- Players choose a new entry each weekend; entries do not automatically roll over. Nothing is charged and there are no wagers or cash prizes.

## Publish genuine weekends

Published driver IDs, prices, team names and lock times must be reviewed before the first accepted entry. Prices are LIGHTS OUT game prices, not a claim about another fantasy product. Substitutes must be in the published roster. Rule snapshots become immutable once an entry exists; do not silently change terms after players enter.

A roster JSON is an array of `{ "id": "NOR", "first": "Lando", "surname": "Norris", "team": "McLaren", "price": 294 }`. Prices are integer tenths of a million; the default budget is 600 ($60m). Include every eligible driver and verify that three drivers fit the budget.

Run `npm run games:admin -- calendar 2026 /absolute/path/roster.json` to prepare upcoming weekends from OpenF1's meeting/session calendar. This writes a reviewable file in `/tmp` and does not publish anything. It requires actual qualifying and race session times; missing data is never invented. Review round numbers against the official calendar, especially cancelled or rearranged rounds.

A weekend file is an array with `season`, `round`, `name`, `locks_at` and `race_at` (ISO instants with UTC offset), `roster` and `budget`.

Run `npm run games:admin -- weekends /absolute/path/weekends.json` to validate. Add `--apply` to publish. The script requires local Supabase credentials for writes. Only publish genuinely confirmed deadlines.

## Score after final classification

Use a JSON file with `weekendId`, increasing integer `version`, and `result`:

```json
{
  "weekendId": "UUID from race_weekends",
  "version": 1,
  "result": {
    "confirmedFinal": true,
    "source": "https://www.fia.com/relevant-official-classification",
    "safetyCar": false,
    "drivers": [
      { "driverId": "NOR", "team": "McLaren", "qualifying": 1, "grid": 1, "finish": 1, "status": "finished" }
    ]
  }
}
```

The actual file must contain exactly one row for **every** published driver, including DNF/DNS/DSQ. Positions may be null where no classified position exists. Grid positions must reflect the actual race start, not qualifying. `safetyCar` means a full race safety car; a VSC alone is false. Biggest-mover ties award all tied finishers. No simulated result generator is used by this workflow.

Run `npm run games:admin -- score /absolute/path/result.json` for a dry run; this reads entries and validates/scorers, but writes nothing. Add `--apply` only after verifying final classification and race-control reports. All entries are scored in one database transaction. The same result version cannot be awarded twice. A corrected higher version replaces scores instead of adding duplicate points.

Results deliberately require reviewed final input; a provisional live-timing response must never silently award permanent competition scores.

## Verification

Database tests execute the actual migration in PostgreSQL via PGlite and test private saves, conflicting revisions, role permissions, private leagues, hidden pre-lock entries, roster/budget checks, lock deadlines, scoring publication and version conflicts. Pure tests cover substitute drivers, outcome validation and deterministic cup progression. Authentication/email delivery and cross-device sessions still need smoke testing against the newly connected cloud project.
