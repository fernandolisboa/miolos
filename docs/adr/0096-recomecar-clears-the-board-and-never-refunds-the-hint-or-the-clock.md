# ADR-0096 — Recomeçar clears the board and never refunds the hint or the clock

**Status:** Accepted — 2026-10-13 (issue #298)
**Depends on:** [ADR-0042](./0042-the-termo-board-is-read-only-output.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md), [ADR-0095](./0095-three-free-hints-per-puzzle.md)
**Amends:** [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) — the chrome's grid gains a sixth area and one stateful child.
**Amended by:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) (#300) — decision 2's "free play still writes nothing" now excepts the settings key, written only from an *Ajustes* switch.
**Amended by:** [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) (#367) — Recomeçar also clears the undo history, and a hint is a point undo never steps past.
**Amended by:** [ADR-0127](./0127-sudoku-notes-are-a-local-per-cell-mask.md) (#368) — a Sudoku board that holds only notes is resettable: decision 1 clears the notes, and `onReset` stays on while any exist.
**Amended by:** [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md) (#369) — Recomeçar also clears the counted mistakes and unfreezes the board; `onReset` stays on while any are counted, on an empty board too.

## Context

A player who has wedged a Sudoku, Binairo, Nonogram, Rainhas or Cruzadinha board had no way back except to clear cells one by one. Each of those games gets a "Recomeçar" button. It must not become a way around the free hints per puzzle (ADR-0095), or around the time statistics.

## Decision

1. **Reset clears the player's cells and nothing else.** Every cell the player decided goes back to undecided (the reducer's `entries` array becomes all `null`; givens are stored apart). `hint.used` is kept, `hint.lastIndex` is dropped, and the clock, the selection and each game's tool (direction, paint mode, brush) stay as they are. `resetBoard` (`play/reset-board.ts`) is the one rule; each reducer passes its own derive. It returns the same state object when no cell is decided or the game is no longer `playing`.
2. **Local only.** The daily play record is rewritten by the existing persist effect; free play stays in memory. Nothing goes to the server, nothing to telemetry, and free play still writes nothing.
3. **The chrome gains a sixth grid area, `reset`,** holding `ResetControl`. The chrome is still data props plus one `children` slot (ADR-0077); the control owns its own state. `PlayChromeReadouts.onReset` is `null` while no cell is decided.
4. **Termo is out of scope.** Its board is output, not player cells (ADR-0042).

## Consequences

- A board with a spent hint, once reset, is played again with only the hints that were left before the reset. The hint note is cleared with the board (`resetBoard` clears the reason and the spotlight).
- Streaks, stats and medals are untouched: a reset changes nothing a completion is judged on.

## Rejected

- **Refunding the hint.** Reset, hint, note the answer, reset again would give unlimited hints against the free-hint cap.
- **Resetting the clock.** Look, reset, then solve fast would game the time statistics.
- **Keeping the hint-revealed cell.** The hint is spent either way, so this saves the player nothing, and it would make reset depend on the hint's history: the same board would reset to two different states.
- **Reusing `ConfirmAction`.** It is built for an async step (running, error, retry); a synchronous reset has none of those states.
