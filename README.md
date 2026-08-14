# LIGHTS OUT

The 2026 Formula 1 season — championship standings, the calendar, race
results and live session timing. Next.js App Router, statically rendered
with ISR; all data comes from [openf1](https://openf1.org) through a
server-side proxy.

## Running it

```bash
nvm use                       # Node 24, see .nvmrc
npm install
cp .env.example .env.local    # see the note below — the build needs this
npm run dev                   # http://localhost:3100
```

**Port 3100, always.** Never 3000 — that port belongs to a different
project on this machine. `dev` and `start` are both pinned to 3100; if you
need to free it, only ever touch 3100.

## Build and test

```bash
npm test                      # vitest, ~150 tests
npm run build                 # production build
npm start                     # serve the production build on 3100
```

Verify against a local production build (`npm run build && npm start`),
not `dev` — ISR, static generation and the share cards all behave
differently there. Against the deployed site make only a few spaced plain
requests: Vercel's firewall fingerprints rapid automated traffic and will
start answering 403.

### The build can refuse, on purpose

If the season compute fails and there is no fallback source, the build
exits with `[season-data] refusing to build`. That is not a bug. A build
in that state would bake "STANDINGS DATA IS WARMING UP" into static HTML
and hand all 33 driver and team pages the homepage as their canonical —
silent, and something ISR cannot repair.

Almost always it means openf1 is rate-limiting: wait and re-run. Setting
`NEXT_PUBLIC_SITE_URL` (see `.env.example`) lets the build fall back to
the last good bundle from production, which is what happens automatically
on Vercel.

## Generated data

Three committed artefacts are produced by scripts rather than by hand.
Each has a test or a guard that fails if it drifts.

| command | writes | when to run |
|---|---|---|
| `npm run sync-roster` | `lib/roster-fallback.ts` | the grid or calendar changes |
| `npm run subset-fonts` | `app/fonts/*.subset.woff2` | after `sync-roster`, or when UI copy adds a character |
| `npm run dedupe-media` | prunes `public/media` aliases | after `npm run fetch-media` (already chained to it) |

`sync-roster` is the snapshot that lets pages and share cards render
without a live compute; it refuses to write an implausible roster.
`subset-fonts` regenerates the Geist subset — `tests/font-subset.test.ts`
fails if a name or glyph arrives that the committed files don't cover, and
the failure names the missing code points.

## Layout

```
app/          routes; *Client.tsx are the interactive halves
components/   shared UI, motion and session-picker machinery
lib/          data contracts, the season compute, SEO, manifests
scripts/      generators and the perf measurement tools
tests/        vitest
```

The season compute lives in `lib/season-data-server.ts` and is the one
place that talks to openf1 at build time. Read the comment blocks there
before changing caching — the layering is deliberate and was arrived at by
measurement.
