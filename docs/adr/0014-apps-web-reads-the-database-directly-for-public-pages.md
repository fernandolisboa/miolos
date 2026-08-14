# ADR-0014 — `apps/web` reads the database directly for public pages

**Status:** Accepted — 2026-07-30
**Depends on:** [ADR-0007](./0007-separate-web-and-api-apps.md), [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md)
**Amended by:** [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md) — the scope edge — *"Scope: public, unauthenticated, cacheable server-rendered reads"* — is **extended** to the public, unauthenticated but `force-dynamic` and interactive daily play routes `/<jogo>` and `/<jogo>/concluido`: they carry this ADR's substance (public, unauthenticated, non-user-specific, helper-gated) but are neither cacheable nor an SEO surface, which the scope line did not cover. ADR-0028 decision 5 states the extension; the unchanged half — anything authenticated or user-specific, and **all writes**, through `apps/api` — is untouched. *(Reciprocal line added at #31, alongside ADR-0053's; multiple `Amended by:` lines stack.)*
**Amended by:** [ADR-0031](./0031-per-device-day-state-is-a-local-monotone-safe-affordance.md) — the user-specific-fragment consequence — *"If a public page ever grows a user-specific fragment (e.g. 'you solved this one'), that fragment calls `apps/api` — the page does not get to widen the direct-read scope."* — is **narrowed** to fragments whose **source is server state**. A fragment rendered from device state held in `localStorage` reads no user rows, crosses no wall and needs no endpoint (ADR-0031 decision 4); every server-sourced user fact — the streak, "X de 4" across devices, statistics — stays exactly where this ADR put it. *(Reciprocal line added at #31, alongside ADR-0053's.)*
**Amended by:** [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) — the scope edge again, and this time at its own named example: **the archive ships `force-dynamic`**, uncached. The operator's only takedown is a `killed_at` database write with no deploy and no invalidation hook, so a cached archive page outlives it for the whole TTL. Cacheability was never this clause's load-bearing property — it was a description of the case the author had in mind; `public, unauthenticated, non-user-specific, helper-gated` is the substance and it holds. ADR-0053 decision 2 also records the standing precondition on any future caching of this family: the `killed_at` write gains a `revalidatePath` writer **first**. Decision 10 rests on ADR-0031's narrowing above rather than re-opening it.
**Closes:** the open M0 sub-question in [ADR-0007](./0007-separate-web-and-api-apps.md).

## Context

[ADR-0007](./0007-separate-web-and-api-apps.md) kept `apps/web` and `apps/api` separate and left one question open: may the web app read `packages/db` directly for public, server-rendered pages, or does every read cross the network to `apps/api`? The pages in question — the archive index, per-day puzzle pages, OG image generation — are the SEO surface, where an extra hop is pure latency on the pages search engines time.

## Decision

**`apps/web` may read `packages/db` directly, for public pages only.** The rule has three edges:

- **Scope:** public, unauthenticated, cacheable server-rendered reads — the archive, published puzzle pages, OG images. Nothing user-specific. *(Extended twice, and "cacheable" is no longer load-bearing. [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md) decision 5 extended this line to the `force-dynamic`, interactive daily play routes; [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md) decision 2 extends it to **the archive — this clause's own example** — which ships `force-dynamic` because a `killed_at` takedown is a database write with no deploy and no invalidation hook. What survives as the rule is the rest of the line: public, unauthenticated, non-user-specific, helper-gated.)*
- **Gate:** every such read goes through the shared published-predicate helper from [ADR-0010](./0010-publication-is-time-driven-published-at-plus-buffer.md). Direct access is direct access *to the helper*, never to raw tables — otherwise ADR-0004's guarantee would have two enforcement points to keep honest.
- **Everything else through `apps/api`:** anything authenticated or user-specific (streaks, completions, stats, consents), and **all writes and the cron, without exception** — that part of ADR-0007 was never open.

## Rejected

- **Single gateway for all reads:** the cleanest boundary and the most predictable Neon connection count, at the cost of a network hop on every SEO-critical render and a second cache layer to manage. The boundary this project actually needs — writes and identity in one place — survives intact without taxing the public pages.

## Consequences

- The published-predicate helper (and the read models it serves) lives in a shared package (`packages/db` alongside the schema, or `packages/core`), not inside `apps/api` — decided by whichever M0 ticket creates it.
- Two apps hold Neon connections. Both use the serverless driver; connection budgeting is a deliberate M0 configuration, not an accident discovered in production.
- The native client is unaffected: it consumes `apps/api` only, exactly as ADR-0007 promised. Direct reads are an internal shortcut of the web deployment, not part of any contract.
- If a public page ever grows a user-specific fragment (e.g. "you solved this one"), that fragment calls `apps/api` — the page does not get to widen the direct-read scope.
