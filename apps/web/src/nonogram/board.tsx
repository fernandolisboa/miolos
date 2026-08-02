import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import {
  Fragment,
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { messages } from "../i18n";
import { usePointerStroke } from "../play/use-pointer-stroke";
import styles from "./nonogram-board.module.css";
import type { NonogramCellValue, NonogramMark } from "./state";

/**
 * The heavy rule repeats every five cells, which also produces the TOP and
 * LEFT frame edges: `index % GROUP === 0` covers 0 (the frame) and 5/10 (the
 * groups), so a 5×5 board gets those two frame edges and no interior rule,
 * which is correct.
 *
 * The modulo cannot draw the other two on ANY legal size: no member of
 * `NonogramSize` has `size - 1` divisible by 5 (4, 7, 9, 14), the 5×5 board
 * included. The right and bottom frame edges are therefore two further
 * per-cell borders at `column === size - 1` and `row === size - 1`, drawn
 * unconditionally — see `ruleClasses` below (ADR-0035 decision 2, as
 * amended).
 */
const GROUP = 5;

/**
 * An all-empty line's clue is `[]` and the rail renders a single `0` — the
 * engine's own contract (`nonogram/types.ts:10`). This is engine data, not
 * copy: the sentence AROUND the numbers is composed in `messages.ts`, whose
 * `runsText` renders the same `0` for the same line, and T-WEB-S43 pins the
 * two together.
 */
const EMPTY_LINE: readonly number[] = [0];

/**
 * The four literal templates §12.4 ships, one per weekday class. `satisfies`
 * rather than an annotation: it proves the map is exhaustive over
 * `NonogramSize` — a fifth size would not compile — while keeping the CSS
 * module's own `string | undefined` value type, which `noUncheckedIndexedAccess`
 * gives every class lookup in this repo.
 */
const SIZE_CLASS = {
  5: styles.size5,
  8: styles.size8,
  10: styles.size10,
  15: styles.size15,
} satisfies Record<NonogramSize, string | undefined>;

/**
 * The variable-size board (plan 020 §11, §12). A COMPOSITE WIDGET (ADR-0030,
 * ADR-0037): a labelled `role="group"`, every cell a `<button type="button">`,
 * and exactly one carrying `tabindex="0"` — so the board is one tab stop on
 * the page rather than 225, and the caret moves with the arrow keys.
 *
 * NOT `role="grid"`, and the argument is STRONGER here than for Sudoku: a grid
 * needs `role="row"` children owning the cells, and this is one flat CSS grid
 * that also contains the clue rails. A per-row wrapper would either exclude
 * that row's rail — breaking the visual row — or include it, producing a
 * `gridcell` that is not a cell; and it would need `display: contents`, the
 * canonical removed-from-the-accessibility-tree bug. There is no arrangement
 * in which `role="grid"` is honest here (§11.1).
 *
 * There are no givens: a nonogram has no immutable cells, so ADR-0030 decision
 * 4 is vacuous — no `aria-disabled` anywhere on this board. And there is no
 * violation state, deliberately: a Nonogram has no local rule, so the only
 * cheap per-cell check is against the solution, and rendering that is a
 * per-cell oracle (§10.3).
 *
 * MEMOIZED, and at 225 cells that is not a micro-optimisation: `state.now`
 * moves once a second for the two timer readouts, and without this every tick
 * reconciles 225 `<button>`s, 30 clue rails and 225 composed aria strings that
 * cannot have changed — measured at ~2.5 ms per tick on a 15×15, on the
 * interaction-latency path.
 *
 * WHAT IT DOES NOT BUY ON ITS OWN: the drag. `paint-over` allocates a new
 * `entries` array, `entries` is shallow-compared, so a stroke re-enters this
 * function once per painted cell by construction — measured at 41 board
 * renders for a 40-cell drag, 0 for ten timer ticks. Saying the memo is "paid
 * again per cell crossed during a drag" had it backwards. That is what `Cell`
 * below is for: the per-cell component takes primitives and two stable
 * callbacks, so one painted cell reconciles ONE `<button>` and composes ONE
 * aria string instead of 225. Measured 2.1x on a 15×15 at 80 single-cell
 * paints, and the composition count collapses from 225×N to N.
 *
 * This paragraph used to say that memo "needs `consumedClick` to be
 * identity-stable — i.e. a change to the shared `usePointerStroke` that
 * Binairo also consumes". That was FALSE and it is corrected rather than
 * softened (step-6 round-3 finding PERF-R3-1): `consumedClick` closes over
 * nothing but two `useRef` objects and the event's `detail`, so an
 * effect-synced ref inside THIS file makes the click wrapper stable and exact,
 * permanently, without touching the shared hook or Binairo. `T-WEB-S66` pins
 * the result — 225 × N aria compositions for an N-cell drag became N, proved
 * red at 1800 with the per-cell memo removed — so **#66**'s Scope 1 is
 * discharged here and its `usePointerStroke` justification must not be acted
 * on: there is no reason left to change a shipped game's shared hook for it.
 *
 * The default shallow compare is exactly right here: `size` and `clues` never change
 * identity for a mounted screen (`initNonogramPlayState` takes `clues` from
 * the wire and every reducer case spreads `...state`), all six callbacks are
 * `useCallback([])` in `use-nonogram-play.ts`, and the three props that do
 * move — `entries`, `selected`, `hintIndex` — are exactly when the board must
 * re-render. Adding a prop that is rebuilt per render silently undoes this.
 */
export const Board = memo(function Board({
  size,
  clues,
  entries,
  selected,
  hintIndex,
  onSelect,
  onMove,
  onMarkCell,
  onEnterValue,
  onClear,
  onPaintOver,
}: {
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly entries: readonly NonogramCellValue[];
  /** The selection AND the roving-focus caret — one concept (ADR-0030). */
  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  /** A tap or Enter/Space: applies the brush, re-applying it clears. */
  readonly onMarkCell: (index: number) => void;
  /** A keyboard write of a specific value, whatever the brush is. */
  readonly onEnterValue: (value: NonogramMark) => void;
  readonly onClear: () => void;
  /** A drag: an idempotent SET of the brush's value. */
  readonly onPaintOver: (index: number) => void;
}) {
  const copy = messages.games.nonogram.play;
  const boardRef = useRef<HTMLDivElement>(null);

  // The roving tab stop: the selected cell, or the first one when the caret
  // has not appeared yet. Exactly one cell is ever tabbable — and the moment
  // that cell receives focus it BECOMES the selection (`onFocus` below), so
  // the tab stop and the reducer's `selected` never disagree once the player
  // has arrived.
  const tabbable = selected ?? 0;

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (board === null || selected === null) {
      return;
    }
    // ONLY when focus is already inside the board (ADR-0030 decision 5): the
    // hint button lives in the sidebar and its press changes nothing here, but
    // a `use-hint` that ever moved the selection — or a future control that
    // does — must not yank focus out of what the player is using.
    if (!board.contains(document.activeElement)) {
      return;
    }
    focusCell(board, selected);
  }, [selected]);

  /**
   * This board drags, and `painting` is unconditionally true: unlike Binairo
   * there is no cycle mode to disarm the stroke (P21/N28 — a cycle drag is a
   * no-op, and here the drag is the primary gesture).
   *
   * `onStrokeEnd` is the focus door pointer capture leaves open: the browser
   * retargets the trailing `click` to the CONTAINER, so the cell's own
   * `onClick` focus fix never runs during a stroke and the caret would be left
   * wherever it was. The hook hands back the cell the pointer lifted on, this
   * focuses it, and `onFocus` selects it — both doors, one destination.
   */
  const stroke = usePointerStroke({
    painting: true,
    onTap: onMarkCell,
    onPaintOver,
    onStrokeEnd: (index) => {
      const board = boardRef.current;
      if (board !== null) {
        focusCell(board, index);
      }
    },
  });

  /**
   * `stroke.consumedClick` is a fresh arrow on every render, so passing it
   * down would rebuild `onCellClick` per render and defeat `Cell`'s memo — the
   * whole point of the extraction. A ref synced each commit is the same
   * pattern `use-nonogram-play.ts` uses for `stateRef`, and it is EXACT rather
   * than approximate here: `consumedClick` closes over `dragged` and `tapped`,
   * two `useRef` objects whose identity never changes, plus the event's own
   * `detail` — so every version of it behaves identically and no state can go
   * stale behind the ref. An effect rather than a render-phase assignment
   * because a discarded render must not write; a click can only fire from
   * committed DOM, so the effect has always run by then.
   *
   * If `consumedClick` ever closes over STATE, this ref becomes a stale-read
   * bug and the wrapper has to change with it.
   */
  const consumedClickRef = useRef(stroke.consumedClick);
  useEffect(() => {
    consumedClickRef.current = stroke.consumedClick;
  });

  const onCellFocus = useCallback(
    (index: number) => {
      onSelect(index);
    },
    [onSelect],
  );

  const onCellClick = useCallback(
    (index: number, event: ReactMouseEvent<HTMLButtonElement>) => {
      // WebKit does not focus a `<button>` on click, so on Safari
      // `document.activeElement` would stay `<body>`, the roving effect would
      // return at its guard and no key would reach the board again (finding
      // `pointer-selection-does-not-focus-the-board-on-webkit`). Under real
      // pointer capture this handler never runs for pointer input — the click
      // is retargeted to the container — so this is reached only when capture
      // FAILED; the pointer path's focus comes from `onStrokeEnd` above.
      event.currentTarget.focus();
      if (consumedClickRef.current(event)) {
        // The stroke already wrote this cell; a trailing click would re-apply
        // the brush and clear it again.
        return;
      }
      // Keyboard activation (`detail === 0`) always lands here.
      onMarkCell(index);
    },
    [onMarkCell],
  );

  /**
   * One listener for every cell (ADR-0030 decision 3). Every key it handles is
   * prevented: the arrows, Home/End and PageUp/PageDown would scroll the page
   * under the caret, and Backspace is a history-back gesture in some browsers.
   *
   * PageUp/PageDown are this board's own addition (ADR-0037 decision 4):
   * ADR-0030 contains no prohibition, its consequence (a) says a new game owes
   * its own key table, and a 15-row board's vertical traversal is 14 presses
   * against Sudoku's 8.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = moveFor(event.key, size);
    if (move !== null) {
      event.preventDefault();
      onMove(move[0], move[1]);
      return;
    }
    const mark = asMark(event.key);
    if (mark !== null) {
      event.preventDefault();
      onEnterValue(mark);
      return;
    }
    if (
      event.key === "0" ||
      event.key === "Backspace" ||
      event.key === "Delete"
    ) {
      event.preventDefault();
      onClear();
    }
  };

  return (
    <div
      ref={boardRef}
      className={`${styles.grid} ${SIZE_CLASS[size]}`}
      role="group"
      aria-label={copy.boardAria(size)}
      onKeyDown={onKeyDown}
      {...stroke.handlers}
    >
      {clues.cols.map((runs, column) => (
        <div
          key={column}
          id={columnRailId(column)}
          // `role="group"` is required, not cosmetic: `aria-label` on a
          // role-less <div> is not reliably exposed, which is Binairo's
          // undocumented defect (N16). `group` permits author naming, so the
          // label is exposed both as the rail's own name and, through
          // `aria-describedby`, as each cell's description. Subtree text would
          // announce "22223" for runs `2 2 2 2 3`, which is why the label is
          // composed in messages.ts (ADR-0018).
          role="group"
          aria-label={copy.columnCluesAria(column + 1, runs)}
          className={styles.clueCol}
          style={{ gridColumn: column + 2, gridRow: 1 }}
        >
          {/* NAMING THE RAIL IS NOT PRUNING ITS SUBTREE — the half the
              comment above does not buy on its own. Each numeral would stay
              its own `StaticText` node and its own virtual-cursor stop, so a
              screen-reader user browsing the board linearly hears every run
              twice: once through the composed rail label (and again through
              every cell's `aria-describedby`), then once more as naked digits
              with nothing saying which line they belong to — 90 extra stops
              on a size-15 day (finding `clue-rails-announce-every-run-twice`).
              `aria-hidden` on the numerals stops that; the rail keeps its
              name, because an `aria-hidden` element referenced by
              `aria-describedby` still contributes its own accessible name.
              The skeleton's rails carry none of this: its whole subtree is
              already inside one `aria-hidden` div. */}
          {numbersOf(runs).map((run, at) => (
            <span aria-hidden key={at} className={styles.clueNumber}>
              {run}
            </span>
          ))}
        </div>
      ))}

      {clues.rows.map((runs, row) => (
        <Fragment key={row}>
          <div
            id={rowRailId(row)}
            role="group"
            aria-label={copy.rowCluesAria(row + 1, runs)}
            className={styles.clueRow}
            style={{ gridColumn: 1, gridRow: row + 2 }}
          >
            {/* `aria-hidden` for the reason spelled out on the column rail
                above: the composed label is the rail's voice, and the numerals
                under it would be read a second time as bare digits. */}
            {numbersOf(runs).map((run, at) => (
              <span aria-hidden key={at} className={styles.clueNumber}>
                {run}
              </span>
            ))}
          </div>
          {Array.from({ length: size }, (_unused, column) => {
            const index = row * size + column;
            return (
              <Cell
                key={index}
                index={index}
                row={row}
                column={column}
                size={size}
                value={entries[index] ?? null}
                hinted={hintIndex === index}
                selected={selected === index}
                tabbable={tabbable === index}
                onCellFocus={onCellFocus}
                onCellClick={onCellClick}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
});

/**
 * ONE cell, memoized — the half of the drag cost `Board`'s own memo cannot
 * reach (see its TSDoc). A `paint-over` allocates a new `entries` array, so
 * `Board` re-renders in full on every painted cell; with this, the cells whose
 * `value`, `hinted`, `selected` and `tabbable` did not move bail out, and one
 * painted cell composes ONE aria string instead of `size²`. On a 15×15 that is
 * 225 → 1 per pointer move, measured at 2.1x on the commit itself.
 *
 * EVERY PROP IS A PRIMITIVE OR A STABLE CALLBACK, and that is the whole
 * contract: the two handlers come from `useCallback` in `Board` over the
 * `useCallback([])` handlers `use-nonogram-play.ts` hands down, and
 * `consumedClick` is reached through a ref rather than passed. Adding a prop
 * that is rebuilt per render (an object, an array, an inline arrow) silently
 * undoes all of it — the same warning `Board`'s own TSDoc carries, one level
 * down.
 *
 * `rowRailId`/`columnRailId` and `cellClassName` are recomputed here rather
 * than passed as strings: they are pure functions of props this component
 * already has, and passing a composed string would move the composition back
 * into `Board`'s render, which is exactly what this exists to avoid.
 */
const Cell = memo(function Cell({
  index,
  row,
  column,
  size,
  value,
  hinted,
  selected,
  tabbable,
  onCellFocus,
  onCellClick,
}: {
  readonly index: number;
  readonly row: number;
  readonly column: number;
  readonly size: NonogramSize;
  readonly value: NonogramCellValue;
  readonly hinted: boolean;
  /** The selection AND the roving-focus caret — one concept (ADR-0030). */
  readonly selected: boolean;
  /** True on the single cell carrying `tabindex="0"`. */
  readonly tabbable: boolean;
  readonly onCellFocus: (index: number) => void;
  readonly onCellClick: (
    index: number,
    event: ReactMouseEvent<HTMLButtonElement>,
  ) => void;
}) {
  const copy = messages.games.nonogram.play;
  return (
    <button
      type="button"
      className={cellClassName({ row, column, size, value, hinted, selected })}
      style={{ gridColumn: column + 2, gridRow: row + 2 }}
      data-cell-index={index}
      tabIndex={tabbable ? 0 : -1}
      // The WHOLE accessible name comes from messages.ts, separator included:
      // it is user-facing copy, and a component is not where copy is composed
      // (ADR-0018).
      aria-label={copy.cellAria(row + 1, column + 1, value)}
      // Both rails, so a nonogram is solvable by a screen reader at all. The
      // description is verbose on purpose — carrying the clues in each cell's
      // NAME would restate two run lists 225 times and rebuild them on every
      // entry change, and no clue association would leave the board navigable
      // and unsolvable.
      aria-describedby={`${rowRailId(row)} ${columnRailId(column)}`}
      // FOCUS IS THE ONLY WRITER OF THE SELECTION (ADR-0030 decision 5): a Tab
      // into the board lands on the roving tab stop, which before any
      // interaction is cell 0 while `selected` is still null — so without this
      // the caret `:focus-visible` paints could not write.
      //
      // It cannot loop with `Board`'s layout effect: that effect only ever
      // focuses `selected`, and re-selecting the index already selected
      // returns the SAME state object, which `useReducer` bails out of.
      onFocus={() => onCellFocus(index)}
      onClick={(event) => onCellClick(index, event)}
    />
  );
});

/**
 * The placeholder board (§12.2's precedent). It reuses `.grid`, the size
 * template, the rails and `.cell`, so its size comes from the shipped rules
 * rather than from a copied number — and `aria-hidden` divs rather than
 * buttons, because a focusable control with no handler behind it is worse than
 * none. It carries no `data-cell-index` and no ids: nothing here is a target.
 *
 * The rails render their real numbers because the clues arrive on the WIRE,
 * not from the record — and the gutter tracks are `max-content`, so an empty
 * rail would reserve the wrong width and the board would jump on hydration.
 */
export function BoardSkeleton({
  size,
  clues,
}: {
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
}) {
  return (
    <div aria-hidden className={`${styles.grid} ${SIZE_CLASS[size]}`}>
      {clues.cols.map((runs, column) => (
        <div
          key={column}
          className={styles.clueCol}
          style={{ gridColumn: column + 2, gridRow: 1 }}
        >
          {numbersOf(runs).map((run, at) => (
            <span key={at} className={styles.clueNumber}>
              {run}
            </span>
          ))}
        </div>
      ))}
      {clues.rows.map((runs, row) => (
        <Fragment key={row}>
          <div
            className={styles.clueRow}
            style={{ gridColumn: 1, gridRow: row + 2 }}
          >
            {numbersOf(runs).map((run, at) => (
              <span key={at} className={styles.clueNumber}>
                {run}
              </span>
            ))}
          </div>
          {Array.from({ length: size }, (_unused, column) => (
            <div
              key={row * size + column}
              className={`${styles.cell} ${ruleClasses(row, column, size)} ${styles.cellSkeleton}`}
              style={{ gridColumn: column + 2, gridRow: row + 2 }}
            />
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/** The rail ids each cell's `aria-describedby` points at. */
function rowRailId(row: number): string {
  return `nonogram-clue-row-${row}`;
}

function columnRailId(column: number): string {
  return `nonogram-clue-col-${column}`;
}

function focusCell(board: HTMLDivElement, index: number): void {
  board
    .querySelector<HTMLButtonElement>(`[data-cell-index="${index}"]`)
    ?.focus();
}

/** The rail's numbers, with the engine's `[]` → `0` contract applied. */
function numbersOf(runs: readonly number[]): readonly number[] {
  return runs.length === 0 ? EMPTY_LINE : runs;
}

/**
 * The ruled field, as classes rather than as a comment: the frame and the
 * every-five rule are per-cell borders, because a wrapper element would be
 * *card dentro de card* verbatim (ADR-0035). Pinned by assertion C1.
 */
function ruleClasses(row: number, column: number, size: number): string {
  return [
    row % GROUP === 0 ? styles.cellRuleTop : "",
    column % GROUP === 0 ? styles.cellRuleLeft : "",
    column === size - 1 ? styles.cellEdgeRight : "",
    row === size - 1 ? styles.cellEdgeBottom : "",
  ]
    .filter((rule) => rule !== "")
    .join(" ");
}

/**
 * ONE chromatic class, optionally joined with the hint ring and the caret —
 * not one class total (ADR-0030 decision 6). The ring is an inset shadow and
 * the caret an outline, so both compose with the fill instead of replacing it:
 * a hinted cell keeps saying whether it is filled or crossed.
 */
function cellClassName(state: {
  readonly row: number;
  readonly column: number;
  readonly size: number;
  readonly value: NonogramCellValue;
  readonly hinted: boolean;
  readonly selected: boolean;
}): string {
  const chromatic =
    state.value === 1
      ? styles.cellFilled
      : state.value === 0
        ? styles.cellCrossed
        : "";
  return [
    styles.cell,
    ruleClasses(state.row, state.column, state.size),
    chromatic,
    state.hinted ? styles.cellHinted : "",
    state.selected ? styles.cellSelected : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
}

/**
 * `[rows, columns]` per navigation key (§11.3). Clamping is the reducer's.
 *
 * It cannot be a module constant the way Sudoku's `MOVES` is: the full-width
 * and full-height spans are `size − 1`, and this board is 5, 8, 10 or 15 a
 * side depending on the weekday.
 */
function moveFor(key: string, size: number): readonly [number, number] | null {
  const span = size - 1;
  switch (key) {
    case "ArrowUp":
      return [-1, 0];
    case "ArrowDown":
      return [1, 0];
    case "ArrowLeft":
      return [0, -1];
    case "ArrowRight":
      return [0, 1];
    case "Home":
      return [0, -span];
    case "End":
      return [0, span];
    case "PageUp":
      return [-span, 0];
    case "PageDown":
      return [span, 0];
    default:
      return null;
  }
}

/**
 * A writing key, narrowed to a mark. The switch is the proof: an
 * `as NonogramMark` would assert exactly what this checks. `1` preenche and
 * `2` marca — `2` rather than `0` because `0` is the clear, exactly as it is
 * on the Sudoku board, and because the mark's own value is `0` (P11).
 */
function asMark(key: string): NonogramMark | null {
  switch (key) {
    case "1":
      return 1;
    case "2":
      return 0;
    default:
      return null;
  }
}
