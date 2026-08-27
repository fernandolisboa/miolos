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

const GROUP = 5;

const EMPTY_LINE: readonly number[] = [0];

const SIZE_CLASS = {
  5: styles.size5,
  8: styles.size8,
  10: styles.size10,
  15: styles.size15,
} satisfies Record<NonogramSize, string | undefined>;

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

  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;

  readonly onMarkCell: (index: number) => void;

  readonly onEnterValue: (value: NonogramMark) => void;
  readonly onClear: () => void;

  readonly onPaintOver: (index: number) => void;
}) {
  const copy = messages.games.nonogram.play;
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
    focusCell(board, selected);
  }, [selected]);

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
      event.currentTarget.focus();
      if (consumedClickRef.current(event)) {
        return;
      }

      onMarkCell(index);
    },
    [onMarkCell],
  );

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
        <ColRail key={column} column={column} runs={runs} />
      ))}

      {clues.rows.map((runs, row) => (
        <Fragment key={row}>
          <RowRail row={row} runs={runs} />
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

const ColRail = memo(function ColRail({
  column,
  runs,
}: {
  readonly column: number;
  readonly runs: readonly number[];
}) {
  return (
    <div
      id={columnRailId(column)}
      role="group"
      aria-label={messages.games.nonogram.play.columnCluesAria(
        column + 1,
        runs,
      )}
      className={styles.clueCol}
      style={{ gridColumn: column + 2, gridRow: 1 }}
    >
      {numbersOf(runs).map((run, at) => (
        <span aria-hidden key={at} className={styles.clueNumber}>
          {run}
        </span>
      ))}
    </div>
  );
});

const RowRail = memo(function RowRail({
  row,
  runs,
}: {
  readonly row: number;
  readonly runs: readonly number[];
}) {
  return (
    <div
      id={rowRailId(row)}
      role="group"
      aria-label={messages.games.nonogram.play.rowCluesAria(row + 1, runs)}
      className={styles.clueRow}
      style={{ gridColumn: 1, gridRow: row + 2 }}
    >
      {numbersOf(runs).map((run, at) => (
        <span aria-hidden key={at} className={styles.clueNumber}>
          {run}
        </span>
      ))}
    </div>
  );
});

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

  readonly selected: boolean;

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

      aria-label={copy.cellAria(row + 1, column + 1, value)}

      aria-describedby={`${rowRailId(row)} ${columnRailId(column)}`}

      onFocus={() => onCellFocus(index)}
      onClick={(event) => onCellClick(index, event)}
    />
  );
});

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

function numbersOf(runs: readonly number[]): readonly number[] {
  return runs.length === 0 ? EMPTY_LINE : runs;
}

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
