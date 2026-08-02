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
3. **[2026-07-31] `packages/games` purity gate is armed and evasion-hardened**
   Do instead: zero RN/Node deps there; property-based tests (fast-check) from the first generator; `createSeededRandom` is the PRNG substrate.
4. **[2026-08-01] GitHub CI runners are ~3-4x slower than the dev machine — heavy property tests near their timeout flake on main**
   Do instead: size in-file test timeouts at local wall time × 4 with margin; any test >10s locally gets an explicit timeout with the arithmetic in a comment (vitest default 5s; no vitest.config.ts in games per ADR-0017).

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
2. **[2026-07-31] `vercel env pull` appends `.env*` to `.gitignore`**
   Do instead: revert that `.gitignore` line after pulling envs.

## Domain Behavior Guardrails
1. **[2026-07-31] Streaks/dates always America/Sao_Paulo, computed server-side**
   Do instead: never trust the client clock; midnight fixed for every user.
2. **[2026-07-31] #15 users schema needs nullable `email` + verification state from day one (ADR-0003)**
   Do instead: model anonymous-first identity with the email-attach columns present but null.
3. **[2026-07-31] Termo word lists are finite curated content in `content/termo/` (ADR-0015)**
   Do instead: harness (#26) consumes them; never expose Termo to free play.

## User Directives
1. **[2026-07-31] Agent-owned merge: Fernando does not review PRs**
   Do instead: loop specialised review → fix → re-review until a review finds nothing, then merge and close autonomously; surface product decisions in PR/issue text without blocking.
2. **[2026-07-31] Eight-step flow per issue, each step a fresh subagent**
   Do instead: explore → plan → review plan → fix plan → implement (/implement) → parallel specialised reviews → fix → validate/merge; never patch forward over a bad plan.
3. **[2026-07-31] #41 (SHA-pin actions + security headers) lands before #15 ships anything session-bearing**
   Do instead: sequence #41's merge ahead of #15's merge.
