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

- Every workspace with tests carries `vitest` and a `test: "vitest run"` script; Turbo fans out `pnpm test`.
- Property tests are ordinary Vitest files importing fast-check — no separate runner or CI step.
- A future runner change would touch every workspace and this ADR.
