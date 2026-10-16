# ADR-0131 — Sudoku free play offers Diagonal and Formas as variants

**Status:** Accepted — 2026-10-16 (issue #371, part 2)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decisions 2 and 3 (Sudoku gains a _Variante_ beside its level; its state is `{seed, level, variant}`, in component state); [ADR-0135](./0135-termo-free-play-offers-dueto-and-quarteto.md) decision 5 (Sudoku's variant code is static, not a lazy chunk; the trigger and menu are shared); [ADR-0130](./0130-sudoku-variants-are-layouts-of-units.md) decisions 5 and 6 (`generateSudokuVariant` moves to `@miolos/games/sudoku-variants`; a Formas region is named "região"); [ADR-0127](./0127-sudoku-notes-are-a-local-per-cell-mask.md) decision 2 (notes are cleaned across the layout's units, diagonals and regions included).
**Depends on:** [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md)

## Context

ADR-0130 made Diagonal and Formas generable; nothing could play them. The daily `/sudoku` sits at 50.5 of its 51 KB, so the daily must carry almost none of the variant code, and the Formas board has no 3×3 rhythm to draw.

## Decision

1. **The variant engine is its own subpath, imported statically.** `@miolos/games/sudoku-variants` holds `generateSudokuVariant`, `fillVariant`, `assertSudokuLayout`, `DIAGONAL_LAYOUT` and the irregular maps; only `free-play/use-free-sudoku.ts` imports it (ESLint wall, `T-LINT-S67a`). A lazy chunk measured 51.6 KB on `/sudoku`. The daily only passes `SudokuPlayState.layout` (classic by default) to conflicts, the solved check, hints, notes and the highlight.
2. **The same _Variante_ trigger and popover as Termo** (`variant-trigger.tsx`, `variant-menu.tsx`), not a second chip row: no height on a phone. Free play parses the layout with a frozen Zod schema that checks it through `assertSudokuLayout`, the one statement of the rules.
3. **The look is data built in free play.** `sudokuLook` (`free-play/sudoku-layout.ts`) gives the `Board` a `BoardLook`: Formas closes the gutter tracks, spaces cells evenly by margin and draws 2px ink region borders in the spacing, never past the board's edge; Diagonal draws a pencil stroke under each diagonal cell, masked out of its middle so it never crosses a digit. A cell's name gains "região N", "na diagonal" or "nas duas diagonais" before the colon.
4. **A Formas region is a "região"; "bloco" stays the 3×3 box.** `messages.ts` gains the `region` unit kind and the naked single takes the cell's unit list; free play relabels a Formas `box` unit before it calls `sudokuHintExplanation`. `isBoxLayout` compares contents, so a parsed classic layout keeps "bloco".

## Consequences

- `/sudoku` stays at 50.5 KB, unchanged by this PR against `main` (also 50.5); `/modo-livre/sudoku` went from 36.3 to 42.4 of 48 KB. The copy lives in `messages.ts` (ADR-0018), so the shared messages chunk grows 0.8 KB raw on every route, which the per-route deltas do not show.
- Only the free screen may import `sudoku/hint` as a value: a second importer under `free-play/` split the daily's hoisted Sudoku scope and cost `/sudoku` 0.9 KB.
- Node, 200 seeds, Difícil: p90/p99 Clássico 767/2232 ms, Diagonal 524/1077, Formas 968/1971 (≤ 1.5× Clássico, 0 throws); Leve and Médio stay under about 115 ms at p99. A Web Worker stays the named escalation.
- Pinned by `T-WEB-S861…S869`. Variant dailies, the archive, records and URL state stay out of scope.
