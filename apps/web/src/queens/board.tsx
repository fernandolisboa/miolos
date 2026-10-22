import type { QueensSize } from "@miolos/core";
import { memo, useMemo } from "react";

import { messages } from "../i18n";
import type { Press } from "../play/brush";
import spotlightStyles from "../play/spotlight.module.css";
import {
  cellProps,
  useBinaryBoard,
  type CellWiring,
} from "../play/use-binary-board";
import type { MistakeState } from "../play/mistakes";
import { useWrongCells } from "../play/use-wrong-cells";
import { WrongMark } from "../play/wrong-mark";
import { useSettings } from "../settings/settings";
import styles from "./queens-board.module.css";
import { fadedCells, NO_CELLS, reachedCells } from "./shading";
import type { QueensCellValue, QueensMark } from "./state";

const SIZE_CLASS = {
  7: styles.size7,
  8: styles.size8,
  9: styles.size9,
} satisfies Record<QueensSize, string | undefined>;

export const Board = memo(function Board({
  size,
  regions,
  solution,
  entries,
  mistakes,
  conflicts,
  selected,
  hintIndex,
  spotlight,
  onSelect,
  onMove,
  onTap,
  onStrokeStart,
  onPaintOver,
  onEnterValue,
  onClear,
}: {
  readonly size: QueensSize;
  readonly regions: readonly number[];
  readonly solution: readonly QueensMark[] | null;
  readonly entries: readonly QueensCellValue[];
  readonly mistakes: MistakeState;
  readonly conflicts: ReadonlySet<number>;
  readonly selected: number | null;
  readonly hintIndex: number | null;
  readonly spotlight: readonly number[];
  readonly onSelect: (index: number) => void;
  readonly onMove: (rows: number, columns: number) => void;
  readonly onTap: (index: number, press: Press) => void;
  readonly onStrokeStart: (index: number, press: Press) => void;
  readonly onPaintOver: (index: number) => void;
  readonly onEnterValue: (value: QueensMark) => void;
  readonly onClear: () => void;
}) {
  const wrong = useWrongCells("queens", solution, null, entries, mistakes);
  const { highlightRegion, fadeQueenLines } = useSettings().games.queens;
  const puzzle = useMemo(() => ({ size, regions }), [size, regions]);
  const reach = useMemo(
    () =>
      highlightRegion && spotlight.length === 0
        ? reachedCells(puzzle, selected, entries)
        : NO_CELLS,
    [highlightRegion, spotlight, puzzle, selected, entries],
  );
  const faded = useMemo(
    () => (fadeQueenLines ? fadedCells(puzzle, entries) : NO_CELLS),
    [fadeQueenLines, puzzle, entries],
  );
  const board = useBinaryBoard({
    size,
    selected,
    onTap,
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
          wrong={wrong.has(index)}
          hinted={hintIndex === index}
          spotlit={spotlight.includes(index)}
          reached={reach.has(index)}
          faded={faded.has(index)}
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
  wrong,
  hinted,
  spotlit,
  reached,
  faded,
  selected,
  tabbable,
  onCellFocus,
  onCellClick,
}: {
  readonly size: number;
  readonly regions: readonly number[];
  readonly region: number;
  readonly value: QueensCellValue;
  readonly conflict: boolean;
  readonly wrong: boolean;
  readonly hinted: boolean;
  readonly spotlit: boolean;
  readonly reached: boolean;
  readonly faded: boolean;
  readonly selected: boolean;
} & CellWiring) {
  const row = Math.floor(index / size);
  const column = index % size;
  const label = messages.games.queens.play.cellAria(
    row + 1,
    column + 1,
    region + 1,
    value,
    conflict,
  );
  return (
    <button
      type="button"
      className={[
        styles.cell,
        edgeClasses(index, size, regions),
        value === 0 ? styles.cellMarked : "",
        reached ? styles.cellReach : "",
        faded ? styles.cellFaded : "",
        hinted ? styles.cellHinted : "",
        spotlit ? spotlightStyles.spotlit : "",
        conflict ? styles.cellConflict : "",
        selected ? styles.cellSelected : "",
      ]
        .filter((name) => name !== "")
        .join(" ")}
      style={regionFill(region)}
      {...cellProps({ index, tabbable, onCellFocus, onCellClick })}
      aria-label={wrong ? messages.play.wrongCell(label) : label}
    >
      {value === 1 ? <QueenGlyph /> : null}
      {wrong ? <WrongMark /> : null}
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
