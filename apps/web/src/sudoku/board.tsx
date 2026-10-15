import type { SudokuGrid } from "@miolos/games/sudoku";
import { useLayoutEffect, useMemo, useRef, type KeyboardEvent } from "react";

import { messages } from "../i18n";
import { isShortcut, keyMove } from "../play/grid-selection";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import { useSettings } from "../settings/settings";
import {
  DIGITS,
  mergedGrid,
  playableGivens,
  selectionHighlights,
  spotlightHighlights,
  track,
  type CellHighlight,
} from "./engine";
import { noteDigits } from "./notes";
import type { SudokuCellValue, SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";

const SIDE = 9;

const EMPTY = 0;

const NO_HIGHLIGHTS: ReadonlyMap<number, CellHighlight> = new Map();

export function Board({
  givens,
  solution,
  entries,
  notes,
  selected,
  violating,
  hintIndex,
  spotlight,
  onSelect,
  onMove,
  onDigit,
  onNote,
  onToggleNoting,
  onClear,
  onTapCell,
}: {
  readonly givens: SudokuGrid;
  readonly solution: readonly SudokuDigit[] | null;
  readonly entries: readonly SudokuCellValue[];
  readonly notes: readonly number[];

  readonly selected: number | null;
  readonly violating: ReadonlySet<number>;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onDigit: (digit: SudokuDigit) => void;
  readonly onNote: (digit: SudokuDigit) => void;
  readonly onToggleNoting: () => void;
  readonly onClear: () => void;
  readonly onTapCell: (index: number) => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);

  const tabbable = selected ?? 0;
  const { highlightSelection } = useSettings().games.sudoku;
  const playable = useMemo(() => playableGivens(givens), [givens]);
  const wrong = useWrongCells("sudoku", solution, playable, entries);
  const highlights =
    spotlight.length > 0
      ? spotlightHighlights(spotlight)
      : highlightSelection
        ? selectionHighlights(mergedGrid(givens, entries), selected)
        : NO_HIGHLIGHTS;

  useLayoutEffect(() => {
    const board = boardRef.current;
    if (board === null || selected === null) {
      return;
    }

    if (!board.contains(document.activeElement)) {
      return;
    }
    board
      .querySelector<HTMLButtonElement>(`[data-cell-index="${selected}"]`)
      ?.focus();
  }, [selected]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (isShortcut(event)) {
      return;
    }
    const move = keyMove(event.key, SIDE);
    if (move !== null) {
      event.preventDefault();
      onMove(move.rows, move.columns);
      return;
    }
    if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      onToggleNoting();
      return;
    }
    const noted = event.shiftKey ? asDigit(codeDigit(event.code)) : null;
    if (noted !== null) {
      event.preventDefault();
      onNote(noted);
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
        const isWrong = wrong.has(index);
        const cellNotes = noteDigits(notes[index] ?? 0);
        return (
          <button
            key={index}
            type="button"
            className={cellClassName({
              given: given !== EMPTY,
              entered: given === EMPTY && value !== null,
              hinted: hintIndex === index,
              invalid,
              highlight: highlights.get(index) ?? null,
              selected: selected === index,
            })}
            style={cellPlacement(row, column)}
            data-cell-index={index}
            tabIndex={tabbable === index ? 0 : -1}

            aria-disabled={given !== EMPTY}

            aria-label={cellAria(
              row + 1,
              column + 1,
              given,
              value,
              invalid,
              isWrong,
              cellNotes,
            )}

            onFocus={() => onSelect(index)}

            onClick={(event) => {
              event.currentTarget.focus();
              if (event.detail > 0) {
                onTapCell(index);
              }
            }}
          >
            {value}
            {value === null && cellNotes.length > 0 ? (
              <span aria-hidden className={styles.notes}>
                {DIGITS.map((digit) => (
                  <span key={digit}>
                    {cellNotes.includes(digit) ? digit : null}
                  </span>
                ))}
              </span>
            ) : null}
            {isWrong ? <WrongMark /> : null}
          </button>
        );
      })}
    </div>
  );
}

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

function cellPlacement(
  row: number,
  column: number,
): { readonly gridColumn: number; readonly gridRow: number } {
  return { gridColumn: track(column), gridRow: track(row) };
}

function cellClassName(state: {
  readonly given: boolean;
  readonly entered: boolean;
  readonly hinted: boolean;
  readonly invalid: boolean;
  readonly highlight: CellHighlight | null;
  readonly selected: boolean;
}): string {
  const tone = state.invalid
    ? [styles.cellViolating]
    : state.hinted
      ? [styles.cellHinted]
      : [
          state.entered
            ? styles.cellEntered
            : state.given
              ? styles.cellGiven
              : undefined,
          highlightClassName(state.highlight),
        ];
  return [
    styles.cell,
    ...tone,
    state.selected ? styles.cellSelected : undefined,
  ]
    .filter((name) => name !== undefined)
    .join(" ");
}

function highlightClassName(
  highlight: CellHighlight | null,
): string | undefined {
  switch (highlight) {
    case "unit":
      return styles.cellUnit;
    case "same-digit":
      return styles.cellSameDigit;
    case null:
      return undefined;
  }
}

function cellAria(
  row: number,
  column: number,
  given: number | undefined,
  value: number | null,
  invalid: boolean,
  wrong: boolean,
  notes: readonly SudokuDigit[],
): string {
  const copy = messages.games.sudoku.play;
  const label = invalid
    ? copy.cellInvalidAria(row, column, value)
    : given !== undefined && given !== EMPTY
      ? copy.cellGivenAria(row, column, given)
      : copy.cellAria(row, column, value);
  const named = notes.length > 0 ? copy.cellNotesAria(label, notes) : label;
  return wrong ? messages.play.wrongCell(named) : named;
}

function codeDigit(code: string): string {
  return /^(?:Digit|Numpad)(\d)$/.exec(code)?.[1] ?? "";
}

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
