# ADR-0108 — The Cruzadinha size is a parameter and the lexicon reaches seven letters

**Status:** Accepted — 2026-10-15 (issue #330)
**Depends on:** [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0055](./0055-test-timeouts-are-sized-against-contention.md)
**Amends:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md)'s small-generator consequence; [ADR-0085](./0085-cruzadinha-is-a-seeded-fill-from-a-curated-lexicon.md) decisions 1, 4 and 5 and its 5×5 context; [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md)'s size figure and the `/modo-livre/cruzadinha` budget.
**Amended by:** [ADR-0111](./0111-cruzadinha-free-play-offers-5x5-or-7x7.md) (#330) — decision 2 and its last consequence: the split lands on the response projection, not on `crosswordDailyContentSchema`, and the build runs after a paint.

## Context

#330 asks for a bigger Cruzadinha. ADR-0085 fixed the grid at 5×5 and the answers at 3–5 letters, so a 7×7 grid needs a size axis in the engine and 6- and 7-letter answers. This change ships the engine and the content only: nothing a player sees changes, and the 7×7 free-play picker comes next.

## Decision

1. **`CrosswordSize = 5 | 7`.** `CROSSWORD_TEMPLATES` is keyed by size and `generateCrossword(seed, size = 5)`. Key 5 keeps the four templates in their order, so the default draws exactly what it drew before. `validateCrossword` accepts a square grid whose side is a key.
2. **The daily stays 5×5.** The API calls `generateCrossword(seed)`, and `crosswordDailyContentSchema` in `@miolos/core` refuses any other side (`T-API-S330`). That schema is where the rule lives: free play at 7×7 splits it into its own shape, never widens it, and the picker amends ADR-0088 decision 2 (no level, state `{seed}`).
3. **Seven 7×7 templates**: a self-mirrored cross and three mirrored pairs, chosen from the 324 connected, 180°-symmetric patterns that pass the shape rule. Together they use every length from 3 to 7. The selection criterion was at least 90 of 100 single-attempt fills on the shipped lexicon, measured, not tested; a lexicon or template change re-measures it, and a pair under it leaves together.
4. **Runs are 3 to size letters long**, the shape rule of ADR-0085 decision 5 at any size.
5. **The lexicon takes 6- and 7-letter answers.** `candidates.py` keeps the 3,000 most frequent VERO-accepted words of each long length, out of 11,433; curation kept 2,705 six and 2,737 seven. Floors of 2,700 each join ADR-0085 decision 4's.
6. **`/modo-livre/cruzadinha`'s budget is re-sized to 660 KB**: the measured 657.8 KB plus main's 2.3 KB headroom, one route's budget re-sized for content an ADR authorises. `MAX_DELTA_BYTES`, every other route and every marker stay as they were. The hub's prefetch of that chunk (ADR-0088) is re-accepted at the new size.

## Consequences

- This change leaves every 5×5 puzzle byte-identical, pinned by the hash in `packages/games/test/crossword/golden.test.ts`. ADR-0085's consequence stands: a PR that deliberately edits a 3–5 row or a 5×5 template re-pins the hash and says why.
- 7×7 fillability is measured, not proved. On the shipped 9,623 rows, over 10,000 seeds: no throw, 1.008 attempts on average (at most 2), 6.7 ms mean and 143 ms max per puzzle (5×5: 1.9 ms). The worst template fails 1.98% of attempts, so eight failures in a row is about 2×10⁻¹⁴ if independent. Eight budget-exhausted attempts, the throw path, took 653 ms. A throw lands in free play's `failed` phase and its retry (`apps/web/src/free-play/use-free-generation.ts`).
- Each template filled 97–100 of 100 seeds and reached the 100,000-fill cap of an exhaustive count. The commonest answer, `asa`, is in 14.5% of 7×7 grids (15.1% at 5×5).
- The route's chunk roughly doubles: from +288.7 KB raw / +74.1 KB gzip over `/` to +657.8 / +158.2.
- ADR-0055 timeouts, CI gate ms × 4 rounded up to 5,000: P1 at side 7 3,822 → 20,000; P2 at side 5 2,284 → 10,000 and at side 7 6,222 → 25,000; the golden hash 2,053 → 10,000.
- Generation is synchronous on the main thread, up to the 653 ms throw path at 7×7, so the picker paints its `generating` phase before it generates, or moves generation off the main thread.

## Rejected

- **Curating all 11,433 long candidates.** Twice the curation for a pool every template already fills to the cap.
- **A compact lexicon encoding.** It cuts raw bytes, not gzip, and changes the literal shape ADR-0088's markers rely on.
- **A per-size lexicon split.** The free-play route will offer both sizes, so it saves nothing there.
- **Caching the lexicon index.** Building it went from 0.24 to 0.56 ms per call; not worth module state.
