# ADR-0127 — Sudoku notes are a local per-cell mask

**Status:** Accepted — 2026-10-15 (issue #368)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) (decision 2 gains *Limpar rascunho ao preencher*, on; decision 4: *Rascunho* releases the locked digit, and the double-tap restore also brings back notes); [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md) (decision 1 and the `onReset` rule of decision 3: a Sudoku board that holds only notes can be reset); [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) (decision 2: Sudoku's step fields are `entries` and `notes`).
**Depends on:** [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md)

## Context

Fernando asked for a notes mode (*Rascunho*) in Sudoku: several small numbers in one cell. Notes are private working state, like the entries themselves (ADR-0102 d4 keeps input modes out of the record). A cell holds up to nine, and the board has 81 cells.

## Decision

1. **A cell's notes are one 9-bit mask** (`1 << (digit - 1)`, 0 to 511), the same encoding as the solver in `packages/games` (not shared code). `SudokuPlayState.notes` holds 81 masks; `sudoku/notes.ts` is the pure helper. `packages/games` is untouched.
2. **A value always clears its own cell's notes.** The *Limpar rascunho ao preencher* setting (`cleanNotes`, on) only decides whether the digit is also removed from the notes of the cell's row, column and box. Removing a value strips nothing. A hint writes like any value.
3. **Rascunho is an input mode** (`noting`), never persisted, kept by Recomeçar. Turning it on releases *Número fixo*, and `lock-digit` does nothing while it is on. The double-tap restore (`DigitLockUndo`) carries the notes from before the first tap.
4. **Notes persist in the local play record** as `notes` (81 masks), written only when a note exists and the board is open, so `v` stays 1. They are never in the completion body and never reach the server.
5. **A note change is an undo step.** `undoable` takes the list of fields that make a step (Sudoku: `entries`, `notes`; the others: `entries`). `selected`, `violating` and the mode toggle record none.
6. **Recomeçar clears the notes** before its guard, so a notes-only board resets; `hasNote` joins `hasDecidedCell` in deciding whether Recomeçar is offered.

## Consequences

- A client from before this change parses records with `strictObject`, so a Sudoku record that carries `notes` is rejected by it. On a rollback an in-progress board with notes looks missing and is overwritten. Solved records never carry notes, so no completion is lost.
- A note never counts: not in the tally, not in *Mostrar erros*, not in the same-digit highlight, not in progress.
- `/sudoku` measured 50.6 KB over `/` (47.4 before), over the shared 48 KB. With Fernando's yes it gets its own 51 KB budget. This contradicts ADR-0112's Rejected per-route entry for `/sudoku` and the handoff's "split `playRecordSchema` first"; the split stays the next relief for every daily route.
- The keypad gains a pencil key; the phone keypad is six columns (digits 1 to 5 and the pencil, then 6 to 9 and a double-width erase).

## Rejected

- **Memory only:** a reload would erase the work the player spent the most thought on.
- **An array of digits per cell:** worst case about 1.6 KB, too close to the 2048-byte `WRITE_PROBE_BYTES` that stands for a whole record. Masks are at most about 0.4 KB.
- **Notes in the completion body:** they are not a result. `gridBody` (`play/sync.ts`) sends only `game`, `date`, `grid`, `elapsedMs` and `hintsUsed`, pinned by T-WEB-S836a.
- **A separate device key for notes:** it would avoid the rollback trap, but would be a second record per day to write, prune and keep in step with the play record's lifecycle (ADR-0126 kept the history in memory for the same reason).
