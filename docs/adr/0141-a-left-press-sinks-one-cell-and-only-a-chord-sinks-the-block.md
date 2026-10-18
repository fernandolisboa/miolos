# ADR-0141 — A left press sinks one cell, and only a chord sinks the block

**Status:** Accepted — 2026-10-18
**Supersedes in part:** [ADR-0140](./0140-the-campo-minado-chord-presses-and-fires-on-the-first-release.md) decision 2 (what a held press draws) and the clause "a left click on an open number still chords" in decision 1.
**Amends:** [ADR-0136](./0136-campo-minado-free-play-screen.md) decision 4 (a mouse left click on an open number does nothing).

## Context

After ADR-0140, Fernando reported that a plain left press sank all the neighbours of a number and a plain left click on a number opened them. Windows does neither. Its source (`winmine.c`, `rtns.c` in the NT tree) says so: `TrackMouse` pushes down only the cell under the cursor on a normal press, and the unvisited, unflagged 3×3 (centre included) only while `fBlock` is set by both buttons, the middle button or Shift; `DoButton1Up` on a revealed number with `fBlock` clear does nothing; `StepBlock` chords only when the flags around the number match it. Any button's release ends a block press, which ADR-0140 decision 1 already does.

## Decision

1. **A held press sinks only its own cell** when that cell is closed and unflagged. A held chord (both buttons, or the middle) sinks `chordBlock`: the closed, unflagged cells of the 3×3 around the pointer, the centre included, whether or not the centre is open.
2. **A mouse left click on an open cell does nothing.** `useCellPress` passes the press kind to `onActivate`, and the minefield drops `left` on an open cell. A tap, a pen tap and the keyboard still chord an open number: they have no second button.
3. `chordBlock` replaces `chordTargets` in `@miolos/games/minesweeper`. `chordMinesweeper` opens the block of an open cell, which is the same set as before.

## Consequences

- Pinned by `T-WEB-S941` (the held press says whether it chords), `S943` (what is sunk), `S944` (a left click on a number does nothing; a tap or a key still chords) and the `chordBlock` properties in `packages/games/test/minesweeper/play.test.ts`.

## Rejected

- **Keeping the left-click chord as a shortcut:** Fernando asked for Windows' rules, and a stray click on a number with a wrong flag would end the game.
