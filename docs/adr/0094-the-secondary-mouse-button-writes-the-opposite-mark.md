# ADR-0094 — The secondary mouse button writes the opposite mark; the Nonogram brush has two icons and no erase

**Status:** Accepted — 2026-10-13 (issue #299)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0092](./0092-the-rainhas-board-tap-cycles-drag-crosses-conflicts-show.md)
**Amends:** ADR-0037 decision 1 (the brush has two modes, no `apagar`, and a mark on a mark clears) and ADR-0092 decision 1 (a right click places or removes a queen), both for the mouse only.

## Context

On a desktop the Nonogram, Binairo and Rainhas boards are played with one button, so every second mark costs a trip to the brush row or an extra tap. Pencil-and-paper players already use two marks, one per hand. Touch and keyboard have no second button and must not change.

## Decision

1. **A press is `tap`, `left` or `right`.** `usePointerStroke` classifies it at `pointerdown`: button 2 is `right` for any pointer (a pen's barrel button counts); button 0 from a `mouse` is `left`; button 0 from touch or pen is `tap`. Other buttons are ignored. A keyboard `click` (`detail === 0`) is a `tap`. macOS Ctrl+click is not treated as `right`.
2. **A tap resolves at `pointerup` for every press.** A right click fires no `click`. `painting` now means only "capture and drag". A `click` with `detail > 0` that is not already consumed uses the press recorded at the last `pointerdown`, so a touch that slides into the next cell still lands on the start cell with the right press.
3. **The first cell of a stroke decides.** The hook calls `onStrokeStart(index, press)` on the first cell the stroke enters (the start cell, or the first cell entered when the press began on a clue rail), then `onPaintOver(index)`. If that cell already holds the stroke's value, the stroke clears only cells holding that value; otherwise it sets that value. Both are idempotent on re-entry. The latch is replaced by every stroke start. `apps/web/src/play/brush.ts` holds this as pure functions.
4. **Per game.** Nonogram: left and tap use the brush, right writes the opposite, drags included. Binairo: in cycle mode a tap cycles, left writes 1 and right writes 0; with a digit brush left writes it and right writes the other; no drag in cycle mode. Rainhas: left and tap keep the cycle, right places or removes a queen, a drag with any button still crosses. A tap on a cell already holding the mark clears it, so the Nonogram `apagar` brush and the Binairo `apagar` button are removed. Keys `0`, `1`, `2` are unchanged.
5. **The Nonogram brush is an icon-only two-segment toggle** (cross, then fill), named for assistive tech by `fillAria` and `crossAria`, with `aria-pressed` carrying the state. The active segment is raised. Binairo keeps its two digit buttons.
6. **`contextmenu` is prevented on the board container only.** This also blocks the touch long-press menu and the keyboard Menu key on the board; a cell has no useful menu.

## Consequences

- A right click on a filled Nonogram cell turns it into an X in one step; clearing is a click on the same mark.
- Binairo's cycle-mode tap now resolves at `pointerup`, not `click`.
- Mouse players with a brush selected get the brush on the left and the other value on the right.

## Rejected

- **An erasing stroke that clears every cell it crosses.** It destroys the other mark, so a sweep meant to clear fills would also wipe the player's X marks.
- **Keeping the `apagar` brush beside the icons.** Clearing is a repeat of the same mark and `0`/`Backspace`; a third mode would bring back the mode switching this removes.
- **Ctrl+click as a right press on macOS.** A two-finger trackpad click already sends button 2, and Ctrl+click is a browser gesture on other platforms.
- **Reading `pointerType` from `click`.** Older Safari does not deliver `click` as a `PointerEvent`.
