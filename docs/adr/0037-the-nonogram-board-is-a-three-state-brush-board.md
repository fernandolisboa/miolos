# ADR-0037 — The Nonogram board is a three-state brush board: sticky modes, drag strokes on a shared pointer hook, and clue rails inside the composite widget

**Status:** Accepted — 2026-08-01
**Depends on:** [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md), [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md), [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md)

## Context

[ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md)
settled the keyboard architecture for grid games — one tab stop, roving
focus, `role="group"`, no `role="grid"` — and its consequence (a) says the
next board owes *"their own key-to-action table, not a new keyboard
architecture."* This ADR is that table plus the four things a Nonogram
board forces that a Sudoku board did not.

**The board drags, and that is not a preference.** A 15-class board is
225 cells at ≈18.9 px on a 390 px phone. Tap-only means up to 225 discrete
taps and no way to fill a run of seven in one gesture. Dragging is the
primary gesture of this game, not a convenience on top of tapping.

**A stroke carries no value of its own.** This is the fact that decides
the controls. Sudoku's keypad is a set of *commands* precisely because
Sudoku does not drag: pressing `7` means "write 7 here", and the command
carries its own value. A Nonogram drag has to be idempotent over the cells
it crosses — `paint-over` must be a plain SET, not a toggle, or a stroke
that re-enters a cell undoes itself — so the value a stroke writes can
only come from state held outside the gesture. Binairo's shipped `cycle`
default is instructive here rather than copyable: `binairo/state.ts`'s
`paint-over` case ignores that action **entirely** in cycle mode, because
"cycling on drag is chaos". Binairo can afford that because its drag is
secondary. Copying the default here would ship this game's main input dead on
first paint.

**Pointer capture leaves a door open that a composite widget has to
close.** The shipped stroke machinery takes `setPointerCapture` on the
*container*, and the container then receives the trailing `click` — the
browser retargets it — so a cell's own `onClick` never runs during a
stroke. Sudoku's WebKit fix ("a pointer press focuses the cell it
selected", ADR-0030 decision 5) lives in exactly that handler. A board
that both drags **and** roves is therefore the first board where the fix
has a hole in it, and it is the first board that exists.

**The clue rails are new furniture inside the widget.** They are not
cells, they carry the information without which the board is unsolvable,
and they sit inside the same flat grid
([ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md)).
How they are exposed is an accessibility decision, and the two obvious
cheap answers are both defective: a role-less `<div>` carrying only
`aria-label` is not reliably exposed — the undocumented defect Binairo's
board already carries — and relying on the rail's subtree text
concatenates the per-number spans of `2 2 2 2 3` into `"22223"`.

## Decision

The board inherits ADR-0030's composite-widget model **unchanged** — one
labelled `role="group"`, cells as `<button type="button">`, one cell at
`tabindex="0"`, one `onKeyDown` on the container, `onFocus` as the only
selection writer, the caret as an additive `outline` — and adds five
things.

1. **A sticky three-way brush: preencher / marcar / apagar, as
   `aria-pressed` toggles, exactly one pressed, `preencher` at first
   paint. There is no cycle mode.** The brush is state, so `aria-pressed`
   is not decoration: it is how a non-sighted player queries which mode a
   stroke is about to apply, before applying it.

2. **The board drags, and the pointer-stroke machinery moves verbatim
   into `apps/web/src/play/use-pointer-stroke.ts`.** This fires
   [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md)
   consequence (c)'s **written** trigger — *"stays in `binairo/grid.tsx`
   until #25 gives it a second consumer"* — so the extraction is a
   conditional coming true rather than a new decision. What *is* new, and
   what this ADR owns, is the hook's added seam: an optional
   **`onStrokeEnd(index)`**, called once at `pointerup` with the cell the
   stroke ended on. That is the focus door pointer capture leaves open —
   the composite-widget boards use it to move DOM focus, and `onFocus`
   then selects, so both the pointer path and the keyboard path arrive at
   the same single selection writer. **Binairo omits `onStrokeEnd`**, and
   that clause is scoped to `onStrokeEnd` alone (see the amendment below).
   The extraction lands as **move + rename in its own commit**, with the
   Binairo suite green and every assertion unchanged in *what* it asserts;
   `onStrokeEnd` is added in the commit after.

   **Amended at #25's step 7 — the hook owns a SECOND thing, and it is not
   inert for Binairo.** `usePointerStroke` also carries a window-scoped end
   net (`armWindowEnd` / `detachWindowEnd` plus an unmount cleanup), added
   after the extraction by step-6 finding NONO-C6 and pinned by `T-WEB-S59`
   in `apps/web/test/pointer-stroke.test.tsx`. It closes the latch a stroke
   leaves when pointer capture was never taken and the pointer lifts outside
   the container: without it `strokePointer` stays set and the board writes
   nothing for the rest of the session. Binairo's DEFAULT cycle mode passes
   `painting: false` and never requests capture, so it takes that branch on
   every `pointerdown` where the pre-move code returned early — a runtime
   change to a shipped game, benign (the container's own `onPointerUp`
   detaches first) and a fix for a latent cycle-mode latch, but a change.
   "Binairo omits it and is unchanged" was true of `onStrokeEnd` only.

3. **The clue rails are labelled `role="group"` elements inside the flat
   grid, and every cell is `aria-describedby` its two rails.** `group`
   permits author naming, so the label is exposed as the rail's own name
   *and* as each cell's description. The label is composed in the message
   module, never from subtree text
   ([ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md): copy is
   not composed in a component), which is also what stops `2 2 2 2 3` from
   being announced as `"22223"`. **There is no `<div>` carrying only
   `aria-label` anywhere on this board.**

4. **The key table extends ADR-0030 decision 3 with `1` / `2` / `0` and
   with `PageUp` / `PageDown`.** `1` fills, `2` crosses, `0`/`Backspace`/
   `Delete` clear, and re-entering the same value clears it. `PageUp`/
   `PageDown` go to the first/last row of the current column; they are an
   **addition**, and the permission was checked rather than assumed —
   ADR-0030 contains no prohibition on them, and its consequence (a)
   explicitly says a new game owes its own table. A 15-row board's
   vertical traversal is 14 presses against Sudoku's 8, which is what they
   answer. Everything else in ADR-0030's contract is inherited verbatim,
   including arrow keys clamping at the edges rather than wrapping.

5. **There is no per-cell violation state and therefore no error colour on
   this board.** Nonogram has no cheap local rule to break: the only
   per-cell check available is *against the solution*, and rendering it
   would be a per-cell oracle handing the player the picture one wrong
   move at a time — the same thing
   [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md)
   decision 5 forbids for the progress meter. A Nonogram's feedback is the
   clue rails and the one free hint. **ADR-0030 decision 4 is also vacuous
   here:** a nonogram has no givens, so there is no `aria-disabled` and no
   inert cell anywhere on the board.

## Rejected

- **A `cycle` brush default, copied from Binairo.** It ships the game's
  primary gesture dead: `binairo/state.ts`'s `paint-over` case ignores that
  action entirely in cycle mode, so a drag would do nothing at all on first
  paint. Binairo's cycle is correct *for Binairo*, whose drag is
  secondary.
- **`role="radiogroup"` with three `role="radio"` controls.**
  Semantically closer to "exactly one of three", and rejected because
  radio semantics bring their own keyboard contract — arrows move between
  radios, the group is one tab stop — which would be a **third** keyboard
  model on a screen that already has the board's composite widget and the
  ordinary chrome. Binairo's shipped `aria-pressed` toggle row is the
  precedent, and consistency across two paint boards beats a marginally
  better role.
- **Sudoku-style commands acting on the selected cell, with no modes.**
  They leave the stroke unarmed — a drag would still have no value to
  write — so the screen would need sticky state anyway and would then have
  two input vocabularies instead of one.
- **A second focus mechanism for the pointer path** (a container-level
  click handler resolving the cell, say) instead of `onStrokeEnd`. It
  duplicates what the hook already knows at `pointerup` and gives the
  board two ways to move the caret that can disagree.
- **Carrying the clues in each cell's `aria-label`.** 225 labels each
  restating two run lists, rebuilt on every entry change, and unreadable
  while arrowing across a row.
- **No clue association at all.** The board would be navigable and
  unsolvable.
- **A role-less `<div>` with `aria-label` for the rails.** The cheap
  version of decision 3, and it is not reliably exposed — the defect class
  already latent in Binairo's board.
- **A per-cell "this is wrong" state, in any colour.** A per-cell solution
  oracle, whatever it is called.

## Consequences

- **(a) The pointer-stroke hook has two consumers from the day it
  exists**, which is the condition ADR-0029 (c) set for extracting it. Its
  genericity is bounded by that: five container handlers, a
  `consumedClick` predicate that never suppresses keyboard activation
  (`detail === 0`), and the optional `onStrokeEnd`. Nothing game-specific
  goes in.
- **(b) The Binairo retrofit that ADR-0030 (b) says is owed now has a
  named mechanism to use.** Its pointer path must adopt `onStrokeEnd`
  rather than re-derive a second fix — that instruction is decision 2's,
  and the retrofit issue, **#61**, carries it — because the cell's own `onClick`
  focus fix is unreachable under pointer capture and jsdom cannot show it.
- **(c) The board's accessible surface is verbose, and that is
  accepted.** A cell announces its own name and then two rail
  descriptions. Descriptions are the ARIA slot screen readers most
  commonly let users suppress, and a nonogram is unsolvable without both
  lines, so the trade goes this way rather than the other.
- **(d) That `aria-describedby` → `role="group"` + `aria-label` is
  announced as intended is not provable in jsdom.** The markup is
  assertable; the announcement is not. One real screen-reader pass is owed
  and its result recorded — this ADR does not claim it has happened.
- **(e) The `--accent-app` collision on this board is retired by being
  unreachable.** Sealing-wax red against nonogram terracotta computes
  **1.40:1**, so an error state in the app accent would have been
  invisible on exactly the cells that carry the picture. Decision 5 means
  no such state exists, which closes the collision rather than papering
  over it — but only for this board, and only for as long as decision 5
  holds.
- **(f) #28's free play inherits the whole input model.** Same brush, same
  strokes, same key table, same rails; free play differs in where the
  puzzle comes from and in writing no completion, not in how it is played.
- **(g) The stroke machinery's real behaviour is only partly testable
  here.** jsdom implements neither pointer capture nor click retargeting,
  so the extraction's safety rests on the Binairo suite passing unchanged
  and the capture path is confirmed in a real browser. Both are stated so
  neither is credited to the other.
