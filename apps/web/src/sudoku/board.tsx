import type { SudokuGrid } from "@miolos/games/sudoku";
import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

import { messages } from "../i18n";
import { track } from "./engine";
import type { SudokuCellValue, SudokuDigit } from "./state";
import styles from "./sudoku-board.module.css";

const SIDE = 9;

const EMPTY = 0;

const ROW_SPAN = SIDE - 1;

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

  readonly selected: number | null;
  readonly violating: ReadonlySet<number>;
  readonly hintIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onDigit: (digit: SudokuDigit) => void;
  readonly onClear: () => void;
}) {
  const boardRef = useRef<HTMLDivElement>(null);

  const tabbable = selected ?? 0;

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

            aria-disabled={given !== EMPTY}

            aria-label={cellAria(row + 1, column + 1, given, value, invalid)}

            onFocus={() => onSelect(index)}

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

const MOVES: Readonly<Record<string, readonly [number, number]>> = {
  ArrowUp: [-1, 0],
  ArrowDown: [1, 0],
  ArrowLeft: [0, -1],
  ArrowRight: [0, 1],
  Home: [0, -ROW_SPAN],
  End: [0, ROW_SPAN],
};

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
