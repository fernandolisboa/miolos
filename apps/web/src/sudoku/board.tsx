import type { SudokuGrid } from "@miolos/games/sudoku";
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { messages } from "../i18n";
import { track } from "./engine";
import type { SudokuCellValue, SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";

const SIDE = 9;

/** The engine's empty-cell sentinel, as `givens` carries it (S6). */
const EMPTY = 0;

/**
 * A full-width clamped move: `Home` and `End` are `move-selection` with
 * ∓8 columns, because a clamped move that wide lands on the row's first or
 * last column by construction (§8.4) — no action of their own.
 */
const ROW_SPAN = SIDE - 1;

/**
 * The 9×9 board (plan 018 §12.3, §12.5). A COMPOSITE WIDGET (ADR-0030): a
 * labelled `role="group"`, all 81 cells are `<button type="button">`, and
 * exactly one carries `tabindex="0"` — so the board is one tab stop on the
 * page rather than 81, and the caret moves with the arrow keys.
 *
 * NOT `role="grid"`, and the reason is structural rather than stylistic: a
 * grid needs `role="row"` children owning the cells, and this is one flat
 * 81-item CSS grid with explicit gutter tracks. Row wrappers would need
 * `display: contents`, which is the canonical
 * removed-from-the-accessibility-tree bug — a silently wrong `role="grid"`
 * is worse than an honest `role="group"` (ADR-0030 rejected list).
 *
 * Givens are focusable and carry `aria-disabled="true"` rather than
 * `disabled`: a disabled button is unreachable, and a caret that skips
 * givens jumps unpredictably across a boxed grid.
 */
export function Board({
  givens,
  entries,
  selected,
  violating,
  hintIndex,
  onSelect,
  onMove,
  onDigit,
  onClear,
}: {
  readonly givens: SudokuGrid;
  readonly entries: readonly SudokuCellValue[];
  /** The selection AND the roving-focus caret — one concept (ADR-0030). */
  readonly selected: number | null;
  readonly violating: ReadonlySet<number>;
  readonly hintIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onDigit: (digit: SudokuDigit) => void;
  readonly onClear: () => void;
}) {
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
    // ONLY when focus is already inside the board (ADR-0030 decision 5):
    // the hint button lives in the sidebar and its press changes nothing
    // here, but a `use-hint` that ever moved the selection — or a future
    // control that does — must not yank focus out of what the player is
    // using. `document.activeElement` is null in a detached document, which
    // `contains(null)` answers false to.
    if (!board.contains(document.activeElement)) {
      return;
    }
    board
      .querySelector<HTMLButtonElement>(`[data-cell-index="${selected}"]`)
      ?.focus();
  }, [selected]);

  /**
   * One listener for 81 cells (ADR-0030 decision 3). Every key it handles is
   * prevented: the arrows and Home/End would scroll the page under the
   * caret, and Backspace is a history-back gesture in some browsers.
   */
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const move = MOVES[event.key];
    if (move !== undefined) {
      event.preventDefault();
      onMove(move[0], move[1]);
      return;
    }
    const digit = asDigit(event.key);
    if (digit !== null) {
      event.preventDefault();
      onDigit(digit);
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
      className={styles.grid}
      role="group"
      aria-label={messages.games.sudoku.play.boardAria}
      onKeyDown={onKeyDown}
    >
      {/* The 3×3 structure, drawn rather than inferred from spacing (§12.3).
          Decoration with nothing to announce: the box a cell belongs to is
          not something a screen reader can act on, and the composed cell
          name already carries the row and the column. */}
      <div aria-hidden className={`${styles.rule} ${styles.ruleColumnFirst}`} />
      <div
        aria-hidden
        className={`${styles.rule} ${styles.ruleColumnSecond}`}
      />
      <div aria-hidden className={`${styles.rule} ${styles.ruleRowFirst}`} />
      <div aria-hidden className={`${styles.rule} ${styles.ruleRowSecond}`} />

      {givens.map((given, index) => {
        const row = Math.floor(index / SIDE);
        const column = index % SIDE;
        const value = given !== EMPTY ? given : (entries[index] ?? null);
        const invalid = violating.has(index);
        return (
          <button
            key={index}
            type="button"
            className={cellClassName({
              given: given !== EMPTY,
              entered: given === EMPTY && value !== null,
              hinted: hintIndex === index,
              invalid,
              selected: selected === index,
            })}
            style={cellPlacement(row, column)}
            data-cell-index={index}
            tabIndex={tabbable === index ? 0 : -1}
            // A given is inert on activation but still reachable, so the
            // caret can cross it (ADR-0030 decision 4).
            aria-disabled={given !== EMPTY}
            // The WHOLE accessible name comes from messages.ts, separator
            // included: it is user-facing copy, and a component is not where
            // copy is composed (ADR-0018). The violation rides in the name
            // rather than in `aria-invalid`, which ARIA does not support on
            // role=button and `jsx-a11y/role-supports-aria-props` reds.
            aria-label={cellAria(row + 1, column + 1, given, value, invalid)}
            // FOCUS IS THE ONLY WRITER OF THE SELECTION (ADR-0030 decision
            // 5, finding `sudoku-tab-into-board-shows-a-caret-that-cannot-write`).
            // A Tab into the board lands on the roving tab stop, which
            // before any interaction is cell 0 while `selected` is still
            // null: the accent caret is painted there by `:focus-visible`,
            // yet every writing key is swallowed by `preventDefault` and
            // then dropped by the reducer's null-selection guard. Focus
            // selecting closes that gap at the source.
            //
            // It cannot loop with the layout effect above: the effect only
            // ever focuses `selected`, and re-selecting the index already
            // selected returns the SAME state object (state.ts `select`),
            // which `useReducer` bails out of.
            onFocus={() => onSelect(index)}
            // A pointer press is unambiguously a request to put the caret
            // here — but WebKit does not focus a `<button>` on click, so on
            // Safari (macOS, iOS, iPadOS) `document.activeElement` stays
            // `<body>`, the effect above returns at its guard, and the
            // board's single keydown listener never sees a key again
            // (finding `pointer-selection-does-not-focus-the-board-on-webkit`).
            // Focusing from the click routes the pointer through the same
            // door as the keyboard: this fires `onFocus`, which selects.
            onClick={(event) => {
              event.currentTarget.focus();
            }}
          >
            {value}
          </button>
        );
      })}
    </div>
  );
}

/**
 * The placeholder board (§12.2). It reuses `.grid`, `.cell` and the same
 * explicit placement, so its size comes from the shipped rules rather than
 * from a copied number — and `aria-hidden` divs rather than buttons, because
 * a focusable control with no handler behind it is worse than none.
 */
export function BoardSkeleton() {
  return (
    <div aria-hidden className={styles.grid}>
      <div className={`${styles.rule} ${styles.ruleColumnFirst}`} />
      <div className={`${styles.rule} ${styles.ruleColumnSecond}`} />
      <div className={`${styles.rule} ${styles.ruleRowFirst}`} />
      <div className={`${styles.rule} ${styles.ruleRowSecond}`} />
      {Array.from({ length: SIDE * SIDE }, (_unused, index) => (
        <div
          key={index}
          className={`${styles.cell} ${styles.cellSkeleton}`}
          style={cellPlacement(Math.floor(index / SIDE), index % SIDE)}
        />
      ))}
    </div>
  );
}

/**
 * Explicit grid placement, skipping the two 2px gutter tracks. Auto-placement
 * is not an option: it would drop nine cells into the gutters, and the same
 * template serves both viewports, so this is correct at every width (§12.3).
 */
function cellPlacement(
  row: number,
  column: number,
): { readonly gridColumn: number; readonly gridRow: number } {
  return { gridColumn: track(column), gridRow: track(row) };
}

/**
 * ONE chromatic class, optionally joined with the caret — not one class total
 * (§12.5, ADR-0030 (d)). Precedence
 * `violating > hint-filled > entered > given > empty`; the caret is an
 * outline, so it composes with every one of them instead of replacing it.
 */
function cellClassName(state: {
  readonly given: boolean;
  readonly entered: boolean;
  readonly hinted: boolean;
  readonly invalid: boolean;
  readonly selected: boolean;
}): string {
  const chromatic = state.invalid
    ? ` ${styles.cellViolating}`
    : state.hinted
      ? ` ${styles.cellHinted}`
      : state.entered
        ? ` ${styles.cellEntered}`
        : state.given
          ? ` ${styles.cellGiven}`
          : "";
  return `${styles.cell}${chromatic}${state.selected ? ` ${styles.cellSelected}` : ""}`;
}

/** The composed accessible name for one cell — all three cases (§13.2). */
function cellAria(
  row: number,
  column: number,
  given: number | undefined,
  value: number | null,
  invalid: boolean,
): string {
  const copy = messages.games.sudoku.play;
  if (invalid) {
    return copy.cellInvalidAria(row, column, value);
  }
  if (given !== undefined && given !== EMPTY) {
    return copy.cellGivenAria(row, column, given);
  }
  return copy.cellAria(row, column, value);
}

/** `[rows, columns]` per navigation key (§8.4). Clamping is the reducer's. */
const MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  Home: [0, -ROW_SPAN],
  End: [0, ROW_SPAN],
};

/**
 * A writing key, narrowed to a digit. The switch is the proof: an
 * `as SudokuDigit` would assert exactly what this checks, and `"0"` is
 * deliberately absent — it is a clear, not a write.
 */
function asDigit(key: string): SudokuDigit | null {
  switch (key) {
    case "1":
      return 1;
    case "2":
      return 2;
    case "3":
      return 3;
    case "4":
      return 4;
    case "5":
      return 5;
    case "6":
      return 6;
    case "7":
      return 7;
    case "8":
      return 8;
    case "9":
      return 9;
    default:
      return null;
  }
}
