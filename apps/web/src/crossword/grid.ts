import type { DailyCrosswordResponse } from "@miolos/core";

export type CrosswordDirection = "across" | "down";
export type CrosswordClue = DailyCrosswordResponse["clues"][number];
export type CrosswordCell = string | null;

export function indexOf(row: number, col: number, size: number): number {
  return row * size + col;
}

export function rowOf(index: number, size: number): number {
  return Math.floor(index / size);
}

export function colOf(index: number, size: number): number {
  return index % size;
}

export function flattenGrid(
  grid: readonly (readonly CrosswordCell[])[],
): readonly CrosswordCell[] {
  return grid.flat();
}

export function entryCells(
  clue: CrosswordClue,
  size: number,
): readonly number[] {
  return Array.from({ length: clue.length }, (_unused, step) =>
    clue.direction === "across"
      ? indexOf(clue.row, clue.col + step, size)
      : indexOf(clue.row + step, clue.col, size),
  );
}

export function entryAt(
  clues: readonly CrosswordClue[],
  index: number,
  direction: CrosswordDirection,
  size: number,
): CrosswordClue | undefined {
  return clues.find(
    (clue) =>
      clue.direction === direction && entryCells(clue, size).includes(index),
  );
}

export function activeEntry(
  clues: readonly CrosswordClue[],
  index: number,
  direction: CrosswordDirection,
  size: number,
): CrosswordClue | undefined {
  return (
    entryAt(clues, index, direction, size) ??
    entryAt(clues, index, direction === "across" ? "down" : "across", size)
  );
}

export function nextCellInEntry(
  clue: CrosswordClue,
  index: number,
  size: number,
): number | undefined {
  const cells = entryCells(clue, size);
  const at = cells.indexOf(index);
  return at === -1 ? undefined : cells[at + 1];
}

export function nextEmptyCell(
  clues: readonly CrosswordClue[],
  entries: readonly CrosswordCell[],
  index: number,
  direction: CrosswordDirection,
  size: number,
): number | undefined {
  const clue = entryAt(clues, index, direction, size);
  if (clue === undefined) {
    return undefined;
  }
  const cells = entryCells(clue, size);
  const at = cells.indexOf(index);
  const sameDirection = clues
    .filter((other) => other.direction === direction)
    .sort((a, b) => a.number - b.number);
  const from = sameDirection.indexOf(clue);
  const following = [
    ...sameDirection.slice(from + 1),
    ...sameDirection.slice(0, from),
  ];
  return [
    ...cells.slice(at + 1),
    ...cells.slice(0, at),
    ...following.flatMap((other) => entryCells(other, size)),
  ].find((cell) => entries[cell] === null);
}

export function prevCellInEntry(
  clue: CrosswordClue,
  index: number,
  size: number,
): number | undefined {
  const cells = entryCells(clue, size);
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

export function countAnswered(
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
