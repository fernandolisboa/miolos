# ADR-0016 — Pin TypeScript below 7 while typescript-eslint stable caps at <6.1.0

**Status:** Accepted — 2026-07-31

## Context

CLAUDE.md's dependency posture is "latest stable, never below active LTS", and pinning an entire major behind latest requires an ADR saying why. At the time of the monorepo scaffold (issue #14), `typescript` latest is **7.0.2** — the first release of the native (Go) port. `typescript-eslint@8.65.0`, the latest stable, declares `peerDependencies.typescript: ">=4.8.4 <6.1.0"`; its only TS7-tolerant build is the `canary` dist-tag. Type-aware linting is part of the mechanical gate (`pnpm lint`), so the lint toolchain's ceiling is binding.

## Decision

Pin `typescript` to **6.0.3** — the newest release inside typescript-eslint's peer range — as an exact version (no `^`/`~`) in every workspace's devDependencies. The exact pin makes drift visible: any bump is a deliberate edit, not a lockfile side effect.

**Unpin condition:** the moment a stable typescript-eslint release supports TypeScript 7, unpin in an ordinary dependency-bump PR. No new ADR is needed for the unpin; this one names the condition.

If `next build` were to fail under 6.0.3 (not expected — Next 16 targets TS 5.x/6.x), the fallback within this same rationale is the newest version both toolchains accept, recorded here before merging.

## Rejected

- **Forcing the peer dependency (TS 7 + typescript-eslint stable):** an unsupported combination inside a mechanical gate is a gate that lies.
- **Dropping type-aware linting:** weakens the gate; not acceptable.
- **Using the typescript-eslint canary:** pre-release tooling inside the gate trades one instability for another.

## Consequences

- Every workspace carries `"typescript": "6.0.3"` exactly; renovating it is one search-and-replace plus this ADR's unpin condition.
- TS 6.0 is the bridge release to 7.0, so the codebase stays on the migration path rather than diverging from it.
