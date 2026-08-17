# ADR-0017 — Vitest and fast-check are the test stack

**Status:** Accepted — 2026-07-31

## Context

No founding document names a test runner, but the mechanical gate depends on one from the first ticket: `pnpm test` full suite, property-based tests for `packages/games` ("proved, not sampled"), Zod contract tests at the API boundary, and React smoke tests for `apps/web`. One runner has to cover Node-environment package tests and jsdom component tests across a pnpm monorepo without per-package transform ceremony.

## Decision

- **Vitest** is the single test runner for every workspace: native TS/ESM (no transform config), `environment: 'node'` by default and `environment: 'jsdom'` where the DOM is under test, engines matching Node 24. A workspace carries a `vitest.config.ts` only where the defaults don't suffice (today: `apps/web`, for jsdom + plugin-react + RTL cleanup). **`packages/games` must NOT have one**: importing `vitest/config` pulls vite's `.d.ts` (which references `@types/node`) into the package's `types: []` program, silently defeating the purity typecheck backstop — discovered when the negative typecheck test unexpectedly passed.
- **fast-check** is the property-based testing library, entering as a devDependency of `packages/games` only. The seeded-PRNG property test in #14 sets the prior art for the generator invariants that bind from #16 (unique solution, solvability, seed → puzzle determinism).

## Rejected

- **Jest:** ESM + TypeScript still need shims/transform config; nothing it offers over Vitest justifies the friction.
- **node:test:** no ecosystem pairing for jsdom/@testing-library, weaker watch DX, and property testing would still need fast-check anyway.

## Consequences

- Every workspace with tests carries `vitest` and a `test: "vitest run"` script; Turbo fans out `pnpm test`. *(**Annotated at #114** — [ADR-0057](./0057-the-test-suites-memory-model-and-a-cap-that-binds-locally.md) decisions 2 and 3. **The sentence stays true and becomes incomplete: turbo still fans out, at 2 locally and at 10 on CI.** The root script carries an inline `TURBO_CONCURRENCY=2`, because six `vitest run` processes each at `maxWorkers = cpus − 1` demand more memory than an 8-core developer box has and the suite went red on swap thrash rather than on any test; the gate passes `--concurrency=10` explicitly — turbo's own default — because on the hosted runner's vCPU count vitest's `maxWorkers` collapses to 1 and there is nothing for a cap to relieve. **No `**Amended by:**` header is taken here**: this ADR's decision does not change, the runner does not change, and no per-workspace `vitest.config.ts` is added — ADR-0017's prohibition on one in `packages/games` is obeyed, and ADR-0057 decision 2 explicitly declines a new `packages/db/vitest.config.ts` on this ADR's *"only where the defaults don't suffice"* grounds. The sentence gains a term.)*
- Property tests are ordinary Vitest files importing fast-check — no separate runner or CI step.
- A future runner change would touch every workspace and this ADR.
