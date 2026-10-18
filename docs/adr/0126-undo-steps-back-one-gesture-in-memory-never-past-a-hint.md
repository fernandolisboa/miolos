# ADR-0126 — Undo steps back one gesture, in memory, and never past a hint

**Status:** Accepted — 2026-10-15 (issue #367)
**Amends:** [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (the reset row holds a third stateful child, `UndoControl`); [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md) (Recomeçar also clears the undo history).
**Amended by:** [ADR-0127](./0127-sudoku-notes-are-a-local-per-cell-mask.md) (#368) — decision 2: Sudoku's step fields are `entries` and `notes`; `undoable` takes the list.
**Depends on:** [ADR-0106](./0106-the-termo-current-row-is-editable.md), [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md)
**Amended by:** [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md) (#369) — the mistake count is kept outside `undoable`'s snapshot so undo never refunds it, and a frozen board has no undo.
**Amended by:** [ADR-0136](./0136-campo-minado-free-play-screen.md) (#373) — Campo Minado has no undo and takes no Ctrl/⌘+Z.
**Superseded in part by:** [ADR-0142](./0142-redo-replays-undone-steps-until-a-new-move.md) (#400) — decision 7's "No redo"; "no Termo" stands. Also amends decisions 4 and 6: every Recomeçar clears the history, and the control is a Desfazer/Refazer pair.
**Amended by:** [ADR-0143](./0143-the-nonogram-crosses-a-line-its-fills-complete.md) (#402) — decision 3: the Nonogram snapshot, Clássico and Cores, gains `autoCrossed`.

## Context

Fernando asked for undo in every game, as something small and good-looking, not a big "Desfazer" button. Five grid games (Sudoku, Binairo, Nonogram, Rainhas, Cruzadinha) share no play hook: three free-play screens call `useReducer` themselves. A drag in Nonogram or Rainhas is many dispatches. Hints are never refunded (ADR-0096).

## Decision

1. **The history wraps the reducer, not a hook.** `undoable(reduce, snapshot)` (`play/undo.ts`) wraps each game's exported reducer, so every call site gains `{ type: "undo" }` unchanged. A hook wrapper would need a sixth copy of the free-play callbacks.
2. **One step is one gesture.** A step records the board's `snapshot` keys only when `entries` change by value. `stroke-start` opens a gesture; `paint-over` and Sudoku's `lock-digit` continue it; any other change opens a new one. A gesture whose entries end equal to its opening snapshot is dropped (the *Número fixo* double tap). Undo closes the open gesture. Rainhas drags use the shared `stroke-start`/`paint-over` names for this, keeping their cross-only rule (ADR-0092 d2, ADR-0094 d4).
3. **A snapshot is the board and what derives from it** (entries, conflicts, Rainhas `autoCrossed`, the selection, Cruzadinha's direction, the `hint` object). Clock, `hint.used`, sync state and tools are never touched.
4. **Checkpoints.** `restore`, a Recomeçar that changed the board, and any change to `hint.used` clear the history, so undo never reaches past a hint or refunds it. A solved board has no undo.
5. **In memory only, capped at 200 steps.** No `playRecordSchema` change, so no rollback trap.
6. **The control** is a small paper tile with a curved arrow, first in the reset row, with no word on screen: `aria-label` and a CSS tooltip read "Desfazer". Ctrl/⌘+Z does the same, except in a text field, while a dialog is open, or while the Recomeçar question is open.
7. **No redo, and no Termo:** a judged Termo guess is final, and its current row already has ⌫ (ADR-0106).

## Consequences

- Every grid route carries about 2 KB more. After #376 the two Nonogram routes went over, and Fernando approved raising them on 2026-10-15: `/nonogram` gets its own 49 KB budget (48.1 KB measured) and `/modo-livre/nonogram` rises 74 → 76 KB (75.4 KB measured). The next relief is still the `playRecordSchema` split (ADR-0112), and it does not reach free play.
- New per-game board state must join that game's snapshot. State that does not derive from `entries`, like #368's pencil notes, must also join the change check in `undoable`, or a notes-only move records no step.
