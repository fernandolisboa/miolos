# ADR-0142 — Redo replays undone steps until a new move

**Status:** Accepted — 2026-10-18
**Amends:** [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) decisions 6 and 7 (the control is a pair, and there is redo); [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md) decision 2 (redo counts like undo: nothing); [ADR-0123](./0123-on-a-phone-the-rules-sit-behind-an-i-and-the-hint-shares-the-reset-row.md) (under 360px the hint takes its own row).

## Context

Fernando asked for a redo button in every game that has undo, enabled only when something was undone, and gone once the player makes a new move after undoing. Undo already keeps one snapshot per gesture in memory (ADR-0126). Termo and Campo Minado have no undo.

## Decision

1. **The redo stack lives beside the undo steps** in `UndoHistory` (`play/undo.ts`). Undo pushes the current snapshot onto `redo`; redo pops it and pushes the current snapshot back onto `steps`, both under the 200-step cap. The same snapshot keys move both ways, so the selection, conflicts and Rainhas' automatic crosses come back with the board.
2. **A new step empties it.** Selections, ticks and tools record no step and leave it alone. A gesture that ends where it began (the *Número fixo* double tap, a drag back to its start) records no step either, so its opening keeps the displaced stack in `displaced` and gives it back when the gesture is dropped.
3. **Every checkpoint clears it** with the steps: `restore`, a Recomeçar that changed the board, a hint. A solved or frozen board has no redo.
4. **Redo never counts a mistake and never refunds one.** It replays a move whose cost was already settled when it was first made, exactly as undo takes one back without a refund.
5. **The control is a pair.** `UndoControl` draws Desfazer and a mirrored Refazer tile side by side, tilted apart (−3° and 3°), with no word on screen. Refazer stays visible and `aria-disabled` while there is nothing to redo. Ctrl/⌘+Shift+Z and Ctrl+Y redo, under the same exceptions as Ctrl/⌘+Z; ⌘+Y is left to the browser.
6. **The phone row makes room.** Up to 1023px each tile's button is 40px wide (44px tall) and the reset row has no gap, since Recomeçar and Ajustes carry their own padding. That keeps the pair, Recomeçar, Ajustes and the hint on one row from 360px up (measured: 8px spare at 375px, 9px at 360px). Under 360px they cannot share it, so the hint moves to its own full-width row below, as it sits beside a desktop board.

## Consequences

- A held tap (ADR-0128 decision 3) that undo cleared comes back uncounted on redo, the same gap a reload already leaves.
- `UndoAction` covers both directions, so every reducer and dispatch typed with it takes redo unchanged.
- Termo and Campo Minado still have neither control.
- The pair costs about 1 KB on the grid routes: `/sudoku` rose to a 52 KB budget (51.8 measured) and `/nonogram` to 51 KB (50.1), under Fernando's standing approval of budget raises (2026-10-16).
- Pinned by `T-WEB-S960…S965`.

## Rejected

- **Counting a redone wrong write again:** the player would pay twice for one move.
- **Keeping redo across a new move (a branching history):** Fernando asked for the opposite, and every editor the player knows drops it.
