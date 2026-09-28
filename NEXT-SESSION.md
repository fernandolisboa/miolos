# Do I need to do anything?

**One open question, ledger NOW §2:** how Dia Perfeito counts once Cruzadinha is a fifth daily (default: every daily published that day). The ⚡ decision on #200 is still open and still low urgency; that default answers its option (c). To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

**#276, the Cruzadinha daily end to end** (epic #274). The engine and lexicon shipped in #275 (ADR-0085); the reviewed plan is on #276. It needs migration 0014 on the Miolos database before merge. After it: #206 cluster 10 (free-play `Frame` / `ErrorCard`).

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

**The crossword lexicon is not a Turbo test input.** After editing `content/crossword/lexicon.tsv`, run `pnpm --filter @miolos/games generate:crossword` and `pnpm test --force`.

## Next

**Queued:** the telemetry opt-out UI (ADR-0069 decision 5) did not ship in #36 and belongs to #37; moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the two account routes); the Binairo `validate.test.ts` uniqueness property has no explicit timeout and hit the 5 s default under CI load on #264; #254 (the remote conclusion announces its body sentence twice); #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.
