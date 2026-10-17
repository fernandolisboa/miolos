# ADR-0140 — The Campo Minado chord shows its press and fires on the first release

**Status:** Accepted — 2026-10-17
**Amends:** [ADR-0136](./0136-campo-minado-free-play-screen.md) decision 4 (both buttons chord when the first of them comes up, not when the last does; a held chord is drawn).

## Context

Fernando reported twice that the left + right chord "does not work well". In Chrome and Firefox every press order already opened the neighbours, but three things differed from Windows: nothing showed while the buttons were held, so a chord whose flags did not match looked like a dead click; the chord waited for both buttons to come up; and on Windows, where `contextmenu` follows the right mouseup, a chord that ended the game opened the page menu over the finished board.

## Decision

1. **Both buttons chord on the first release**, at the cell under the pointer then, as Windows' Minesweeper does. The second release does nothing. Middle still chords on its release; a left click on an open number still chords.
2. **A held press draws the cells its release would open.** `useCellPress` reports `heldAt`, the cell under a left, middle, tap or two-button press (never a right press alone); the minefield draws that cell's `chordTargets` (closed, unflagged neighbours of an open cell) as `.pressed`, the open cell's look. The press shows even when the flags do not match, which is when the player needs to see it.
3. **A right press, or a right button joining a left press, arms one window-level `contextmenu` net** (`useContextMenuNet`, shared with `usePointerStroke`). It lives until the next pointerup or pointercancel, plus one task, so it outlives a board that ends or unmounts under the pointer.

## Consequences

- `chordTargets` joins `@miolos/games/minesweeper`; `chordMinesweeper` opens exactly those cells.
- A pen's barrel button chords too: once both are held, the long-press timer stops.
- Pinned by `T-WEB-S940…S943` and the `chordTargets` properties in `packages/games/test/minesweeper/play.test.ts`. `T-WEB-S503`'s unmount case now waits for the release.

## Rejected

- **Chording on the last release (ADR-0136 as written):** a finger resting on one button kept the chord waiting, and a drift before it moved the target.
- **Pressing all eight neighbours:** an open or flagged neighbour would look pressed though the chord never touches it.
