# ADR-0011 — Free play is generated on the client

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0005](./0005-all-content-is-free.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)

## Context

[ADR-0005](./0005-all-content-is-free.md) put infinite auto-generated free play in the product. Someone has to run the generator. Server-side generation means an **unauthenticated, unmetered CPU endpoint** on the public internet — rate limiting, caching and abuse handling for a mode that, by [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), records nothing and therefore requires no trust.

`packages/games` is pure, deterministic, dependency-free TypeScript — it runs in a browser as-is. That was a design constraint chosen for other reasons; here it pays out.

## Decision

**The browser generates free-play puzzles locally.** The client picks a seed, runs the generator from `packages/games`, and plays. No free-play endpoint exists. Nothing is sent to the server, matching the "records nothing" rule. Termo stays excluded from free play ([ADR-0005](./0005-all-content-is-free.md); [ADR-0015](./0015-termo-word-list-is-ai-curated-under-mechanical-constraints.md) keeps the reason alive — the answer list is finite).

## Rejected

- **Server-generated:** an open CPU faucet needing rate limits and abuse handling, spent on the one mode with no integrity requirements.
- **Server-issued seed, client generates:** inherits the endpoint without gaining control — nothing verifies the client used the seed, and nothing needs to.

## Consequences

- Generator code ships in the web bundle. It is pure TS and small, and the solver/validator side is wanted client-side anyway for responsiveness ([ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md)'s local validation). Code-split per game so the Sudoku generator doesn't ride along on the Binairo page.
- Free play works fully offline once the page is loaded.
- Determinism gives a free future feature: a seed *is* a shareable puzzle. "Challenge a friend" links become trivially possible without any new infrastructure — noted, not scheduled.
- Zero server cost scales with the mode's popularity instead of against it.
