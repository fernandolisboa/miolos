# @miolos — packages/ui

Design tokens and primitives for the "Ateliê" visual system (see root [`DESIGN.md`](../../DESIGN.md) and the winning references in [`docs/design/006-handoff-design-winner-atelie/`](../../docs/design/006-handoff-design-winner-atelie/)).

Currently only [`tokens.css`](./tokens.css) — landed ahead of the monorepo scaffold per the design pipeline ("tokens land in `packages/ui`"). Package wiring (`package.json`, exports, font loading, lint/typecheck) arrives with the M0 scaffolding ticket.

Constraints that bind this package (CLAUDE.md invariants):

- Tokens and primitives only — never a cross-platform component abstraction (ADR-0002). A primitive is a value or a pure value-returning function with no JSX.
- Shared **web** components may live here only once a second consumer exists; until then they belong in `apps/web`.
