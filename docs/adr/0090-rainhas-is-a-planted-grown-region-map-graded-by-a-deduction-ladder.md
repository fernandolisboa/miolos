# ADR-0090 — Rainhas is a planted, grown region map graded by a deduction ladder

**Status:** Accepted — 2026-10-11 (issue #285)
**Depends on:** [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0055](./0055-test-timeouts-are-sized-against-contention.md)

## Context

Rainhas (`queens`, #285) is an N×N board cut into N regions. The player places one queen in each row, column and region, and no two queens may touch, diagonals included. The board has no givens: the region map is the whole puzzle. So the generator must produce a map with exactly one solution, and a difficulty that ramps from Monday to Sunday. Whether Rainhas joins the catalogue is Fernando's call (`docs/pending-fernando.md` NOW §2) and the subject of ADR-0091; this ADR covers the engine only.

## Decision

1. **Plant, grow, repair.** `generateQueens` in `packages/games/src/queens/generate.ts` plants N non-touching queens, one per row and column. Each queen seeds a region, and regions grow one free 4-neighbour at a time, picked by a per-region weight `u^skew`. A high skew makes a few large regions and many small ones, which is easier. While a second solution exists, `repairRegions` moves one of its queen cells, that touches another region, into that region, along with any piece cut off from the old region's planted queen. The planted solution stays valid and every region stays 4-connected. If no such cell exists, or after 64 moves, the attempt fails.
2. **Region ids are relabelled by first appearance**, row-major, so an id never says which row holds a region's queen.
3. **Difficulty is the ladder, not the search.** `gradeQueens` in `packages/games/src/queens/grade.ts` runs tier 1 (a unit with one candidate gets its queen) to a fixpoint. When it stalls, it applies the first tier-2 deduction a fixed scan finds (a region confined to one line, a line confined to one region, a cell whose queen would empty a unit). Only if none exists does it apply tier 3 (k regions confined to k lines, 2 ≤ k ≤ N−2). `advancedSteps` counts tier-2 and tier-3 applications, so it is reproducible, and `validateQueens` recomputes it.
4. **A board the ladder cannot finish never ships**, even when it is unique (`beyond-ladder`). A finished ladder also proves uniqueness, and the validator checks it again with `countQueensSolutions`.
5. **The weekday ramp** is `QUEENS_WEEKDAY_CRITERIA` in `packages/games/src/queens/validate.ts`: size 7, 8 or 9, the grow skew, the highest tier allowed and a band of advanced steps. Monday is 7×7 with tier 1 only; Sunday is 9×9 with 10–40 steps.
6. **N stops at 9** (`QUEENS_SIZES`): the board then has Sudoku's 9×9 cell geometry on a phone.

## Consequences

- A puzzle is a pure function of `(seed, weekday)`. Changing the ladder's scan order or the criteria changes what a seed produces and the step count stored with it.
- Measured on Node 24 over 2,000 seeds per weekday, no seed used more than 59 of the 128 attempts. The slowest puzzle took 70 ms in a warm process (a Sunday) and 161 ms as the first call of a fresh process.
- The solver is cheap enough for the client hint: `solveQueens` takes under 0.5 ms at N=9.
- The repair loop's uniqueness searches are the generator's cost centre, and each one rebuilds the board geometry, so `geometryOf` must stay O(N²).
- The tests check uniqueness with an independent instrument that tries all N! column orders (`packages/games/test/queens/fixtures.ts`), never the engine solver.

## Rejected

- **Random partitions filtered for uniqueness.** Of 5,000 random 4-connected 9×9 partitions, 13 had exactly one solution and 3,169 had none.
- **Grading by search effort.** Node counts depend on branching order and do not match what a player has to see; ladder steps do.
- **Givens on the board.** The region map already carries the puzzle, and a given queen only removes a step.
