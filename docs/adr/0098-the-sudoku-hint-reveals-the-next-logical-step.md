# ADR-0098 — The Sudoku hint reveals the next logical step

**Status:** Accepted — 2026-10-13 (issue #296)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md), [ADR-0095](./0095-three-free-hints-per-puzzle.md)
**Amends:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md) decision 1, for Sudoku only: with no wrong entry, the hint fills the next deducible cell, not the first empty one.

## Context

The Sudoku hint filled the first empty cell in reading order and said only *"Preenchemos uma célula para você."* That cell is often not one a player can deduce yet, so the hint taught nothing. The grader in `packages/games/src/sudoku/grade.ts` already runs a ladder of human techniques (singles, locked candidates, pairs, triples, X-Wing).

## Decision

1. **One ladder, two callers.** `createLadder` in `grade.ts` holds the candidate state and the five technique scans. `gradeInternal` steps it to grade a puzzle; `nextSudokuStep(grid)` steps it on the player's board until the first placement. A separate stepper would be a second copy that must change with the grader.
2. **Cheapest is the ladder's own order:** a naked single before a hidden single, each in scan order. Only singles place a digit. When none exists, the ladder runs its eliminations and reveals the single they unlock; `after` names the hardest elimination used (by grade tier). `after` is the ladder's label, not an independent proof; literal fixtures in `packages/games/test/sudoku/step.test.ts` pin it, including a board whose hardest elimination is not its last and one where two of the same tier tie (the first wins).
3. **Order in `nextSudokuHint` (`apps/web/src/sudoku/hint.ts`):** a wrong entry is still corrected first; else the step, but only if its digit equals the solution's; else the first empty cell, with a sentence that says no simple step was found. The solution check keeps a board shape the property test never sampled from ever writing a wrong digit.
4. **The reason and the spotlight live in reducer state** (`SudokuHintState`). The spotlight is the step's unit (hidden single) or the cell's peers (naked single), tinted with the selection's `unit` class until the next board action, except re-selecting the selected cell, which changes nothing (ADR-0030). The reason stays until the next hint. The selection does not move.
5. **The chrome reads the reason from one always-mounted `aria-live="polite"` region**, for every game. Not `role="status"`: the Cruzadinha already renders one.

## Consequences

- `grade.ts` now ships on the daily Sudoku routes; generation output is unchanged (the pinned regression in `generate.test.ts` holds).
- One tap costs one ladder run: at most about 0.4 ms on desktop Node on the hardest boards measured. The elimination scans allocate nothing, which also made generation about 18 % faster.
- The other games keep ADR-0027 decision 1 until #297 gives them a step.

## Rejected

- **A cell with the fewest candidates** as the fallback: it is not a deduction, so nothing true can be said about it.
- **Recording elimination witnesses** to name the cells an elimination used: hot-path cost, and the sentence does not need them.
- **A timer for the spotlight**: it would vanish while the player reads.
- **Moving the selection to the revealed cell**: the caret stays where the player put it (ADR-0030).
