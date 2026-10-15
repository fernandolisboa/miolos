import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { geometryOf } from "../../src/sudoku/board";
import { DIAGONAL_LAYOUT } from "../../src/sudoku/generate";
import { gradeInternal } from "../../src/sudoku/grade";
import {
  generateDailySudoku,
  gradeSudoku,
  solveSudoku,
  type Weekday,
} from "../../src/sudoku/index";
import { FULL_GRID, TECHNIQUE_FIXTURES, TWO_SOLUTION_GRID } from "./fixtures";
import { PINNED_VARIANTS } from "./variant-fixtures";

const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);

describe("gradeSudoku", () => {
  it("grades a naked-singles-only puzzle 1", () => {
    const givens = FULL_GRID.map((v, i) =>
      i === 0 || i === 13 || i === 26 ? 0 : v,
    );
    expect(gradeSudoku(givens)).toBe(1);
    expect(gradeInternal([...givens]).techniques.has("nakedSingle")).toBe(true);
  });

  it("grades a complete legal grid 1", () => {
    expect(gradeSudoku(FULL_GRID)).toBe(1);
  });

  it.each(TECHNIQUE_FIXTURES)(
    "grades the $technique fixture exactly $tier and fires the technique",
    ({ technique, tier, givens }) => {
      expect(gradeSudoku(givens)).toBe(tier);
      const result = gradeInternal([...givens]);
      expect(result.grade).toBe(tier);
      expect(result.techniques.has(technique)).toBe(true);
    },
  );

  it('grades the 2-solution rectangle grid "beyond" (ladder stalls)', () => {
    expect(gradeSudoku(TWO_SOLUTION_GRID)).toBe("beyond");
  });

  it("is pure: grading the same grid twice gives identical results", () => {
    const fixture = TECHNIQUE_FIXTURES[0]!;
    expect(gradeSudoku(fixture.givens)).toBe(gradeSudoku(fixture.givens));
  });

  it("solves generated puzzles to the recorded solution end-to-end (redundant cross-check)", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(solveSudoku(puzzle.givens)).toEqual(puzzle.solution);
      }),
      { seed: FC_SEED, numRuns: 25 },
    );
  }, 60000);

  it("reaches the recorded solution through the ladder itself (spike-verified invariant)", () => {
    const weekdays: readonly Weekday[] = [1, 4, 7];
    for (const seed of [11, 22, 33]) {
      for (const weekday of weekdays) {
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(gradeInternal([...puzzle.givens]).solved).toEqual(
          puzzle.solution,
        );
      }
    }
  }, 60000);

  it("rejects malformed grids", () => {
    expect(() => gradeSudoku(new Array<number>(80).fill(0))).toThrow(TypeError);
  });
});

describe("locked candidates under a variant layout (ADR-0130)", () => {
  it.each([
    ["diagonal", DIAGONAL_LAYOUT],
    [
      "irregular",
      { regions: PINNED_VARIANTS.irregular.regions, extraUnits: [] },
    ],
  ] as const)(
    "solves the pinned %s puzzle only by locking candidates across its units",
    (variant, layout) => {
      const { givens, solution } = PINNED_VARIANTS[variant];
      const result = gradeInternal(givens, geometryOf(layout));
      expect(result.grade).toBe(3);
      expect(result.techniques).toEqual(
        new Set(["nakedSingle", "hiddenSingle", "pointing", "claiming"]),
      );
      expect(result.solved).toEqual(solution);
    },
  );
});
