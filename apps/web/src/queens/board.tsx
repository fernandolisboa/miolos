import type { QueensSize } from "@miolos/core";
import { memo, type MouseEvent as ReactMouseEvent } from "react";

import { messages } from "../i18n";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import { useBinaryBoard } from "../play/use-binary-board";
import styles from "./queens-board.module.css";
import type { QueensCellValue, QueensMark } from "./state";

const SIZE_CLASS = {
  7: styles.size7,
  8: styles.size8,
  9: styles.size9,
} satisfies Record<QueensSize, string | undefined>;

export const Board = memo(function Board({
  size,
  regions,
  entries,
  conflicts,
  selected,
  hintIndex,
  spotlight,
  onSelect,
  onMove,
  onTap,
  onCrossOver,
  onEnterValue,
  onClear,
}: {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly entries: readonly QueensCellValue[];
  readonly conflicts: ReadonlySet<number>;
  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onTap: (index: number, press: Press) => void;
  readonly onCrossOver: (index: number) => void;
  readonly onEnterValue: (value: QueensMark) => void;
  readonly onClear: () => void;
}) {
  const board = useBinaryBoard({
    size,
    selected,
    onTap,
    onStrokeStart: onCrossOver,
    onPaintOver: onCrossOver,
    onMove,
    onEnterValue,
    onClear,
  });

  return (
    <div
      {...board.boardProps}
      className={`${styles.grid} ${SIZE_CLASS[size]}`}
      role="group"
      aria-label={messages.games.queens.play.boardAria(size)}
    >
      {regions.map((region, index) => (
        <Cell
          key={index}
          index={index}
          size={size}
          regions={regions}
          value={entries[index] ?? null}
          conflict={conflicts.has(index)}
          hinted={hintIndex === index}
          spotlit={spotlight.includes(index)}
          selected={selected === index}
          tabbable={board.tabbable === index}
          onCellFocus={onSelect}
          onCellClick={board.onCellClick}
          region={region}
        />
      ))}
    </div>
  );
});

const Cell = memo(function Cell({
  index,
  size,
  regions,
  region,
  value,
  conflict,
  hinted,
  spotlit,
  selected,
  tabbable,
  onCellFocus,
  onCellClick,
}: {
  readonly index: number;
  readonly size: number;
  readonly regions: readonly number[];
  readonly region: number;
  readonly value: QueensCellValue;
  readonly conflict: boolean;
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
  const row = Math.floor(index / size);
  const column = index % size;
  return (
    <button
      type="button"
      className={[
        styles.cell,
        edgeClasses(index, size, regions),
        value === 0 ? styles.cellMarked : "",
        hinted ? styles.cellHinted : "",
        spotlit ? spotlightStyles.spotlit : "",
        conflict ? styles.cellConflict : "",
        selected ? styles.cellSelected : "",
      ]
        .filter((name) => name !== "")
        .join(" ")}
      style={regionFill(region)}
      data-cell-index={index}
      tabIndex={tabbable ? 0 : -1}
      aria-label={messages.games.queens.play.cellAria(
        row + 1,
        column + 1,
        region + 1,
        value,
        conflict,
      )}
      onFocus={() => onCellFocus(index)}
      onClick={(event) => onCellClick(index, event)}
    >
      {value === 1 ? <QueenGlyph /> : null}
    </button>
  );
});

export function BoardSkeleton({
  size,
  regions,
}: {
  readonly size: QueensSize;
  readonly regions: readonly number[];
}) {
  return (
    <div aria-hidden className={`${styles.grid} ${SIZE_CLASS[size]}`}>
      {regions.map((region, index) => (
        <div
          key={index}
          className={`${styles.cell} ${edgeClasses(index, size, regions)} ${styles.cellSkeleton}`}
          style={regionFill(region)}
        />
      ))}
    </div>
  );
}

function QueenGlyph() {
  return (
    <svg aria-hidden className={styles.queen} viewBox="0 0 24 24">
      <path d="M4 18 2.5 8l5 4L12 4l4.5 8 5-4L20 18Z" />
      <rect x="4" y="19.5" width="16" height="2.5" rx="1" />
    </svg>
  );
}

function regionFill(region: number) {
  return { backgroundColor: `var(--queens-region-${String(region + 1)})` };
}

function edgeClasses(
  index: number,
  size: number,
  regions: readonly number[],
): string {
  const row = Math.floor(index / size);
  const column = index % size;
  const region = regions[index];
  return [
    row === 0 || regions[index - size] !== region ? styles.edgeTop : "",
    column === 0 || regions[index - 1] !== region ? styles.edgeLeft : "",
    column === size - 1 ? styles.edgeRight : "",
    row === size - 1 ? styles.edgeBottom : "",
  ]
    .filter((name) => name !== "")
    .join(" ");
}
