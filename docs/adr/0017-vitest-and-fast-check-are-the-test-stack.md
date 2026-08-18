# ADR-0017 — Vitest and fast-check are the test stack

**Status:** Accepted — 2026-07-31
**Amended by:** [ADR-0057](./0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md) — decision 6 amends the *"only where the defaults don't suffice"* bullet's instantiated list from `apps/web` alone to five of the six workspaces. The prohibition on a config in `packages/games` is untouched and is now guarded by a test.

## Context

No founding document names a test runner, but the mechanical gate depends on one from the first ticket: `pnpm test` full suite, property-based tests for `packages/games` ("proved, not sampled"), Zod contract tests at the API boundary, and React smoke tests for `apps/web`. One runner has to cover Node-environment package tests and jsdom component tests across a pnpm monorepo without per-package transform ceremony.

## Decision

- **Vitest** is the single test runner for every workspace: native TS/ESM (no transform config), `environment: 'node'` by default and `environment: 'jsdom'` where the DOM is under test, engines matching Node 24. A workspace carries a `vitest.config.ts` only where the defaults don't suffice (originally `apps/web` alone, for jsdom + plugin-react + RTL cleanup; **amended at #114** — `packages/db`, `packages/core`, `packages/ui` and `apps/api` now carry one too, each doing nothing but importing the shared worker bound, because the default `maxWorkers = cpus − 1` is what made a developer box unusable). **`packages/games` must NOT have one**: importing `vitest/config` pulls vite's `.d.ts` (which references `@types/node`) into the package's `types: []` program, silently defeating the purity typecheck backstop — discovered when the negative typecheck test unexpectedly passed.
- **fast-check** is the property-based testing library, entering as a devDependency of `packages/games` only. The seeded-PRNG property test in #14 sets the prior art for the generator invariants that bind from #16 (unique solution, solvability, seed → puzzle determinism).

## Rejected

- **Jest:** ESM + TypeScript still need shims/transform config; nothing it offers over Vitest justifies the friction.
- **node:test:** no ecosystem pairing for jsdom/@testing-library, weaker watch DX, and property testing would still need fast-check anyway.

## Consequences

- Every workspace with tests carries `vitest` and a `test: "vitest run"` script; Turbo fans out `pnpm test`. *(**Annotated at #114** — [ADR-0057](./0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md) decisions 2 and 3. **The sentence stays true and becomes incomplete: turbo still fans out, at 2 locally and at 10 on CI.** The root script carries an inline `TURBO_CONCURRENCY=2`, because six `vitest run` processes each at `maxWorkers = cpus − 1` demand more memory than an 8-core developer box has and the suite went red on swap thrash rather than on any test; the gate passes `--concurrency=10` explicitly — turbo's own default — because on the hosted runner's vCPU count vitest's `maxWorkers` collapses to 1 and there is nothing for a cap to relieve. **A first revision of this annotation said no `**Amended by:**` header was taken and that no per-workspace `vitest.config.ts` was added. Both became false within the day** and are corrected rather than deleted: ADR-0057 decision 6 adds one to four workspaces and extends `apps/web`'s, so the header IS taken and the bullet above is amended. What did NOT change is the prohibition on one in `packages/games`, which is obeyed and is now additionally guarded by a fail-closed scan (`T-WEB-S229`) — written because the first attempt at decision 6 generated a config for every workspace with a glob and put a `vitest/config` import into that package, which is precisely the failure this bullet's second sentence describes. The sentence gains a term.)*
- Property tests are ordinary Vitest files importing fast-check — no separate runner or CI step.
- A future runner change would touch every workspace and this ADR.
