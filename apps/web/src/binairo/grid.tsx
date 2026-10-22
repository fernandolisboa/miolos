import { BINAIRO_SIZE, type BinairoGrid } from "@miolos/games/binairo";
import { memo, type MouseEvent as ReactMouseEvent } from "react";

import { messages } from "../i18n";
import type { BinaryMark } from "../play/binary-grid";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import { useBinaryBoard } from "../play/use-binary-board";
import type { MistakeState } from "../play/mistakes";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import styles from "./binairo-screen.module.css";
import type { CellValue } from "./state";

const copy = messages.games.binairo.play;

const KEYS: ReadonlyMap<string, BinaryMark | null> = new Map([
  ["0", 0],
  ["1", 1],
  ["Backspace", null],
  ["Delete", null],
]);

export function Grid({
  givens,
  solution,
  entries,
  mistakes,
  violating,
  selected,
  hintIndex,
  spotlight,
  painting,
  onSelect,
  onMove,
  onTap,
  onStrokeStart,
  onPaintOver,
  onEnterValue,
  onClear,
}: {
  readonly givens: BinairoGrid;
  readonly solution: readonly BinaryMark[] | null;
  readonly entries: readonly CellValue[];
  readonly mistakes: MistakeState;
  readonly violating: ReadonlySet<number>;
  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly painting: boolean;
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onTap: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onPaintOver: (index: number) => void;
  readonly onEnterValue: (value: BinaryMark) => void;
  readonly onClear: () => void;
}) {
  const board = useBinaryBoard({
    size: BINAIRO_SIZE,
    selected,
    painting,
    keys: KEYS,
    onTap,
    onStrokeStart,
    onPaintOver,
    onMove,
    onEnterValue,
    onClear,
  });
  const wrong = useWrongCells("binairo", solution, givens, entries, mistakes);

  return (
    <div
      {...board.boardProps}
      className={styles.grid}
      role="group"
      aria-label={copy.boardAria}
    >
      {givens.map((given, index) => (
        <Cell
          key={index}
          index={index}
          given={given}
          value={entries[index] ?? null}
          invalid={violating.has(index)}
          wrong={wrong.has(index)}
          hinted={hintIndex === index}
          spotlit={spotlight.includes(index)}
          selected={selected === index}
          tabbable={board.tabbable === index}
          onCellFocus={onSelect}
          onCellClick={board.onCellClick}
        />
      ))}
    </div>
  );
}

const Cell = memo(function Cell({
  index,
  given,
  value,
  invalid,
  wrong,
  hinted,
  spotlit,
  selected,
  tabbable,
  onCellFocus,
  onCellClick,
}: {
  readonly index: number;
  readonly given: CellValue;
  readonly value: CellValue;
  readonly invalid: boolean;
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
  const row = Math.floor(index / BINAIRO_SIZE) + 1;
  const column = (index % BINAIRO_SIZE) + 1;
  const tint = spotlit ? ` ${spotlightStyles.spotlit}` : "";
  const caret = selected ? ` ${styles.cellSelected}` : "";
  const handlers = {
    "data-cell-index": index,
    tabIndex: tabbable ? 0 : -1,
    onFocus: () => onCellFocus(index),
    onClick: (event: ReactMouseEvent<HTMLButtonElement>) =>
      onCellClick(index, event),
  };
  if (given !== null) {
    return (
      <button
        type="button"
        className={`${styles.cell} ${styles.cellGiven}${tint}${caret}`}
        aria-disabled="true"
        aria-label={copy.cellGivenAria(row, column, given)}
        {...handlers}
      >
        {given}
      </button>
    );
  }
  const label = invalid
    ? copy.cellInvalidAria(row, column, value)
    : copy.cellAria(row, column, value);
  return (
    <button
      type="button"
      className={`${cellClassName(value, invalid, hinted)}${tint}${caret}`}
      aria-label={wrong ? messages.play.wrongCell(label) : label}
      {...handlers}
    >
      {value}
      {wrong ? <WrongMark /> : null}
    </button>
  );
});

function cellClassName(
  value: CellValue,
  invalid: boolean,
  hinted: boolean,
): string {
  if (invalid) {
    return `${styles.cell} ${styles.cellViolating}`;
  }
  if (hinted) {
    return `${styles.cell} ${styles.cellHinted}`;
  }
  return `${styles.cell}${value === null ? "" : ` ${styles.cellEntered}`}`;
}
