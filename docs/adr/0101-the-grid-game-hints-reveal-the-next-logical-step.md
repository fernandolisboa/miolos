# ADR-0101 — The grid-game hints reveal the next logical step

**Status:** Accepted — 2026-10-13 (issue #297)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md), [ADR-0088](./0088-cruzadinha-free-play-ships-the-lexicon-on-its-own-route.md), [ADR-0090](./0090-rainhas-is-a-planted-grown-region-map-graded-by-a-deduction-ladder.md), [ADR-0099](./0099-the-sudoku-hint-reveals-the-next-logical-step.md)
**Amends:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md) decision 1 for Binairo, Nonogram, Rainhas and the Cruzadinha, and closes its decision 5 (`nextBinairoDeduction`); [ADR-0099](./0099-the-sudoku-hint-reveals-the-next-logical-step.md) decision 4: `SudokuHintState` becomes the shared `HintState<R>`.
**Amended by:** [ADR-0143](./0143-the-nonogram-crosses-a-line-its-fills-complete.md) (#402) — decision 1: on the Nonogram, Clássico and Cores, a wrong fill is corrected before a wrong ✕.

## Context

After #296 only Sudoku's hint taught anything. The other games still filled the first empty cell and said *"Preenchemos uma célula para você."* Their engines already hold the deductions: Binairo's tiers in `techniques.ts`, Nonogram's `solveLine`, the Rainhas ladder in `grade.ts`. The Cruzadinha has no deduction; its answers come from the pistas.

## Decision

1. **One order for every grid game:** `nextLogicalHint` in `apps/web/src/play/grid-hint.ts` corrects a wrong entry first; else takes the engine's step if its value equals the solution's; else falls back to the first empty cell (the first empty picture cell or queen in Nonogram and Rainhas) with a sentence saying no simple step was found.
2. **One scan, two callers per engine,** as ADR-0099 decision 1: `applyTier1`/`applyTier2` hand each deduction to a visitor (`propagate` places, `nextBinairoStep` stops at the first); `nextQueensStep` and `gradeQueens` share the ladder in `queens/ladder.ts` (its own module, so the daily route ships the step without the grader); `nextNonogramStep` calls `solveLine`. Generation and grading output are pinned and unchanged.
3. **Binairo runs the duplicate-line scan before the lookahead.** The lookahead otherwise finds every such cell first, so its rule was never named. Rules 1–4 are sound and monotone, so the fixpoint and every grade are unchanged.
4. **Nonogram prefers a fill;** a cross only when no single line fixes a fill. Only fills complete the picture. A cross is still a one-line deduction the player writes down, while reaching a fill through several lines would need a sentence naming them all.
5. **Rainhas always reveals a queen:** eliminations run until a single appears and `after` names the hardest one, as in Sudoku. An X spends a scarce hint without moving "x de N rainhas".
6. **The Cruzadinha reveals a letter of the active pista,** else of the first open pista in list order, preferring a cell whose crossing pista is still open. The selection never moves (ADR-0030). It is computed in `apps/web` from the shipped letters (ADR-0086), never from the lexicon (ADR-0088).
7. **`HintState<R>` carries the reason and the spotlight for every game;** the reducer is the only place a hint is computed, and `resetBoard` clears both.

## Consequences

- Each tap costs one step: at most about 1.4 ms (Rainhas, 9×9), 0.3 ms (Nonogram, 15×15) and 0.2 ms (Binairo) on desktop Node.
- Generation output is unchanged. Binairo generation time is unchanged; Rainhas generation is faster, because `loneOpenCell` finds a unit's single in one pass.
- The Binairo step property joins the pull-request split (ADR-0059 decision 4): 4235 ms on the gate at 25 runs. The Nonogram and Rainhas step properties run at full count on every pull request.
- Binairo's lookahead has no witness cells, so its sentence names only the cell.

## Rejected

- **A random cell:** not a deduction, so nothing true can be said about it.
- **An X as the Rainhas step,** and **crosses first in Nonogram:** see decisions 4 and 5.
- **Choosing the Cruzadinha's easiest pista with the lexicon:** it would ship the lexicon on the daily route (ADR-0088).
- **Recording lookahead witnesses:** hot-path cost, as ADR-0099 rejected for eliminations.
