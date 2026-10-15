# ADR-0130 — Sudoku variants are layouts of units

**Status:** Accepted — 2026-10-15 (issue #371, part 1)
**Depends on:** [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0023](./0023-proved-not-sampled-property-testing.md), [ADR-0059](./0059-the-property-proof-splits-from-the-per-pr-gate.md), [ADR-0099](./0099-the-sudoku-hint-reveals-the-next-logical-step.md)

## Context

Fernando asked for Sudoku variants. The engine hard-coded 9×9 with 3×3 boxes in its unit tables, solver masks, generator and grader. Diagonal (Sudoku X) and Irregular (*Formas*) are both "another set of units over the same 81 cells", so one refactor buys both. Every classic daily must stay byte-identical for its seed.

## Decision

1. **Units are data.** `SudokuLayout` holds nine region ids per cell and any extra units. `geometryOf` turns it into fixed offsets: rows 0–8, columns 9–17, regions 18–26, extra units from 27. The classic layout's tables equal the old ones (`golden.test.ts`). `getSudokuConflicts`, `isSudokuSolved`, `sudokuPeers` and `nextSudokuStep` take an optional layout, classic by default.
2. **Classic keeps its own fill.** `fillGrid` stays sequential with today's rng draws, so classic output does not move. Variants fill with the shared MRV `search`, digits shuffled per node, under a node budget (`FILL_BUDGET`, 1 000). A fill also branches on the digit with the fewest places in a unit when that beats the tightest cell; plain cell MRV stalls on irregular maps.
3. **Irregular maps come from connectivity-safe swaps.** Start from the boxes; swap a cell with a cell of a bordering region that touches the first cell's region; keep the swap only if both regions stay 4-connected; 100 swaps, at most 4 000 tries; first-appearance ids (`src/regions.ts`, shared with Rainhas). A map is redrawn when its fill fails or after `FAILURES_PER_MAP` (8) failed carves in a row. Redraws use the master rng and count against `maxAttempts`.
4. **Locked candidates work over any region and extra unit.** The classic box↔line checks read regions. After them come two new checks: a region's candidates on one extra unit (pointing) and an extra unit's candidates in one region (claiming). With no extra units they never run, so classic takes the same steps in the same order.
5. **Variants use the weekday criteria.** `generateSudokuVariant({ seed, weekday, variant })` returns the puzzle plus its `layout`; `"classic"` is `generateDailySudoku` plus the classic layout.
6. **A diagonal hint unit is `kind: "diagonal"`.** An irregular region is still `"box"`; naming it is part 2's copy.

## Consequences

- Classic generation is faster than before (one mask array per unit kind): seeds 0–39 × 7 weekdays, best of 3, Node 24: main 29.3 s, branch 25.0 s.
- 500 seeds × 7 weekdays per variant, no throw. Most attempts in a tier: Diagonal 375 (tier 5), Formas 322 (tier 4), both under the 1 200 cap and the 600 the plan set as the alarm. Slowest: Diagonal 4.5 s, Formas 5.0 s (tier 5, this box, partly contended); means 4–406 ms and 13–698 ms by weekday. A failed fill counts as an attempt.
- The fill branch (decision 2) cut Formas tier 5 from about 1.05 s to 0.39 s mean over 40 seeds; budgets 300 to 3 000 and `FAILURES_PER_MAP` 2 to 16 were measured, and 1 000 / 8 were fastest.
- Part 2 (free-play UI) records its decisions in ADR-0131. Samurai and Killer are out of scope; so are variant dailies.

## Rejected

- **Solution-preserving swaps** (move region borders between equal digits of one solution): median 14 cells off the box, minimum 2.
- **Sequential fill on irregular maps**: 27 of 300 maps filled within 10 000 nodes.
- **A new map per attempt**: 133 of 500 filled; about 4× the classic cost per usable map.
- **`layout` on `SudokuPuzzle`**: it would change every classic object and the wire.
