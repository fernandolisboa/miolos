# ADR-0142 — Redo replays undone steps until a new move

**Status:** Accepted — 2026-10-18 (issue #400)
**Supersedes in part:** [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) decision 7's "No redo" ("no Termo" stands).
**Amends:** [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) decisions 4 and 6 (every Recomeçar clears the history; the control is a pair); [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md) decision 2 (redo counts like undo: nothing); [ADR-0123](./0123-on-a-phone-the-rules-sit-behind-an-i-and-the-hint-shares-the-reset-row.md) decision 2 (under 360px the hint takes its own row); [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md) decision 7 (two chrome controls narrower than 44px under 390px); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (`PlayChromeReadouts` carries `onRedo`); [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) (`/sudoku` 52 KB, `/nonogram` 51 KB).

## Context

Fernando asked for a redo button in every game that has undo, enabled only when something was undone, and gone once the player makes a new move after undoing. Undo already keeps one snapshot per gesture in memory (ADR-0126). Termo and Campo Minado have no undo.

## Decision

1. **The redo stack lives beside the undo steps** in `UndoHistory` (`play/undo.ts`). Undo moves the current snapshot onto `redo`, redo moves it back, so the selection, conflicts and Rainhas' automatic crosses return with the board.
2. **A new step empties it.** Selections, ticks and tools record no step and leave it alone. A gesture that ends where it began (the *Número fixo* double tap) records no step either, so it gives the displaced stack back.
3. **Every checkpoint clears it** with the steps: `restore`, a hint, and every Recomeçar, including one that only cleared the mistake count, so a redo never brings back a wrong write whose cost Recomeçar wiped. A solved or frozen board has no redo.
4. **Redo never counts a mistake and never refunds one.** It replays a move whose cost was settled when it was first made, or was still pending: an undo that takes back a held tap (ADR-0128 decision 3) parks the hold in `MistakeState.parked`, and the redo that puts the value back re-arms it, so Desfazer then Refazer never makes a held write free.
5. **The control is a pair.** `UndoControl` draws Desfazer and a mirrored Refazer tile, tilted −3° and 3°, no word on screen. Refazer stays visible and `aria-disabled` while idle. Ctrl/⌘+Shift+Z and Ctrl+Y redo, under Ctrl/⌘+Z's exceptions; ⌘+Y is left to the browser.
6. **The phone row makes room.** Up to 1023px the reset row has no gap (Recomeçar and Ajustes carry their own padding). From 360px to 389px the two tile buttons are 40px wide and 44px tall, the only way the row fits beside the hint; that is a conscious exception to the 44px chrome rule. Under 360px the hint takes its own full-width row below, as beside a desktop board.

## Consequences

- `UndoAction` covers both directions, so every reducer and dispatch typed with it takes redo unchanged.
- `/sudoku` rose to a 52 KB budget (51.8 measured) and `/nonogram` to 51 KB (50.1), under Fernando's standing approval of budget raises (2026-10-16).
- Pinned by `T-WEB-S960…S965`.

## Rejected

- **Counting a redone wrong write again:** the player would pay twice for one move.
- **Keeping redo across a new move (a branching history):** Fernando asked for the opposite.
- **Moving the hint to its own row up to 389px:** it costs the board a row on the most common Android width.
