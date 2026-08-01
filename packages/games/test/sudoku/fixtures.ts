// Shared literal fixtures for the sudoku test files. FULL_GRID was produced
// once by the engine's own fillGrid (seed 1) and is self-checked by the
// tests that use it (isSudokuSolved, rectangle swap property).
import type { SudokuGrid } from "../../src/sudoku/index";

/** A complete valid grid (literal; validity asserted in solve.test.ts). */
export const FULL_GRID: SudokuGrid = [
  7, 8, 2, 4, 1, 5, 9, 6, 3, 9, 6, 1, 8, 2, 3, 7, 5, 4, 3, 4, 5, 9, 6, 7, 8, 2,
  1, 2, 3, 7, 6, 8, 1, 5, 4, 9, 1, 5, 4, 7, 3, 9, 2, 8, 6, 6, 9, 8, 5, 4, 2, 3,
  1, 7, 8, 7, 9, 1, 5, 6, 4, 3, 2, 4, 1, 3, 2, 9, 8, 6, 7, 5, 5, 2, 6, 3, 7, 4,
  1, 9, 8,
];

/**
 * Unavoidable-rectangle corners in FULL_GRID: rows 0 and 1 (same band),
 * columns 0 and 6 (different stacks), FULL_GRID[0] = FULL_GRID[15] = 7 and
 * FULL_GRID[6] = FULL_GRID[9] = 9. Blanking exactly these four cells yields
 * exactly two solutions (the digits 7/9 swap). The swap property itself is
 * asserted in solve.test.ts, so the fixture is self-checking.
 */
export const RECTANGLE_INDICES: readonly number[] = [0, 6, 9, 15];

/** FULL_GRID with the unavoidable rectangle blanked: exactly 2 solutions. */
export const TWO_SOLUTION_GRID: SudokuGrid = FULL_GRID.map((v, i) =>
  RECTANGLE_INDICES.includes(i) ? 0 : v,
);

/**
 * Legal-so-far but unsolvable 9-given grid (search-path zero-solution
 * fixture; plan 011 miscounted this construction as 10): row 0 holds
 * digits 1–8 in columns 0–7 with (0,8) empty, and digit 9 sits at (2,8).
 * Cell (0,8) then has zero candidates while the grid is duplicate-free.
 * Premises asserted in solve.test.ts.
 */
export const UNSOLVABLE_LEGAL_GRID: SudokuGrid = (() => {
  const grid = new Array<number>(81).fill(0);
  for (let c = 0; c < 8; c += 1) {
    grid[c] = c + 1;
  }
  grid[2 * 9 + 8] = 9;
  return grid;
})();

export const EMPTY_GRID: SudokuGrid = new Array<number>(81).fill(0);
