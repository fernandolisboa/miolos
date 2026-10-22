# ADR-0145 — The Binairo board is a composite widget where 0 and 1 write their digit

**Status:** Accepted — 2026-10-22 (issue #61)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0092](./0092-the-rainhas-board-tap-cycles-drag-crosses-conflicts-show.md), [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md), [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md)
**Amends:** ADR-0030 decision 3 and consequence (b), and ADR-0037 decision 2 and consequence (b), for Binairo only.

## Context

ADR-0030 (b) and ADR-0037 (b) owed Binairo the composite-widget retrofit: its 64 cells were 64 tab stops, its givens inert `<div>`s, and it had no keyboard caret. Two parts of the shared contract do not fit Binairo. `Enter`/`Space` are "select" in ADR-0030, and `0` clears in ADR-0037 decision 4 and ADR-0092 decision 3, but `0` is a Binairo value, and a tap on a Binairo cell already writes.

## Decision

1. The board is a labelled `role="group"` of 64 `<button>` cells with one tab stop and a roving `tabindex`. A given is a focusable button with `aria-disabled="true"` that writes nothing (ADR-0030 decisions 1 and 4). `selected` is play state and joins the undo snapshot, never the step fields and never the saved record, so a select is not a step.
2. Keys: the arrows, `Home`, `End`, `PageUp` and `PageDown` move through `keyMove`. `0` writes 0 and `1` writes 1; the same key again clears; `Backspace` and `Delete` clear. A key ignores the paint mode. Ctrl, ⌘ and Alt pass through, so undo keeps working.
3. `Enter` and `Space` are the cell's tap, the browser's button activation with `detail` 0: the cycle from *Primeiro valor*, or the brush value in paint mode. Selecting a cell is focusing it: a pointer press or Tab selects through `onFocus`, the arrows move `selected` and focus follows, and undo restores it.
4. `onStrokeEnd` comes through `useBinaryBoard`, as ADR-0037 decision 2 requires; no second focus fix exists. Under pointer capture the retargeted click never reaches a cell, so `onStrokeEnd` focuses the end cell of a paint stroke. In cycle mode (`painting: false`) nothing is captured, `pointerup` taps and `onStrokeEnd` focuses the cell.
5. Binairo keeps its own reducer. It reuses `withCaret` and `useCaretControls`, and `caretPress` for the mistake rules, and does not join `BinaryGridState`, which would need `solution`, `size` and a given-aware restore (#410).

## Consequences

- A tapped cell now shows the caret, as on the other boards. The caret and `:focus-visible` are one CSS block, an inset `--ink` outline.
- A held cycle tap is judged once when a key lands on the same cell, and a caret move between a held tap and the next write keeps the hold (ADR-0128).
- `useBinaryBoard` takes optional `painting` and `keys`; Nonogram, Rainhas and Cores keep their `1` / `2` / `0` table and always paint.
- The controls tip gains a keyboard sentence. A screen-reader pass over the group is still owed (ADR-0037 (d)).

## Rejected

- **Nonogram's table (`1` fills, `2` marks, `0` clears):** `0` would clear on a board where it is a digit, and `2` has no meaning here.
- **`Enter`/`Space` only select:** the cycle would then have no keyboard path that touch and assistive technology share, and selecting is already focusing.
- **Joining `BinaryGridState` in this ticket:** it would rewrite the `binairo-state.test.ts` oracle that proves the retrofit changed no behaviour.
