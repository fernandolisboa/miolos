import type { SudokuGrid } from "../../src/sudoku/index";

export const FULL_GRID: SudokuGrid = [
  7, 8, 2, 4, 1, 5, 9, 6, 3, 9, 6, 1, 8, 2, 3, 7, 5, 4, 3, 4, 5, 9, 6, 7, 8, 2,
  1, 2, 3, 7, 6, 8, 1, 5, 4, 9, 1, 5, 4, 7, 3, 9, 2, 8, 6, 6, 9, 8, 5, 4, 2, 3,
  1, 7, 8, 7, 9, 1, 5, 6, 4, 3, 2, 4, 1, 3, 2, 9, 8, 6, 7, 5, 5, 2, 6, 3, 7, 4,
  1, 9, 8,
];

export const RECTANGLE_INDICES: readonly number[] = [0, 6, 9, 15];

export const TWO_SOLUTION_GRID: SudokuGrid = FULL_GRID.map((v, i) =>
  RECTANGLE_INDICES.includes(i) ? 0 : v,
);

export const UNSOLVABLE_LEGAL_GRID: SudokuGrid = (() => {
  const grid = new Array<number>(81).fill(0);
  for (let c = 0; c < 8; c += 1) {
    grid[c] = c + 1;
  }
  grid[2 * 9 + 8] = 9;
  return grid;
})();

export const EMPTY_GRID: SudokuGrid = new Array<number>(81).fill(0);
