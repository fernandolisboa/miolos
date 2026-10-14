import { queensLineCells, type QueensBoard } from "@miolos/games/queens";

import type { QueensCellValue } from "./state";

const NO_CELLS: ReadonlySet<number> = new Set();

export function reachedCells(
  board: QueensBoard,
  selected: number | null,
  entries: readonly QueensCellValue[],
): ReadonlySet<number> {
  return selected === null
    ? NO_CELLS
    : new Set(
        queensLineCells(board, selected).filter((cell) => entries[cell] !== 1),
      );
}

export function fadedCells(
  board: QueensBoard,
  entries: readonly QueensCellValue[],
): ReadonlySet<number> {
  const faded = new Set<number>();
  for (const [queen, entry] of entries.entries()) {
    if (entry === 1) {
      for (const cell of reachedCells(board, queen, entries)) {
        faded.add(cell);
      }
    }
  }
  return faded;
}

export { NO_CELLS };
