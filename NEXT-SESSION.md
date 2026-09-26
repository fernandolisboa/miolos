# Do I need to do anything?

**No.** Migrations 0012 and 0013 are applied and in the ledger's Done table. The ⚡ decision on #200 is still open and still low urgency. To work through the ledger: start a session with *"run /wizard over docs/pending-fernando.md, NOW section"*.

## Start here

Nothing to verify. #36 is closed; consent withdrawal is ADR-0082.

## Traps

**Turbo's cache for `packages/db` tests does not cover `apps/api/src`.** `users-updated-at.test.ts` scans `apps/api/src`, but the db test task's cache key does not include that folder, so pre-commit can replay a stale pass. Run `pnpm test --force` before trusting a green gate after an `apps/api` change.

**Dependabot npm PRs cannot be merged as opened.** They change one `package.json` and never `pnpm-lock.yaml`, so `--frozen-lockfile` fails. Land them as one hand-made bump across every pin, outside `minimumReleaseAge` (7 days).

## Next

**#206 cluster 9** — re-derive the audit's numbers first, as clusters 1, 4, 7 and 8 had to.

**Also queued:** the telemetry opt-out UI (ADR-0069 decision 5) did not ship in #36 and belongs to #37; moving the remaining write routes onto `writePreamble` (`apps/api/src/http/write-preamble.ts`, today used by the push route and the two account routes); the Binairo `validate.test.ts` uniqueness property has no explicit timeout and hit the 5 s default under CI load on #264; #254 (the remote conclusion announces its body sentence twice); #205's CSS half (~1,820 lines, NOT a sweep); #155 (`bundle-check` into CI); the `jsonResponse`/`stubFetch` Quick change; folding `T-WEB-S183`'s duplicate module walker in `archive-day.test.tsx` onto `module-graph.ts`.
