# ADR-0030 — Grid games are composite widgets: one tab stop, roving focus, no `role="grid"`

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md), [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)

## Context

Issue #18 shipped the first board and deferred its keyboard model
explicitly. Plan 017 §8.2, verbatim: *"Arrow-key roving focus is
**not** in this ticket (64 tab stops is acceptable; a roving tabindex is
a follow-up if review asks)."* The shipped code says the same thing in
`apps/web/src/binairo/grid.tsx`'s `Grid` — *"the grid ships 64 ordinary tab
stops rather than a `role="grid"` that promises keyboard navigation it
does not implement"* — and softens the count by rendering givens as
inert `<div>`s, so only the playable cells are tab stops.

Issue #23 makes the deferral untenable, for two independent reasons.

**Scale.** Sudoku's board is 81 cells and, unlike Binairo, every cell is
reachable: a given must still be selectable, because a caret that skips
givens jumps unpredictably across the grid. Tabbing past 81 stops to
reach the keypad is materially worse than Binairo's 24–48 (64 cells
minus that weekday's 16–40 givens, `BINAIRO_WEEKDAY_CRITERIA` in `packages/games/src/binairo/validate.ts`).
#25's Nonogram is ≥15×15 — 225 — and #28's free play inherits whatever
this ticket decides, so the number only grows.

**Model.** Sudoku's input is cell-first: select a cell, then type or tap
a digit. The selection is a first-class piece of state that Binairo's
sticky paint mode never had. Once a board has a selected cell, the
roving-focus caret and the selection are **the same concept**, and
implementing one without the other means shipping two carets that can
disagree.

The obvious ARIA answer — `role="grid"` — is unavailable, and the reason
is structural rather than stylistic. A `grid` requires `row` (or
`rowgroup`) children owning the cells, and the board is one flat 81-item
CSS grid with explicit gutter tracks: the box rhythm and the cell
geometry are computed by that single grid. Adding a wrapper element per
row would break the layout unless each wrapper carried
`display: contents`, and a `role`-bearing element with `display: contents`
has a long, well-documented history of being dropped from the
accessibility tree — the exact failure mode where the markup asserts a
structure that assistive technology never receives. A silently wrong
`role="grid"` is worse than an honest `role="group"`, and the flat grid
is also what
[ADR-0002](./0002-plain-react-web-ui-not-universal-rn-web.md)'s "full CSS
is available" buys us.

## Decision

1. **A grid game's board is a composite widget from #23 onward.** It is
   a labelled `role="group"`; every cell is a `<button type="button">`;
   exactly one cell carries `tabindex="0"` — the selected one, or index
   0 when nothing is selected — and every other carries `tabindex="-1"`.
   The board is therefore **one tab stop** on the page.

2. **No `role="grid"`, and no row or box wrapper elements.** The board
   stays one flat CSS grid. Box separation on a Sudoku board is a
   widened gutter track with a drawn rule, not a container.

3. **The keyboard contract, handled by one listener on the board
   container** so that one handler serves every cell: arrow keys move
   the caret one row or column and **clamp at the edges** rather than
   wrapping; `Home`/`End` go to the first/last column of the current
   row; `Enter`/`Space` are the browser's native button activation,
   which is "select"; the game's own writing keys (digits, `Backspace`,
   `Delete`) are handled there too. Arrow keys `preventDefault` so the
   page does not scroll under the caret.

4. **Givens are focusable and carry `aria-disabled="true"`**, and are
   inert on activation. `disabled` is not used: a disabled button is
   unreachable, and the caret has to be able to cross a given.

5. **Selection and focus are one concept, enforced mechanically.** The
   selected-cell style and `:focus-visible` share a **single CSS
   declaration block**, so the two cannot drift apart in a later edit.
   The binding itself runs in both directions, and the roving `tabindex`
   is not it: on its own it names cell 0 as the tab stop while nothing
   is selected, which is a caret that cannot write. So **a cell that
   receives focus selects itself** (`onFocus` is the only writer of the
   selection), and **a pointer press focuses the cell it selected** —
   explicitly, because WebKit does not focus a `<button>` on click and
   would otherwise leave the board's keyboard contract dead after a tap.
   A layout effect closes the loop the other way, moving DOM focus after
   a selection change **only when focus is already inside the board**,
   so a control elsewhere on the page cannot steal the caret. Selecting
   the cell already selected returns the same state, so the effect and
   the focus handler cannot trade renders.

6. **The caret is an additive carrier.** It is drawn as an `outline`
   inset inside the cell's own border, while the cell's chromatic state
   is carried by `background`/`border`/`color`/`box-shadow: inset`. A
   cell that breaks a rule keeps saying so while it is the caret, and a
   revealed hint stays visible whether or not the caret is on it.

7. **Per-cell state rides in the composed accessible name**, never in
   `aria-invalid`: ARIA does not support it on `role=button` and
   `jsx-a11y/role-supports-aria-props` reds the lint gate. This is the shipped
   Binairo behaviour (`binairo/grid.tsx`'s `Grid`), kept and generalized.

8. **This reverses plan 017 §8.2's deferral for grid games, from #23
   onward.** The deferral was correct for a 64-cell board with 24–48
   playable cells and no selection state; it does not survive 81 cells,
   225 cells, or a cell-first input model.

## Rejected

- **`role="grid"` with `role="row"` wrappers carrying
  `display: contents`.** The correct-looking ARIA and the one that can
  silently evaporate: a role-bearing element with `display: contents`
  has a documented history of removal from the accessibility tree, and a
  grid whose rows are missing is a widget that announces a structure it
  does not have. `display: contents` also cannot move a node across
  subtrees, so it buys nothing else here.
- **Real per-row (or per-box) wrapper elements without
  `display: contents`.** They break the single flat CSS grid that
  computes the cell geometry and the box rhythm. For Sudoku a per-box
  `<div>` is additionally a card inside a card — a `DESIGN.md`
  anti-reference — and would fire `impeccable`'s `nested-cards` the
  moment it carried a shadow.
- **81 ordinary tab stops** (Binairo's model, scaled). Every keyboard
  user pays 81 presses to reach the keypad, and #25 would pay 225.
- **Making givens unfocusable inert `<div>`s** (Binairo's model). It
  removes dead tab stops in a model that has no caret; under roving
  focus it instead makes the caret skip cells, which is disorienting on
  a boxed grid and breaks arrow navigation's spatial promise.
- **Wrapping arrow navigation** from the last column into the next row.
  Cheap to implement and disorienting on a board whose rows and boxes
  are the whole mental model; clamping makes the edges discoverable.
- **A single `aria-activedescendant` grid with one real focusable
  element.** It avoids moving DOM focus, and it requires the
  `role="grid"`/`role="row"` structure decision 2 rejects, plus
  well-known inconsistencies in how virtual focus is announced.

## Consequences

- **(a) #25's Nonogram board and #28's free play inherit this model**,
  not 225 tab stops. Both are grid games with a selectable cell, so the
  decision is already made for them; what they owe is their own
  key-to-action table, not a new keyboard architecture.
- **(b) Binairo's shipped board is deliberately left as it is by #23**,
  so the repo carries **both** models until a follow-up retrofits it:
  Binairo's 64-cell grid keeps one ordinary tab stop per playable cell,
  with givens as inert `<div>`s, and the grid games shipped from #23
  onward are composite widgets. This is stated rather than implied,
  because the alternative — retrofitting Binairo inside a Sudoku ticket
  — would put a behavioural change to a shipped screen inside a commit
  whose whole value is that it is a behaviour-free move
  ([ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)).
  The retrofit is owed; this ADR does not claim it is scheduled.
- **(c) The focus ring and the selected state can never disagree**,
  because they are one CSS declaration block rather than two rules kept
  in sync by discipline. A reviewer checking this reads one block; a
  contributor restyling selection cannot forget the ring.
- **(d) A cell can render two carriers at once, by design.** Chromatic
  state answers *what this cell is*; the caret answers *where the player
  is*. Collapsing them — ranking "selected" inside the chromatic
  precedence chain — is what makes a revealed hint invisible whenever
  the caret lands on it and strips the caret from a violating cell
  exactly while the player is fixing it.
- **The board's keyboard model is testable in jsdom, and that is the
  point of putting it in the markup.** `tabindex`, `aria-disabled` and
  the composed accessible names are assertable without layout; the CSS
  block of decision 5 is assertable as stylesheet text. Neither claim
  depends on a browser, which matters because jsdom has no layout and no
  pointer capture.
