import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../../src/random";
import { CLASSIC_LAYOUT, geometryOf } from "../../src/sudoku/board";
import { DIAGONAL_LAYOUT } from "../../src/sudoku/generate";
import {
  SUDOKU_TIER_CRITERIA,
  countSudokuSolutions,
  generateSudoku,
  getSudokuConflicts,
  isSudokuSolved,
  solveSudoku,
  type SudokuGrid,
} from "../../src/sudoku/index";
import {
  countSolutionsInternal,
  fillGrid,
  fillVariant,
} from "../../src/sudoku/solve";
import {
  EMPTY_GRID,
  FULL_GRID,
  RECTANGLE_INDICES,
  TWO_SOLUTION_GRID,
  UNSOLVABLE_LEGAL_GRID,
} from "./fixtures";
import { PINNED_VARIANTS } from "./variant-fixtures";

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
    const [i1, i2, i3, i4] = RECTANGLE_INDICES;
    expect([i1, i2, i3, i4]).toEqual([0, 6, 9, 15]);
    const a = FULL_GRID[0]!;
    const b = FULL_GRID[6]!;
    expect(a).not.toBe(b);
    expect(FULL_GRID[15]).toBe(a);
    expect(FULL_GRID[9]).toBe(b);

    expect(countSudokuSolutions(TWO_SOLUTION_GRID, 2)).toBe(2);
    expect(countSudokuSolutions(TWO_SOLUTION_GRID, 3)).toBe(2);
  });

  it("counts 0 for a grid with a direct duplicate (immediate reject)", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 3 ? 5 : v));
    expect(countSudokuSolutions(grid, 2)).toBe(0);
    expect(solveSudoku(grid)).toBeNull();
  });

  it("counts 0 for a column duplicate (discriminates the column mask)", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 27 ? 5 : v));
    expect(countSudokuSolutions(grid, 2)).toBe(0);
    expect(solveSudoku(grid)).toBeNull();
  });

  it("counts 0 for a box duplicate (discriminates the box mask)", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 10 ? 5 : v));
    expect(countSudokuSolutions(grid, 2)).toBe(0);
    expect(solveSudoku(grid)).toBeNull();
  });

  it("counts 0 for a legal-so-far but unsolvable grid (search path)", () => {
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
        const puzzle = generateSudoku({
          seed,
          criteria: SUDOKU_TIER_CRITERIA[1],
        });
        expect(isSudokuSolved(puzzle.solution)).toBe(true);
      }),
      { seed: FC_SEED, numRuns: 25 },
    );
  });
});

describe("the solver under a variant layout (ADR-0130)", () => {
  const diagonalRepeats = (grid: SudokuGrid): readonly boolean[] =>
    DIAGONAL_LAYOUT.extraUnits.map(
      (unit) => new Set(unit.map((i) => grid[i])).size < 9,
    );
  const irregular = geometryOf({
    regions: PINNED_VARIANTS.irregular.regions,
    extraUnits: [],
  });
  const classicFill = (repeats: readonly boolean[]): number[] => {
    for (let seed = 0; ; seed += 1) {
      const grid = fillGrid(createSeededRandom(seed));
      if (diagonalRepeats(grid).join() === repeats.join()) {
        return grid;
      }
    }
  };

  it.each([
    ["main", [true, false]],
    ["anti", [false, true]],
  ] as const)(
    "counts a classic grid that repeats on the %s diagonal 1 classic, 0 diagonal",
    (_, repeats) => {
      const grid = classicFill(repeats);
      expect(countSolutionsInternal(grid, 2)).toBe(1);
      expect(countSolutionsInternal(grid, 2, geometryOf(DIAGONAL_LAYOUT))).toBe(
        0,
      );
    },
  );

  it("reads irregular regions, not boxes", () => {
    const repeatsIn = (grid: SudokuGrid, regions: readonly number[]) =>
      Array.from({ length: 9 }, (_, id) =>
        grid.filter((_, i) => regions[i] === id),
      ).some((digits) => new Set(digits).size < 9);
    expect(repeatsIn(FULL_GRID, PINNED_VARIANTS.irregular.regions)).toBe(true);
    expect(countSolutionsInternal(FULL_GRID, 2)).toBe(1);
    expect(countSolutionsInternal(FULL_GRID, 2, irregular)).toBe(0);

    const { solution } = PINNED_VARIANTS.irregular;
    expect(repeatsIn(solution, CLASSIC_LAYOUT.regions)).toBe(true);
    expect(countSolutionsInternal(solution, 2)).toBe(0);
    expect(countSolutionsInternal(solution, 2, irregular)).toBe(1);
  });

  it("finds exactly one solution for a pinned irregular puzzle", () => {
    const { givens } = PINNED_VARIANTS.irregular;
    expect(countSolutionsInternal(givens, 3, irregular)).toBe(1);
  });

  it("gives up on a fill past its node budget", () => {
    expect(fillVariant(irregular, createSeededRandom(5), 10)).toBeNull();
    const geometry = geometryOf(DIAGONAL_LAYOUT);
    const filled = fillVariant(geometry, createSeededRandom(5), 100_000);
    expect(filled).not.toBeNull();
    expect(countSolutionsInternal(filled!, 2, geometry)).toBe(1);
  });
});
