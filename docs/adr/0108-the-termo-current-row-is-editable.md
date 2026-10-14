# ADR-0108 — The Termo current row is editable: any cell, gaps allowed

**Status:** Accepted — 2026-10-14 (issue #327)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0042](./0042-the-termo-board-is-read-only-output.md), [ADR-0045](./0045-the-termo-screen-ships-no-hint-and-no-clock.md)
**Supersedes in part:** [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 1 for the active row (its five cells are focusable and named; the row's name no longer carries the draft) decision 5's caret rationale (the focused cell is the caret), and decision 10's announcer copy (positional). **Amends:** ADR-0042 decision 4 (the active row carries its own key listener beside the window one).

## Context

Fernando asked to place letters in any cell of the current row, so a player can fix a letter they already know and think around it. ADR-0042 made the whole board read-only output: letters filled left to right and Backspace removed the last one.

## Decision

1. **The draft is five slots and a cursor.** `TermoPlayState.draft` is `WORD_LENGTH` strings, `""` for an empty slot; `cursor` is always a real cell, `0…4`. Judged, held and future rows are unchanged output.
2. **Writing.** A letter goes to the cursor cell, then the cursor moves to the next empty cell, wrapping; with none left it advances one, stopping at the last cell. A letter typed on a full row therefore overwrites the cursor cell instead of being ignored.
3. **Erasing.** A filled cursor cell is cleared in place. An empty one steps left and clears that cell; if it is empty too, only the cursor moves.
4. **Submitting.** Enter needs all five cells filled. A row with a gap is a silent no-op, as a short row always was: the empty cell is the feedback, and no notice is added (`PRODUCT.md` principle 4). A submit starts the next row at its first cell; a server rejection restores the word with the cursor on its last cell.
5. **The active row follows ADR-0030.** Its cells are `<button>`s with one tab stop (the cursor cell); a tap moves the cursor and the focus there; focus follows the cursor while it is in the row. Each cell's name is `letra N de 5: X` or `…: vazia`. The row's name is `tentativa N de 6, sua vez`, so the letters are read once. A submit that removes the focused row gives focus back to the next editable row once it exists, only if focus fell to `<body>`.
6. **One key map.** `pressKey` in `termo/play-view.tsx` turns a key into an intent (letters, Enter, Backspace/Delete, ArrowLeft/Right, Home/End). The window listener (ADR-0042 decision 4, unchanged guards) and the row's own `onKeyDown` both use it; the guard's `button` bail keeps a key from being handled twice. From the unfocused page the window path also takes ArrowLeft/Right; Home and End keep scrolling the page and move the cursor only inside the row, and the page path prevents only Backspace's default, as before.
7. **The announcer is positional**: `a, 3 de 5` names the cell written or cleared. In-order typing reads exactly as before.
8. **No green prefill.** Placing a known letter is the player's move; filling it for them would be a hint, and Termo ships none (ADR-0045).

## Consequences

- The caret and the focus ring are the same inset `--ink` outline, because focus only lands on the caret cell.
- Pinned by `T-WEB-S640` (reducer) and `T-WEB-S641` (the row as a widget); `T-WEB-S86` and `T-WEB-S87` were re-aimed in place.

## Rejected

- **A "no caret" state after the fifth letter** (ADR-0042's model). Focus would sit on a cell that is not the cursor and needs a second visual mark.
- **A notice for a gapped Enter.** The gap is visible, and the notice region is for the server's answers.
- **Roving focus over all 30 tiles.** Only the current row takes input.
