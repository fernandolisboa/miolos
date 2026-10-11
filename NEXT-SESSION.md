# Do I need to do anything?

**Not for this PR.** The next one, PR 2 of #285 (the Rainhas daily), does not merge until you pick Rainhas as the sixth daily and run migration 0015 on the Miolos database. PR 2 adds both to `docs/pending-fernando.md`. Still open, low urgency: NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**The Rainhas engine shipped** in `@miolos/games/queens` (#285 PR 1, ADR-0090): plant, grow and repair a region map, grade it with a deduction ladder, 7×7 Monday to 9×9 Sunday. Nothing a player can see changed. On 2,000 seeds per weekday no seed used more than 55 of 128 attempts, and the slowest puzzle took 124 ms. Fisher–Yates now lives once, as `shuffleInPlace` in `packages/games/src/random.ts`.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**PR 2 of #285: the Rainhas daily, end to end**, per the plan and its binding revisions on the issue. It needs Fernando's pick and migration 0015 before merge (above). Its `queens-30` makes six per-game medals, the T-CORE-S70 maximum. Then PR 3, free play at `/modo-livre/rainhas`.

**Queued:** `/cruzadinha` and `/cruzadinha/concluido` in `impeccable.yml`'s URL scan (a Quick change; its preflight needs a published row); per-game time buckets as an issue; #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`); #254; #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s module walker in `archive-day.test.tsx` onto `module-graph.ts`.
