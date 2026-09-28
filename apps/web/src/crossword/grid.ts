import type { DailyCrosswordResponse } from "@miolos/core";

export const GRID_SIZE = 5;
export const CELL_COUNT = GRID_SIZE * GRID_SIZE;

export type CrosswordDirection = "across" | "down";
export type CrosswordClue = DailyCrosswordResponse["clues"][number];
export type CrosswordCell = string | null;

export function indexOf(row: number, col: number): number {
  return row * GRID_SIZE + col;
}

export function rowOf(index: number): number {
  return Math.floor(index / GRID_SIZE);
}

export function colOf(index: number): number {
  return index % GRID_SIZE;
}

export function flattenGrid(
  grid: readonly (readonly CrosswordCell[])[],
): readonly CrosswordCell[] {
  return grid.flat();
}

export function entryCells(clue: CrosswordClue): readonly number[] {
  return Array.from({ length: clue.length }, (_unused, step) =>
    clue.direction === "across"
      ? indexOf(clue.row, clue.col + step)
      : indexOf(clue.row + step, clue.col),
  );
}

export function entryAt(
  clues: readonly CrosswordClue[],
  index: number,
  direction: CrosswordDirection,
): CrosswordClue | undefined {
  return clues.find(
    (clue) => clue.direction === direction && entryCells(clue).includes(index),
  );
}

export function activeEntry(
  clues: readonly CrosswordClue[],
  index: number,
  direction: CrosswordDirection,
): CrosswordClue | undefined {
  return (
    entryAt(clues, index, direction) ??
    entryAt(clues, index, direction === "across" ? "down" : "across")
  );
}

export function nextCellInEntry(
  clue: CrosswordClue,
  index: number,
): number | undefined {
  const cells = entryCells(clue);
  const at = cells.indexOf(index);
  return at === -1 ? undefined : cells[at + 1];
}

export function prevCellInEntry(
  clue: CrosswordClue,
  index: number,
): number | undefined {
  const cells = entryCells(clue);
  const at = cells.indexOf(index);
  return at <= 0 ? undefined : cells[at - 1];
}

export function isBlock(
  solution: readonly CrosswordCell[],
  index: number,
): boolean {
  return solution[index] === null;
}

export function isSolved(
  solution: readonly CrosswordCell[],
  entries: readonly CrosswordCell[],
): boolean {
  return solution.every(
    (cell, index) => cell === null || entries[index] === cell,
  );
}

export function countFilled(
  solution: readonly CrosswordCell[],
  entries: readonly CrosswordCell[],
): number {
  let filled = 0;
  for (const [index, cell] of solution.entries()) {
    if (cell !== null && entries[index] !== null) {
      filled += 1;
    }
  }
  return filled;
}

export function firstPlayableIndex(solution: readonly CrosswordCell[]): number {
  const index = solution.findIndex((cell) => cell !== null);
  return index === -1 ? 0 : index;
}

// `nextHint` skips any index whose `givens` entry is non-null; a block has no
// solution letter to reveal, so it stands in as that marker.
const BLOCK_MARKER = "#";

export function hintGivens(
  solution: readonly CrosswordCell[],
): readonly CrosswordCell[] {
  return solution.map((cell) => (cell === null ? BLOCK_MARKER : null));
}

const ACCENT_MARKS = /\p{Mn}/gu;

export function normalizeLetter(key: string): string {
  return key.toLowerCase().normalize("NFD").replace(ACCENT_MARKS, "");
}
