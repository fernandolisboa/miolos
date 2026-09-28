# Do I need to do anything?

**Yes, one database step if it is still open: ledger NOW §3, migration 0014 on the Miolos database.** It only widens two CHECKs; #276 merged after Fernando confirmed it. Still open, low urgency: NOW §2 (Dia Perfeito with five games; the shipped default is "every daily published that day", ADR-0087) and NOW §1 (#200). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**The Cruzadinha is live as the fifth daily** (#274: #275 engine, #276 daily; ADR-0085/0086/0087). The first crossword is published by the first cron after the merge. Then, as one Quick change, add `/cruzadinha` and `/cruzadinha/concluido` to `impeccable.yml`'s URL scan, whose preflight needs a published row. After that: file per-game time buckets as an issue, then #206 cluster 10 (free-play `Frame` / `ErrorCard`).

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**A perfect day needs a lineup buffered before midnight (ADR-0087).** If every buffer ran dry and all of a day's rows were inserted after `published_at`, that day cannot be perfect. The buffer alert exists to prevent that.

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**Queued:** the telemetry opt-out UI (ADR-0069 decision 5) did not ship in #36 and belongs to #37; moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the two account routes); the Binairo `validate.test.ts` uniqueness property has no explicit timeout and hit the 5 s default under CI load on #264; #254 (the remote conclusion announces its body sentence twice); #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.
