import { queensLineCells, type QueensBoard } from "@miolos/games/queens";

import type { QueensCellValue } from "./state";

export const NO_CELLS: ReadonlySet<number> = new Set();

const withoutQueens = (
  cells: readonly number[],
  entries: readonly QueensCellValue[],
) => cells.filter((cell) => entries[cell] !== 1);

export function reachedCells(
  board: QueensBoard,
  selected: number | null,
  entries: readonly QueensCellValue[],
): ReadonlySet<number> {
  return selected === null
    ? NO_CELLS
    : new Set(withoutQueens(queensLineCells(board, selected), entries));
}

export function fadedCells(
  board: QueensBoard,
  entries: readonly QueensCellValue[],
): ReadonlySet<number> {
  return new Set(
    entries.flatMap((entry, queen) =>
      entry === 1 ? withoutQueens(queensLineCells(board, queen), entries) : [],
    ),
  );
}
