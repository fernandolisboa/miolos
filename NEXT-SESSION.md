# Do I need to do anything?

**Not for Rainhas.** You said yes to it and ran migration 0015 on the Miolos database before #285 PR 2 merged; both are in the ledger's Done table. Also NOW §2: the Google OAuth client and its two Vercel variables (#280, ADR-0089); Sign in with Google is merged but dormant until then. Still open, low urgency: NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**Rainhas is complete** (#285): the engine (ADR-0090), the daily and archive (ADR-0091, ADR-0092) and free play at `/modo-livre/rainhas`. The daily and free screens share `useQueensBoard` and `BoardPanel` (`apps/web/src/queens/`); only `use-queens-play.ts` adds the lifecycle, and the free-play wall bans it.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**Six per-game medals is T-CORE-S70's maximum.** `queens-30` reached it. A seventh game needs that cap raised, with a reason, first.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**#290: once the cron publishes the first Rainhas row,** add `/rainhas` and `/rainhas/concluido` to `.github/workflows/impeccable.yml`'s preflight list and both scan lists. The preflight refuses a daily route with no published puzzle, so PR 2 could not add them.

**Queued:** #289, one daily/archive screen shell for the grid games (the wrappers are ~95% alike); per-game time buckets as an issue; #206 cluster 10's `Frame` half; the telemetry opt-out UI (ADR-0069 decision 5, #37); moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the three account routes); #254; #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s module walker in `archive-day.test.tsx` onto `module-graph.ts`.
