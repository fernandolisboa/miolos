# ADR-0094 — The secondary button writes the opposite mark; the Nonogram brush has two icons and no erase

**Status:** Accepted — 2026-10-13 (issue #299)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0092](./0092-the-rainhas-board-tap-cycles-drag-crosses-conflicts-show.md)
**Amended at #325:** decision 4's Binairo cycle mode. The *Primeiro valor* setting (1 by default) now decides both inputs: a tap cycles empty → first → other → empty, left writes the first value and right the other. Touch used to start at 0 while left wrote 1. The digit brush and the keys are unchanged.
**Amends:** ADR-0037 decision 1 (all inputs) and its consequence (a) (the hook's surface: `Press`, `clickPress`, required `onStrokeStart`, `onContextMenu`); ADR-0092 decision 1 (the secondary button).

## Context

On a desktop the Nonogram, Binairo and Rainhas boards are played with one button, so every second mark costs a trip to the brush row or an extra tap. Pencil-and-paper players already use two marks, one per hand. The right (secondary) button exists on mouse and pen only. The rest applies to every input: the two-mode brush, no `apagar`, and the first-cell rule.

## Decision

1. **A press is `tap`, `left` or `right`.** `usePointerStroke` classifies it at `pointerdown`: button 2 is `right` for any pointer (a pen's barrel button counts); button 0 from a `mouse` is `left`; button 0 from touch or pen is `tap`. Other buttons are ignored. A keyboard `click` (`detail === 0`) is a `tap`.
2. **A tap resolves at `pointerup` for every press.** A right click fires no `click`.
3. **The first cell of a stroke decides.** If that cell already holds the stroke's value, the stroke clears only cells holding that value; otherwise it sets that value. `apps/web/src/play/brush.ts` holds this as pure functions.
4. **Per game.** Nonogram: left and tap use the brush, right writes the opposite, drags included. Binairo: in cycle mode a tap cycles, left writes 1 and right writes 0 (amended at #325); with a digit brush left writes it and right writes the other; no drag in cycle mode. Rainhas: left and tap keep the cycle, right places or removes a queen, a drag with any button still crosses. A tap on a cell already holding the mark clears it, so the Nonogram `apagar` brush and the Binairo `apagar` button are removed. Keys `0`, `1`, `2` are unchanged.
5. **The Nonogram brush is an icon-only two-segment toggle** (cross, then fill), named for assistive tech by `fillAria` and `crossAria`, with `aria-pressed` carrying the state. The active segment is raised. Binairo keeps its two digit buttons.
6. **`contextmenu` is prevented on the board container only,** plus a one-shot net while a right press is open, so a right drag released off the board opens no page menu.

## Consequences

- A right click on a filled Nonogram cell turns it into an X in one step; clearing is a click on the same mark.
- Touch players clear by tapping the same mark again or by stroking from it.
- A touch stroke starting on the brush's own mark now clears; ADR-0037 made it a plain SET.
- Binairo's cycle-mode tap now resolves at `pointerup`, not `click`.
- Blocking `contextmenu` also blocks the touch long-press menu, so a long-press-and-lift on a board cell now resolves as a tap.
- The keyboard Menu key opens no menu on the board.

## Rejected

- **An erasing stroke that clears every cell it crosses.** It destroys the other mark, so a sweep meant to clear fills would also wipe the player's X marks.
- **Keeping the `apagar` brush beside the icons.** Clearing is a repeat of the same mark and `0`/`Backspace`; a third mode would bring back the mode switching this removes.
- **Ctrl+click as a right press on macOS.** A two-finger trackpad click already sends button 2, and Ctrl+click is a browser gesture on other platforms.
- **Reading `pointerType` from `click`.** Older Safari does not deliver `click` as a `PointerEvent`.
