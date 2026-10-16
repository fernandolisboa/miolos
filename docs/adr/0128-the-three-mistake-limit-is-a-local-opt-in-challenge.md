# ADR-0128 — The three-mistake limit is a local opt-in challenge, never a completion state

**Status:** Accepted — 2026-10-16 (issue #369)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) (a counted cell shows the wrong mark without *Mostrar erros*; the setting sits in the general group, hidden where no game counts); [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md) (Recomeçar clears the counted cells and is offered while any exist); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (one more data readout, `mistakes`, and no new stateful child).
**Depends on:** [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md), [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md), [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md)

## Context

Fernando asked for a mode where three mistakes lose the attempt and the player starts again. The grid games already judge a cell against the solution for *Mostrar erros* (`wrongCells`, ADR-0102). Two inputs pass through a wrong value on the way to a right one: the Binairo cycle tap and the Rainhas tap (empty → ✕ → queen), plus the *Número fixo* pointer write that a double tap takes back.

## Decision

1. **Opt-in, device-local.** *Limite de 3 erros* is a top-level switch, off by default, in Ajustes and in every grid game's dialog. It applies to Sudoku, Binairo, Nonogram (Clássico and Cores), Rainhas and Cruzadinha, daily, archive and free play. Not Termo (ADR-0038) and not Campo Minado.
2. **A mistake** is a write that leaves a wrong fill, queen, digit, value or letter. A cross is notation (ADR-0032) and never counts. Erasing, hints and undo never count, and undo never gives one back. A gesture counts at most one (ADR-0126's step).
3. **Held taps.** A pass-through tap is held and judged only when the next board-changing action targets another cell (a hint judges it first), against the value before the hold. Cells changed only by Auto-X never trigger the judgement. A direct write on the held cell replaces the hold. If the judgement is the third mistake, the action that triggered it is dropped. A held cell shows no wrong mark.
4. **The wrapper.** `withMistakes` (`play/mistakes.ts`) wraps each game's `undoable` reducer through `usePlayReducer`, outside the history, so undo never reaches the count. Each game exports its rules: how to judge, its cross value, and which actions are held.
5. **Frozen, not lost.** At three the reducer drops every board change except Recomeçar, the hint and undo are off, and the hint slot shows one line. Status stays `playing` and the clock keeps running. Turning the switch off unfreezes the board and keeps the count.
6. **Local only.** The record keeps the counted cells (`mistakes`, 1 to 3 indices, repeats allowed) while the board is open, never on a closed one. Nothing reaches the server: no outcome, stat, medal or telemetry.

## Consequences

- Rollback trap: an older client's `strictObject` refuses an open record that carries `mistakes`, and that day's board restarts. Closed records never carry it, so completions sync.
- A new grid game joins by exporting its rules and calling `usePlayReducer`.

## Rejected

- Counting a wrong ✕: one Auto-X queen would count many, and ADR-0032 makes a cross notation.
- Storing a bare count: with marks on every wrong cell, one drag could reveal the board for one mistake.
- A *lost* status: ADR-0008 keeps losing Termo-only, and a stopped clock would need a third state.
