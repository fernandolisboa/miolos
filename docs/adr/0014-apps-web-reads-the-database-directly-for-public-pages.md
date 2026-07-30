# ADR-0014 — `apps/web` reads the database directly for public pages

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0007](./0007-separate-web-and-api-apps.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md)
**Closes:** the open M0 sub-question in [ADR-0007](./0007-separate-web-and-api-apps.md).

## Context

[ADR-0007](./0007-separate-web-and-api-apps.md) kept `apps/web` and `apps/api` separate and left one question open: may the web app read `packages/db` directly for public, server-rendered pages, or does every read cross the network to `apps/api`? The pages in question — the archive index, per-day puzzle pages, OG image generation — are the SEO surface, where an extra hop is pure latency on the pages search engines time.

## Decision

**`apps/web` may read `packages/db` directly, for public pages only.** The rule has three edges:

- **Scope:** public, unauthenticated, cacheable server-rendered reads — the archive, published puzzle pages, OG images. Nothing user-specific.
- **Gate:** every such read goes through the shared published-predicate helper from [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md). Direct access is direct access *to the helper*, never to raw tables — otherwise ADR-0004's guarantee would have two enforcement points to keep honest.
- **Everything else through `apps/api`:** anything authenticated or user-specific (streaks, completions, stats, consents), and **all writes and the cron, without exception** — that part of ADR-0007 was never open.

## Rejected

- **Single gateway for all reads:** the cleanest boundary and the most predictable Neon connection count, at the cost of a network hop on every SEO-critical render and a second cache layer to manage. The boundary this project actually needs — writes and identity in one place — survives intact without taxing the public pages.

## Consequences

- The published-predicate helper (and the read models it serves) lives in a shared package (`packages/db` alongside the schema, or `packages/core`), not inside `apps/api` — decided by whichever M0 ticket creates it.
- Two apps hold Neon connections. Both use the serverless driver; connection budgeting is a deliberate M0 configuration, not an accident discovered in production.
- The native client is unaffected: it consumes `apps/api` only, exactly as ADR-0007 promised. Direct reads are an internal shortcut of the web deployment, not part of any contract.
- If a public page ever grows a user-specific fragment (e.g. "you solved this one"), that fragment calls `apps/api` — the page does not get to widen the direct-read scope.
