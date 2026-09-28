# Do I need to do anything?

**No.** Migration 0014 ran on the Miolos database before #276 merged. Still open, low urgency: NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**The Cruzadinha joined free play** at `/modo-livre/cruzadinha` (#279, ADR-0088): no level, no clock, one hint, "Mais uma". The lexicon ships on that route only (+274.7 KB raw over `/`, budget 291 KB). Next, as one Quick change, add `/cruzadinha` and `/cruzadinha/concluido` to `impeccable.yml`'s URL scan, whose preflight needs a published row. The shared board already shows uneven key widths at 375 px and an em-dash advisory on the clue lists. After that: file per-game time buckets as an issue, then #206 cluster 10's `Frame` half (the `ErrorCard` half shipped in #279).

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**Queued:** the telemetry opt-out UI (ADR-0069 decision 5) did not ship in #36 and belongs to #37; moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the two account routes); #254 (the remote conclusion announces its body sentence twice); #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.
