# Napkin Runbook

## Curation Rules
- Re-prioritize on every read.
- Keep recurring, high-value notes only.
- Max 10 items per category.
- Each item includes date + "Do instead".

## Execution & Validation (Highest Priority)
1. **[2026-07-31] Node is nvm-managed; bare `node`/`pnpm`/`vercel` may resolve wrong or not at all**
   Do instead: prefix shell commands with `source ~/.nvm/nvm.sh && nvm use default >/dev/null &&` (→ Node 24.18.1; jsdom needs ≥24.15).
2. **[2026-07-31] Evidence rule: never report a gate as passing without pasted output**
   Do instead: run `pnpm typecheck && pnpm lint && pnpm test` and include real output in the PR body.
3. **[2026-08-01] GitHub CI runners are ~3-4x slower than the dev machine — heavy property tests near their timeout flake on main**
   Do instead: size in-file test timeouts at local wall time × 4 with margin; any test >10s locally gets an explicit timeout with the arithmetic in a comment (vitest default 5s; no vitest.config.ts in games per ADR-0017).
4. **[2026-08-13] An ADR that amends another owes a reciprocal `**Amended by:**` header line in the amended file — step-6 reviewers reject its absence**
   Do instead: mirror the 0033↔0047 idiom (now also 0031/0041↔0048, 0026↔0049) in the same docs commit; plan exit criteria should name it. A corrected *sufficiency claim* in an old ADR's consequences counts as an amendment (0049 precedent).
5. **[2026-08-13] Unused API surface with contract comments naming non-existent consumers is a HIGH review finding in this repo**
   Do instead: ship only options/params a real call site uses; delete speculative hooks-of-the-future (useStreak enabled/refreshKey precedent; a generic `<T>` justified only by a future consumer died in #20's plan review).
6. **[2026-08-13] ADR-0023 reserves "prove" for construction-backed invariants — in tests AND docs, all packages, not just games**
   Do instead: single-fixture tests "pin" or "show"; reviewers rejected "proves/proved" three times across #20's rounds.
7. **[2026-08-13] `rm -rf apps/web/.next` (required before typecheck) deletes the stats file `pnpm bundle-check` reads**
   Do instead: run `pnpm build` in apps/web before bundle-check whenever .next was wiped.
8. **[2026-08-14] Pre-commit's full suite flakes under turbo's parallel fan-out (PGlite `beforeAll` timeouts, non-deterministic) — and turbo caches gate runs, so a cached re-run is a log replay, not evidence**
   Do instead: prefix every commit with `TURBO_CONCURRENCY=1 git commit …` (all ten of #29's commits needed it); re-run gates for PR-body evidence with `--force`.
9. **[2026-08-14] `impeccable detect` in CI runs per-viewport — desktop green does not imply mobile green**
   Do instead: check BOTH steps of the detect job (`/estatisticas` failed mobile-only on first-viewport-column-overflow; fix was mobile block flow, `0311f32`).
10. **[2026-08-14] A fix that changes a PLAN statement owes a §-deviations entry in the same round — the falsified-record standard applies to plans, not just ADRs**
   Do instead: after every step-7 fix, sweep the committed plan for now-false prescriptions and append the deviation (the #30 verification round REJECTED solely for five stale plan sentences after the a11y fix; ADR-0018↔0052 was the same class one commit earlier).

## Parallel-Stream Orchestration
1. **[2026-07-31] docs/ numbering is global and the docs/README.md "Current" table row ships in the same PR as the artifact**
   Do instead: orchestrator reserves NNN (plans) and ADR numbers across streams up front; every PR committing a plan/ADR adds its README row — this was a blocking review finding in four consecutive PRs.
2. **[2026-07-31] Shared substrate (e.g. packages/games/src/weekday.ts) diverges when a step-7 fix evolves it on one branch**
   Do instead: one stream owns the canonical file; siblings byte-copy and later sync via merge-from-main; serialize merges (owner first) and have every fix/merge agent `git merge origin/main` before gates.
3. **[2026-07-31] ADR-0023 floors main validity/determinism properties at ≥100 fast-check runs, pinned seeds in test files (never a vitest.config.ts in packages/games)**
   Do instead: cite ADR-0023 in engine test plans; secondary/achievability properties may sample lower (Binairo P3=25 precedent).
4. **[2026-07-31] Engine API conventions (post-#46/#47/#48): options-object generate({seed, weekday}), GAME_-prefixed exports, typed RejectionReason unions, diagnosed validator result, typed RangeError via isWeekday in generate**
   Do instead: converge new game modules on the Binairo/Sudoku shapes on main; validators return verdicts (Nonogram style) — cross-engine harmonization of throw-vs-verdict validators is an open note.

## Shell & Command Reliability
1. **[2026-07-31] Frontier query for open unblocked issues**
   Do instead: `gh api "repos/fernandolisboa/miolos/issues?state=open&per_page=100" --jq '.[] | select(.pull_request == null) | select((.issue_dependencies_summary.blocked_by // 0) == 0) | "#\(.number) \(.title)"'`
2. **[2026-07-31] `vercel env pull` appends `.env*` to `.gitignore`; no `psql` on this box**
   Do instead: pull to an absolute path OUTSIDE the repo (`vercel env pull <scratchpad>/x.env --environment=production` from the app dir) — `.gitignore` stays untouched; apply migrations with a temp script over `@neondatabase/serverless` (`neon(url).query(...)` per statement, split on `--> statement-breakpoint`), then delete script + env file (#21 precedent). A script living in the scratchpad can't resolve the package — import the absolute path `<repo>/packages/db/node_modules/@neondatabase/serverless/index.mjs`; and `sql.query()` returns a plain row ARRAY, not `{rows}` (#30 precedent).
3. **[2026-08-13] vitest 4 has no `--concurrency` flag; and a mocked `fetch` that returns ONE shared Response poisons multi-consumer screens**
   Do instead: serialize with `--maxWorkers=1`; in tests where several clients share the fetch stub (streak + stats on the conclusion), return a fresh Response per call or `deferred.then((r) => r.clone())` — a Response body reads once.
4. **[2026-08-13] `gh pr merge --squash --delete-branch` on a dirty worktree: the GitHub merge SUCCEEDS but the local checkout aborts and the remote branch survives**
   Do instead: after the error, `gh pr view --json state,mergeCommit` before retrying anything; stash the dirty file (`.claude/napkin.md` is the usual culprit), checkout main, pull, pop, then delete local+remote branch manually.

## Deploy & Migration Ordering
1. **[2026-08-13] Preview deploys share the PRODUCTION Neon DB (handoff 019) — the drizzle column-list trap fires at FIRST BRANCH PUSH, not merge**
   Do instead: any migration touching a table with INSERT writers (users, completions…) is applied to Neon BEFORE the branch's first push; audit every writer of the table; work fully local until the apply is confirmed (#21 precedent).

## Domain Behavior Guardrails
1. **[2026-08-12] Bundle markers are route-scoped and fail closed (ADR-0047): a new route makes `route-client-js.mjs` exit 2 until classified**
   Do instead: any PR adding a route classifies it (daily union vs `/modo-livre*`) in the script in the same PR; never weaken the double-role markers (`Escada`/`zurro` forbidden in one scope, expected in the other — that IS the anti-vacuity control).
2. **[2026-08-12] The free-play ESLint wall bans named modules, non-transitive; free play is ephemeral by decision (ADR-0046)**
   Do instead: hoist helpers both sides need to a wall-legal module (`play/picture-path.ts`, `binairo/state.ts` precedents), never copy into `free-play/`; no storage/timer/completion language in free play. Any module newly one-hop from a walled value (incl. `app/page` since #19) gets banned BY NAME in both static group and dynamic regex, with probes.
3. **[2026-08-13] `/` is route-client-js.mjs's un-budgeted baseline — hub client JS shifts every route's measured delta without failing anything**
   Do instead: any PR adding client JS to `/` publishes fresh measured before/after figures (incl. `/` itself) in the PR body and never retunes budgets to absorb it.
4. **[2026-07-31] Streaks/dates always America/Sao_Paulo, computed server-side**
   Do instead: never trust the client clock; midnight fixed for every user. Streak reads anchor on `todaySaoPaulo(db)`; `computeStreak` (packages/core) consumes `onTime` as row data, never recomputes it (#58 forward-compat).
5. **[2026-08-13] The attach/merge stack is live but dormant: `mergeAccounts` (ADR-0049) + magic-link confirm (ADR-0050) with the winner-liveness guard**
   Do instead: cross-account confirm REVOKES all winner sessions post-merge (ADR-0050 D13, flow-level amendment of ADR-0009's cookie claim) — never weaken it; the recovery-direction stranding residual is recorded (repair seam = the nightly consistency check over `listCompletionsForMerge`); activation waits on RESEND_API_KEY + WEB_ORIGIN (fail-closed until both).
6. **[2026-08-14] Stats are read-time derivations on closed contracts (ADR-0051): unfiltered reader → core derivations, exclusions live at seam 2**
   Do instead: a new stats consumer gets a NEW endpoint/contract (never a field on `statsResponseSchema`/`statsCalendarResponseSchema`); #30's medals derive over the same `StatsRow` reader; today-decorations on fetched aggregates gate on `stats.date === <record date>` (midnight-boundary rule); response dates feeding throwing parsers use `calendarDateString`.
7. **[2026-07-31] #15 users schema needs nullable `email` + verification state from day one (ADR-0003)**
   Do instead: model anonymous-first identity with the email-attach columns present but null.
8. **[2026-07-31] Termo word lists are finite curated content in `content/termo/` (ADR-0015)**
   Do instead: harness (#26) consumes them; never expose Termo to free play.

## User Directives
1. **[2026-07-31] Agent-owned merge: Fernando does not review PRs**
   Do instead: loop specialised review → fix → re-review until a review finds nothing, then merge and close autonomously; surface product decisions in PR/issue text without blocking.
2. **[2026-07-31] Eight-step flow per issue, each step a fresh subagent**
   Do instead: explore → plan → review plan → fix plan → implement (/implement) → parallel specialised reviews → fix → validate/merge; never patch forward over a bad plan.
3. **[2026-07-31] #41 (SHA-pin actions + security headers) lands before #15 ships anything session-bearing**
   Do instead: sequence #41's merge ahead of #15's merge.
