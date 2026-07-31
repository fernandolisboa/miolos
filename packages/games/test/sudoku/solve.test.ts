import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  SUDOKU_TIER_CRITERIA,
  countSudokuSolutions,
  generateSudoku,
  getSudokuConflicts,
  isSudokuSolved,
  solveSudoku,
} from "../../src/sudoku/index";
import {
  EMPTY_GRID,
  FULL_GRID,
  RECTANGLE_INDICES,
  TWO_SOLUTION_GRID,
  UNSOLVABLE_LEGAL_GRID,
} from "./fixtures";

// Every fc.assert in test/sudoku/** pins { seed: FC_SEED, numRuns } so the
// sampled puzzle-seed set is identical on every CI run (plan §5, review B2).
const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });

describe("countSudokuSolutions / solveSudoku", () => {
  it("counts exactly 1 solution for a complete valid grid", () => {
    expect(isSudokuSolved(FULL_GRID)).toBe(true);
    expect(countSudokuSolutions(FULL_GRID)).toBe(1);
    expect(countSudokuSolutions(FULL_GRID, 3)).toBe(1);
    expect(solveSudoku(FULL_GRID)).toEqual(FULL_GRID);
  });

  it("still counts 1 after removing a single cell, and re-solves it", () => {
    const grid = FULL_GRID.map((v, i) => (i === 40 ? 0 : v));
    expect(countSudokuSolutions(grid, 2)).toBe(1);
    expect(solveSudoku(grid)).toEqual(FULL_GRID);
  });

  it("counts exactly 2 for the unavoidable-rectangle grid (self-checking fixture)", () => {
    // Self-check the rectangle premises: rows 0/1 share a band, columns 0/6
    // sit in different stacks, and the corners swap two distinct digits.
    const [i1, i2, i3, i4] = RECTANGLE_INDICES;
    expect([i1, i2, i3, i4]).toEqual([0, 6, 9, 15]);
    const a = FULL_GRID[0]!;
    const b = FULL_GRID[6]!;
    expect(a).not.toBe(b);
    expect(FULL_GRID[15]).toBe(a); // (r2,c2) === (r1,c1)
    expect(FULL_GRID[9]).toBe(b); // (r2,c1) === (r1,c2)

    expect(countSudokuSolutions(TWO_SOLUTION_GRID, 2)).toBe(2);
    expect(countSudokuSolutions(TWO_SOLUTION_GRID, 3)).toBe(2);
  });

  it("counts 0 for a grid with a direct duplicate (immediate reject)", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 3 ? 5 : v));
    expect(countSudokuSolutions(grid, 2)).toBe(0);
    expect(solveSudoku(grid)).toBeNull();
  });

  it("counts 0 for a legal-so-far but unsolvable grid (search path)", () => {
    // Premises: duplicate-free, 9 givens (digits 1-8 in row 0 plus the 9
    // at (2,8) — the plan's construction, which it miscounted as 10), and
    // cell (0,8) has zero candidates.
    expect(getSudokuConflicts(UNSOLVABLE_LEGAL_GRID)).toEqual([]);
    expect(UNSOLVABLE_LEGAL_GRID.filter((v) => v !== 0)).toHaveLength(9);
    expect(countSudokuSolutions(UNSOLVABLE_LEGAL_GRID, 2)).toBe(0);
    expect(solveSudoku(UNSOLVABLE_LEGAL_GRID)).toBeNull();
  });

  it("early-exits at the limit on the empty grid", () => {
    expect(countSudokuSolutions(EMPTY_GRID, 2)).toBe(2);
  });

  it("rejects malformed grids and a non-positive limit", () => {
    expect(() => countSudokuSolutions(new Array<number>(80).fill(0))).toThrow(
      TypeError,
    );
    expect(() =>
      countSudokuSolutions(EMPTY_GRID.map((v, i) => (i === 0 ? 1.5 : v))),
    ).toThrow(TypeError);
    expect(() =>
      countSudokuSolutions(EMPTY_GRID.map((v, i) => (i === 0 ? 10 : v))),
    ).toThrow(TypeError);
    expect(() => countSudokuSolutions(EMPTY_GRID, 0)).toThrow(RangeError);
    expect(() => solveSudoku(new Array<number>(82).fill(0))).toThrow(TypeError);
  });

  it("produces solved full grids from the seeded fill path", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const puzzle = generateSudoku(seed, SUDOKU_TIER_CRITERIA[1]);
        expect(isSudokuSolved(puzzle.solution)).toBe(true);
      }),
      { seed: FC_SEED, numRuns: 25 },
    );
  });
});
