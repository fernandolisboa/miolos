# Do I need to do anything?

**Yes, until PR 2 of #285 merges: NOW §3 and NOW §4.** Say yes or no to Rainhas as the sixth daily (§3, one word), and run migration 0015 on the Miolos database (§4, four SQL lines). PR 2 merges only after both; the session that merges it moves them to Done. Also NOW §2: the Google OAuth client and its two Vercel variables (#280, ADR-0089); Sign in with Google is merged but dormant until then. Still open, low urgency: NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**The Rainhas engine shipped** in `@miolos/games/queens` (#285 PR 1, ADR-0090): plant, grow and repair a region map, grade it with a deduction ladder, 7×7 Monday to 9×9 Sunday. Nothing a player can see changed. On 2,000 seeds per weekday no seed used more than 59 of 128 attempts. The slowest puzzle took 70 ms warm and 161 ms as a fresh process's first call (both Sundays).

**The Rainhas daily shipped** at `/rainhas` and `/arquivo/<data>/rainhas` (#285 PR 2, ADR-0091 and ADR-0092): tap cycles empty → X → queen, a drag crosses, conflicts get a ring and "em conflito". The hub is two rows of three. The Nonogram and Rainhas boards share `useBinaryBoard`, `nextBinaryHint` and `sizedBinaryRecordSchema`; every grid caret moves through `keyMove`/`movedSelection` in `apps/web/src/play/grid-selection.ts`.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**Six per-game medals is T-CORE-S70's maximum.** `queens-30` reached it. A seventh game needs that cap raised, with a reason, first.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**PR 3 of #285: free play at `/modo-livre/rainhas`**, per the plan on the issue. It removes the queens exclusion from T-WEB-S109 and adds the 5th free-play card rules at both breakpoints.

**Once the cron publishes the first Rainhas row,** add `/rainhas` and `/rainhas/concluido` to `.github/workflows/impeccable.yml`'s preflight list and both scan lists. The preflight refuses a daily route with no published puzzle, so PR 2 could not add them.

**Queued:** one daily/archive screen shell for the six games (the wrappers are ~95% alike); per-game time buckets as an issue; #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the three account routes); #254; #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s module walker in `archive-day.test.tsx` onto `module-graph.ts`.
