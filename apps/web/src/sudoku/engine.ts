import { solveSudoku, type SudokuGrid } from "@miolos/games/sudoku";

import type { SudokuCellValue, SudokuDigit } from "./state";

const EMPTY = 0;

const CELLS = 81;

const SIDE = 9;

const BOX = 3;

export type CellHighlight = "unit" | "same-digit";

export const track = (index: number): number =>
  index + 1 + (index >= 3 ? 1 : 0) + (index >= 6 ? 1 : 0);

export function mergedGrid(
  givens: SudokuGrid,
  entries: readonly SudokuCellValue[],
): SudokuGrid {
  return givens.map((given, index) =>
    given !== EMPTY ? given : (entries[index] ?? EMPTY),
  );
}

export function sharesUnit(a: number, b: number): boolean {
  const [rowA, columnA] = [Math.floor(a / SIDE), a % SIDE];
  const [rowB, columnB] = [Math.floor(b / SIDE), b % SIDE];
  return (
    rowA === rowB ||
    columnA === columnB ||
    (Math.floor(rowA / BOX) === Math.floor(rowB / BOX) &&
      Math.floor(columnA / BOX) === Math.floor(columnB / BOX))
  );
}

export function selectionHighlights(
  grid: SudokuGrid,
  selected: number | null,
): ReadonlyMap<number, CellHighlight> {
  const highlights = new Map<number, CellHighlight>();
  if (selected === null) {
    return highlights;
  }
  const digit = grid[selected] ?? EMPTY;
  for (const [index, cell] of grid.entries()) {
    if (digit !== EMPTY && cell === digit) {
      highlights.set(index, "same-digit");
    } else if (sharesUnit(index, selected)) {
      highlights.set(index, "unit");
    }
  }
  return highlights;
}

export function spotlightHighlights(
  cells: readonly number[],
): ReadonlyMap<number, CellHighlight> {
  return new Map(cells.map((index) => [index, "unit"]));
}

export function isPlayable(givens: SudokuGrid, index: number): boolean {
  return givens[index] === EMPTY;
}

export function solutionDigits(
  givens: SudokuGrid,
): readonly SudokuDigit[] | null {
  const solved = solveSudoku(givens);
  return solved === null ? null : allDigits(solved);
}

export function playableGivens(
  givens: SudokuGrid,
): readonly (SudokuDigit | null)[] {
  return givens.map(asDigit);
}

export function solvedDigits(
  merged: SudokuGrid,
): readonly SudokuDigit[] | null {
  return allDigits(merged);
}

function allDigits(grid: SudokuGrid): readonly SudokuDigit[] | null {
  if (grid.length !== CELLS) {
    return null;
  }
  const digits: SudokuDigit[] = [];
  for (const cell of grid) {
    const digit = asDigit(cell);
    if (digit === null) {
      return null;
    }
    digits.push(digit);
  }
  return digits;
}

function asDigit(cell: number | undefined): SudokuDigit | null {
  switch (cell) {
    case 1:
    case 2:
    case 3:
    case 4:
    case 5:
    case 6:
    case 7:
    case 8:
    case 9:
      return cell;
    default:
      return null;
  }
}
