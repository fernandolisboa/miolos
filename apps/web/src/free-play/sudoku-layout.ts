import { CLASSIC_LAYOUT, type SudokuLayout } from "@miolos/games/sudoku";

import { messages } from "../i18n";
import type { BoardLook } from "../sudoku/board";
import type {
  sudokuHintExplanation,
  SudokuHintReason,
  SudokuUnitName,
} from "../sudoku/hint";
import styles from "./sudoku-look.module.css";

const SIDE = 9;

const copy = messages.freePlay.sudokuVariant;

function isBoxLayout(layout: SudokuLayout): boolean {
  return layout.regions.every(
    (region, index) => region === CLASSIC_LAYOUT.regions[index],
  );
}

function extraUnitsThrough(layout: SudokuLayout, index: number): number {
  return layout.extraUnits.filter((unit) => unit.includes(index)).length;
}

const PLAIN_GRID = styles.formas ?? "";

export const PLAIN_LOOK: BoardLook = {
  plainGrid: PLAIN_GRID,
  cells: [],
  where: [],
};

export function sudokuLook(layout: SudokuLayout): BoardLook | undefined {
  const boxes = isBoxLayout(layout);
  if (boxes && layout.extraUnits.length === 0) {
    return undefined;
  }
  const { regions } = layout;
  const cells = regions.map((region, index) => {
    const row = Math.floor(index / SIDE);
    const column = index % SIDE;
    const onExtra = extraUnitsThrough(layout, index) > 0;
    return [
      !boxes && column < SIDE - 1 && regions[index + 1] !== region
        ? styles.edgeRight
        : undefined,
      !boxes && row < SIDE - 1 && regions[index + SIDE] !== region
        ? styles.edgeBottom
        : undefined,
      onExtra && row === column ? styles.diagonalMain : undefined,
      onExtra && row + column === SIDE - 1 ? styles.diagonalAnti : undefined,
    ]
      .filter(Boolean)
      .join(" ");
  });
  const where = regions.map((region, index) => {
    if (!boxes) {
      return copy.region(region + 1);
    }
    const diagonals = extraUnitsThrough(layout, index);
    return diagonals === 0 ? undefined : copy.diagonals(diagonals);
  });
  return boxes ? { cells, where } : { plainGrid: PLAIN_GRID, cells, where };
}

function unitNamesAt(
  layout: SudokuLayout,
  index: number,
): readonly SudokuUnitName[] {
  return [
    "row",
    "column",
    isBoxLayout(layout) ? "box" : "region",
    ...Array.from(
      { length: extraUnitsThrough(layout, index) },
      (): SudokuUnitName => "diagonal",
    ),
  ];
}

// see ADR-0131: a value import of sudoku/hint here costs the daily /sudoku 0.9 KB
export function namedHint(
  reason: SudokuHintReason | null,
  layout: SudokuLayout,
): {
  readonly reason: Parameters<typeof sudokuHintExplanation>[0];
  readonly units: readonly SudokuUnitName[] | undefined;
} {
  if (reason?.kind !== "step") {
    return { reason, units: undefined };
  }
  const { step } = reason;
  const region = isBoxLayout(layout) ? "box" : "region";
  return {
    reason: {
      kind: "step",
      step: {
        ...step,
        unit: step.unit?.kind === "box" ? { kind: region } : step.unit,
      },
    },
    units: unitNamesAt(layout, step.index),
  };
}
