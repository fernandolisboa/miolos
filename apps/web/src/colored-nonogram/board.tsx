import type { NonogramSize } from "@miolos/core";
import type {
  ColoredNonogramClues,
  ColoredRun,
} from "@miolos/games/colored-nonogram";
import {
  Fragment,
  memo,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";

import { messages } from "../i18n";
import {
  SIZE_CLASS,
  columnRailId,
  rowRailId,
  ruleClasses,
} from "../nonogram/board-grid";
import boardStyles from "../nonogram/nonogram-board.module.css";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import { useBinaryBoard } from "../play/use-binary-board";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import { useSettings } from "../settings/settings";
import styles from "./colored-board.module.css";
import { coloredCopy, toneName } from "./copy";

const NONE_PLACED: readonly boolean[] = Object.freeze([]);

export function toneStyle(letter: string): CSSProperties {
  return {
    background: `var(--tone-${letter})`,
    "--cell-ink": `var(--ink-on-tone-${letter})`,
  };
}

export const ColoredBoard = memo(function ColoredBoard({
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
  readonly clues: ColoredNonogramClues;
  readonly solution: readonly number[] | null;
  readonly entries: readonly (number | null)[];
  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onMarkCell: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onEnterValue: (value: 0 | 1) => void;
  readonly onClear: () => void;
  readonly onPaintOver: (index: number) => void;
}) {
  const wrong = useWrongCells("nonogram", solution, null, entries);
  const { straightDrag } = useSettings().games.nonogram;
  const board = useBinaryBoard({
    size,
    selected,
    onTap: onMarkCell,
    onStrokeStart,
    onPaintOver,
    onMove,
    onEnterValue,
    onClear,
    straight: straightDrag,
  });

  return (
    <div
      {...board.boardProps}
      className={`${boardStyles.grid} ${SIZE_CLASS[size]}`}
      role="group"
      aria-label={messages.games.nonogram.play.boardAria(size)}
    >
      {clues.cols.map((runs, column) => (
        <ChipRail
          key={column}
          kind="column"
          index={column}
          runs={runs}
          palette={clues.palette}
        />
      ))}

      {clues.rows.map((runs, row) => (
        <Fragment key={row}>
          <ChipRail
            kind="row"
            index={row}
            runs={runs}
            palette={clues.palette}
          />
          {Array.from({ length: size }, (_unused, column) => {
            const index = row * size + column;
            return (
              <ColoredCell
                key={index}
                index={index}
                row={row}
                column={column}
                size={size}
                value={entries[index] ?? null}
                letter={clues.palette[(entries[index] ?? 0) - 1]}
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

const ChipRail = memo(function ChipRail({
  kind,
  index,
  runs,
  palette,
}: {
  readonly kind: "row" | "column";
  readonly index: number;
  readonly runs: readonly ColoredRun[];
  readonly palette: readonly string[];
}) {
  const copy = messages.games.nonogram.play;
  const row = kind === "row";
  const named = runs.map((run) =>
    coloredCopy.run(run.length, toneName(palette, run.tone)),
  );
  return (
    <div
      id={row ? rowRailId(index) : columnRailId(index)}
      role="group"
      aria-label={
        row
          ? copy.rowCluesAria(index + 1, named, NONE_PLACED)
          : copy.columnCluesAria(index + 1, named, NONE_PLACED)
      }
      className={row ? boardStyles.clueRow : boardStyles.clueCol}
      style={
        row
          ? { gridColumn: 1, gridRow: index + 2 }
          : { gridColumn: index + 2, gridRow: 1 }
      }
    >
      {runs.length === 0 ? (
        <span aria-hidden className={boardStyles.clueNumber}>
          0
        </span>
      ) : (
        runs.map((run, at) => (
          <span
            aria-hidden
            key={at}
            className={styles.chip}
            style={toneStyle(palette[run.tone - 1] ?? "")}
          >
            {run.length}
          </span>
        ))
      )}
    </div>
  );
});

const ColoredCell = memo(function ColoredCell({
  index,
  row,
  column,
  size,
  value,
  letter,
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
  readonly size: number;
  readonly value: number | null;
  readonly letter: string | undefined;
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
  const painted = value !== null && value > 0 && letter !== undefined;
  const label = painted
    ? coloredCopy.cellAria(row + 1, column + 1, coloredCopy.toneName(letter))
    : messages.games.nonogram.play.cellAria(
        row + 1,
        column + 1,
        value === 0 ? 0 : null,
      );
  return (
    <button
      type="button"
      className={[
        boardStyles.cell,
        ruleClasses(row, column, size),
        painted ? styles.cellTone : value === 0 ? boardStyles.cellCrossed : "",
        hinted
          ? painted
            ? styles.cellToneHinted
            : boardStyles.cellHinted
          : "",
        spotlit ? spotlightStyles.spotlit : "",
        selected ? boardStyles.cellSelected : "",
      ]
        .filter((name) => name !== "")
        .join(" ")}
      style={{
        gridColumn: column + 2,
        gridRow: row + 2,
        ...(painted ? toneStyle(letter) : {}),
      }}
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
