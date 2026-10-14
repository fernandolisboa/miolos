import type { NonogramSize } from "@miolos/core";
import { placedClues, type NonogramClues } from "@miolos/games/nonogram";
import {
  Fragment,
  memo,
  useMemo,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { messages } from "../i18n";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import { useBinaryBoard } from "../play/use-binary-board";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import { useSettings } from "../settings/settings";
import { cellStateOf } from "./engine";
import styles from "./nonogram-board.module.css";
import type { NonogramCellValue, NonogramMark } from "./state";

const GROUP = 5;

const EMPTY_LINE: readonly number[] = [0];

const NONE_PLACED: readonly boolean[] = Object.freeze([]);

const SIZE_CLASS = {
  5: styles.size5,
  8: styles.size8,
  10: styles.size10,
  15: styles.size15,
} satisfies Record<NonogramSize, string | undefined>;

export const Board = memo(function Board({
  size,
  clues,
  solution,
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
  readonly solution: readonly NonogramMark[] | null;
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
  const wrong = useWrongCells("nonogram", solution, null, entries);
  const strike = useSettings().games.nonogram.strikePlacedRuns;
  const placed = useMemo(
    () => (strike ? placedClues(clues, entries.map(cellStateOf)) : null),
    [strike, clues, entries],
  );
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
        <ClueRail
          key={column}
          kind="column"
          index={column}
          runs={runs}
          placed={placed?.cols[column] ?? NONE_PLACED}
        />
      ))}

      {clues.rows.map((runs, row) => (
        <Fragment key={row}>
          <ClueRail
            kind="row"
            index={row}
            runs={runs}
            placed={placed?.rows[row] ?? NONE_PLACED}
          />
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
                wrong={wrong.has(index)}
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

interface ClueRailProps {
  readonly kind: "row" | "column";
  readonly index: number;
  readonly runs: readonly number[];
  readonly placed: readonly boolean[];
}

const ClueRail = memo(function ClueRail({
  kind,
  index,
  runs,
  placed,
}: ClueRailProps) {
  const copy = messages.games.nonogram.play;
  const row = kind === "row";
  return (
    <div
      id={row ? rowRailId(index) : columnRailId(index)}
      role="group"
      aria-label={
        row
          ? copy.rowCluesAria(index + 1, runs, placed)
          : copy.columnCluesAria(index + 1, runs, placed)
      }
      className={row ? styles.clueRow : styles.clueCol}
      style={
        row
          ? { gridColumn: 1, gridRow: index + 2 }
          : { gridColumn: index + 2, gridRow: 1 }
      }
    >
      {numbersOf(runs).map((run, at) => (
        <span
          aria-hidden
          key={at}
          className={
            placed[at] === true
              ? `${styles.clueNumber} ${styles.clueNumberPlaced}`
              : styles.clueNumber
          }
        >
          {run}
        </span>
      ))}
    </div>
  );
}, sameRail);

function sameRail(before: ClueRailProps, after: ClueRailProps): boolean {
  return (
    before.kind === after.kind &&
    before.index === after.index &&
    before.runs === after.runs &&
    before.placed.length === after.placed.length &&
    before.placed.every((struck, at) => struck === after.placed[at])
  );
}

const Cell = memo(function Cell({
  index,
  row,
  column,
  size,
  value,
  wrong,
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
  readonly wrong: boolean;
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
  const label = messages.games.nonogram.play.cellAria(
    row + 1,
    column + 1,
    value,
  );
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

      aria-label={wrong ? messages.play.wrongCell(label) : label}

      aria-describedby={`${rowRailId(row)} ${columnRailId(column)}`}

      onFocus={() => onCellFocus(index)}
      onClick={(event) => onCellClick(index, event)}
    >
      {wrong ? <WrongMark /> : null}
    </button>
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
    state.spotlit ? spotlightStyles.spotlit : "",
    state.selected ? styles.cellSelected : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
}
