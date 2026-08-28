import { solveSudoku, type SudokuGrid } from "@miolos/games/sudoku";

import type { SudokuCellValue, SudokuDigit } from "./state";

const EMPTY = 0;

const CELLS = 81;

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
