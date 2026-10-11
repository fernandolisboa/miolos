# ADR-0091 — Rainhas joins the catalogue as the sixth daily

**Status:** Accepted — 2026-10-11 (issue #285)
**Source:** the recommended option on the decision card in the 2026-10-11 "Next big feature" project thread; Fernando's answer is NOW §3 in `docs/pending-fernando.md`.
**Depends on:** [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md), [ADR-0024](./0024-buffer-stores-validated-content-reads-strip-inside-the-wall.md), [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0087](./0087-dia-perfeito-counts-the-dailies-published-that-day.md), [ADR-0090](./0090-rainhas-is-a-planted-grown-region-map-graded-by-a-deduction-ladder.md)
**Amends:** the founding handoff's "Catálogo v1" line: the catalogue gains Rainhas (`queens`) as its sixth daily, after the Cruzadinha. It adds a sixth accent under [ADR-0041](./0041-accents-colour-shapes-never-words.md), leaving its consequence (h) alone, and grows counts in [ADR-0087](./0087-dia-perfeito-counts-the-dailies-published-that-day.md) decision 4, [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md) decision 4, [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md) and [ADR-0080](./0080-paper-dark-accents-lighten-under-a-paper-label.md).

## Context

The catalogue was Termo, Sudoku, Nonogram, Binairo and the Cruzadinha. A sixth daily needed a generator that proves a unique solution and a weekday ramp; ADR-0090 gives Rainhas both. Rainhas is a region puzzle, so it adds a kind of deduction the other five lack, and it plays well on a phone.

## Decision

1. **Rainhas is the sixth daily**, at `/rainhas`, with an archive page at `/arquivo/<data>/rainhas`. It is last in `DAY_GAMES` and in `GAMES`.
2. **The projection is `{game, date, size, regions}`** (`dailyQueensResponseSchema`). `solution`, `seed`, `weekday` and `advancedSteps` are withheld. `stripDailyContent` picks by allowlist, and `FORBIDDEN_DAILY_KEYS` gains `advancedSteps`.
3. **The hint and completion detection run on the client** from `regions` (ADR-0027 unchanged): `solveQueens` finds the one solution, and `isValidQueensSolution` says when the board is solved.
4. **The completion body is the queens grid only**: `grid: (0|1)[size²]`, 1 for a queen. Marks never go on the wire. The server judges by exact equality with the stored solution.
5. **Rainhas is timed.** `TIMED_GAMES` gains it, so `/stats` carries a Rainhas block.
6. **`queens-30` is the 25th medal.** `all-games` stays on `ORIGINAL_GAMES`.

## Consequences

- Dia Perfeito counts Rainhas under ADR-0087 decision 1, unchanged. On launch day the first queens row lands after midnight, so it is not required that day.
- Every perfect day whose lineup holds six games needs six wins.
- The cron runs Rainhas fifth, between the crossword (~88 ms) and Sudoku (~222 ms); its slowest measured puzzle is 70 ms warm and 161 ms as a fresh process's first call (ADR-0090). `COST_ASCENDING_GAMES` holds the order.
- Migration 0015 widens both `game in (...)` CHECKs. It must run on the production database before this ships.
- Six per-game medals is T-CORE-S70's maximum. A seventh game needs that cap raised first.

## Rejected

- **Shipping the solution, as the Cruzadinha does (ADR-0086).** Rainhas is solvable from its regions in under a millisecond, so it has nothing to gain. It keeps the grid games' strip.
- **Sending the marks in the completion body.** They are the player's notes, not part of the answer.
