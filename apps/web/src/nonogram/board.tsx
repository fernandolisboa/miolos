import type { NonogramSize } from "@miolos/core";
import type { NonogramClues } from "@miolos/games/nonogram";
import { Fragment, memo, type MouseEvent as ReactMouseEvent } from "react";

import { messages } from "../i18n";
import type { Press } from "../play/brush";
import { useBinaryBoard } from "../play/use-binary-board";
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
  spotlight,
  onSelect,
  onMove,
  onMarkCell,
  onStrokeStart,
  onEnterValue,
  onClear,
  onPaintOver,
}: {
  readonly size: NonogramSize;
  readonly clues: NonogramClues;
  readonly entries: readonly NonogramCellValue[];

  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;

  readonly onMarkCell: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;

  readonly onEnterValue: (value: NonogramMark) => void;
  readonly onClear: () => void;

  readonly onPaintOver: (index: number) => void;
}) {
  const copy = messages.games.nonogram.play;
  const board = useBinaryBoard({
    size,
    selected,
    onTap: onMarkCell,
    onStrokeStart,
    onPaintOver,
    onMove,
    onEnterValue,
    onClear,
  });

  return (
    <div
      {...board.boardProps}
      className={`${styles.grid} ${SIZE_CLASS[size]}`}
      role="group"
      aria-label={copy.boardAria(size)}
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
                spotlit={spotlight.includes(index)}
                selected={selected === index}
                tabbable={board.tabbable === index}
                onCellFocus={onSelect}
                onCellClick={board.onCellClick}
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
  spotlit,
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
  readonly spotlit: boolean;

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
      className={cellClassName({
        row,
        column,
        size,
        value,
        hinted,
        spotlit,
        selected,
      })}
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
  readonly spotlit: boolean;
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
    state.spotlit ? styles.cellSpotlit : "",
    state.selected ? styles.cellSelected : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
}
