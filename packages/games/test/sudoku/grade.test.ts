import fc from "fast-check";
import { describe, expect, it } from "vitest";

// gradeInternal is a test-only internal (not on the public barrel): it
// exposes the ladder's own solved grid and the set of techniques that fired.
import { gradeInternal, type SudokuTechnique } from "../../src/sudoku/grade";
import {
  generateDailySudoku,
  gradeSudoku,
  solveSudoku,
  type SudokuGrid,
  type SudokuTier,
  type Weekday,
} from "../../src/sudoku/index";
import { FULL_GRID, TWO_SOLUTION_GRID } from "./fixtures";

// Every fc.assert in test/sudoku/** pins { seed: FC_SEED, numRuns } so the
// sampled puzzle-seed set is identical on every CI run.
const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);

// Engine-generated literal puzzles, one per detection rule, produced with
// the engine during implementation and pinned as literals.
// No unchecked trust rides on how each was found: the test below fully
// re-verifies every fixture (exact tier AND the named technique firing in
// the gradeInternal trace). To regenerate after a ladder change: scan
// generateSudoku over seeds and keep the first puzzle per rule whose
// gradeInternal(...).techniques trace fires it at the target tier, then
// pin the new literals here.
const TECHNIQUE_FIXTURES: readonly {
  readonly technique: SudokuTechnique;
  readonly tier: SudokuTier;
  readonly givens: SudokuGrid;
}[] = [
  {
    technique: "hiddenSingle",
    tier: 2,
    givens: [
      0, 0, 5, 0, 3, 0, 9, 0, 1, 0, 0, 0, 7, 8, 0, 0, 0, 5, 2, 0, 9, 1, 0, 0, 0,
      0, 8, 0, 9, 1, 0, 0, 8, 3, 7, 0, 0, 0, 0, 0, 0, 0, 0, 1, 9, 0, 7, 0, 9, 0,
      0, 0, 0, 0, 0, 0, 7, 0, 0, 0, 2, 0, 0, 0, 6, 4, 0, 0, 5, 0, 0, 7, 0, 5, 2,
      0, 7, 4, 0, 0, 0,
    ],
  },
  {
    technique: "pointing",
    tier: 3,
    givens: [
      3, 0, 0, 5, 0, 6, 8, 0, 2, 0, 2, 0, 9, 4, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 0, 0, 0, 4, 0, 0, 0, 0, 0, 9, 0, 5, 0, 0, 3, 0, 7, 0, 0, 0, 0, 8, 5,
      0, 0, 0, 0, 1, 7, 0, 6, 0, 0, 0, 0, 8, 6, 0, 0, 0, 0, 0, 0, 9, 0, 0, 9, 0,
      0, 8, 0, 4, 0, 0,
    ],
  },
  {
    technique: "claiming",
    tier: 3,
    givens: [
      5, 0, 0, 0, 9, 1, 0, 0, 0, 3, 9, 0, 0, 0, 0, 6, 1, 0, 4, 0, 0, 6, 0, 0, 0,
      0, 0, 9, 0, 0, 3, 0, 0, 4, 0, 0, 8, 0, 0, 0, 7, 2, 0, 0, 1, 0, 0, 0, 0, 0,
      0, 5, 9, 0, 0, 0, 8, 0, 1, 5, 7, 0, 0, 0, 0, 0, 0, 0, 0, 0, 5, 4, 1, 0, 0,
      0, 0, 0, 0, 8, 0,
    ],
  },
  {
    technique: "nakedPair",
    tier: 4,
    givens: [
      5, 9, 0, 0, 0, 8, 0, 2, 7, 2, 0, 0, 3, 0, 4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      3, 0, 0, 0, 5, 0, 0, 1, 0, 0, 0, 0, 7, 0, 6, 0, 0, 3, 9, 0, 0, 6, 0, 9, 3,
      5, 0, 0, 0, 0, 0, 4, 0, 5, 7, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 4, 8,
    ],
  },
  {
    technique: "hiddenPair",
    tier: 4,
    givens: [
      0, 9, 5, 1, 0, 0, 0, 3, 0, 0, 4, 0, 0, 7, 6, 0, 9, 0, 0, 6, 0, 0, 0, 4, 0,
      0, 8, 0, 0, 0, 3, 2, 0, 4, 0, 0, 2, 8, 9, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 1, 7, 0, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 0, 0, 6,
      4, 0, 0, 0, 0, 0,
    ],
  },
  {
    technique: "nakedTriple",
    tier: 5,
    givens: [
      0, 0, 0, 2, 0, 0, 4, 0, 0, 0, 6, 0, 0, 0, 9, 0, 0, 0, 0, 4, 0, 0, 7, 5, 9,
      0, 3, 0, 8, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 5, 9, 2, 0, 0,
      0, 1, 6, 0, 0, 0, 9, 0, 0, 7, 0, 0, 0, 0, 0, 5, 9, 0, 0, 0, 2, 0, 0, 0, 0,
      0, 3, 0, 8, 0, 9,
    ],
  },
  {
    technique: "hiddenTriple",
    tier: 5,
    givens: [
      0, 2, 0, 0, 0, 0, 0, 3, 0, 9, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 8, 0, 4, 0,
      1, 0, 0, 0, 5, 0, 9, 7, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 2, 8, 0, 0, 0, 0, 0,
      0, 0, 0, 4, 7, 0, 0, 6, 0, 0, 3, 0, 0, 0, 0, 0, 0, 8, 5, 0, 7, 0, 0, 0, 0,
      0, 4, 1, 0, 0, 9,
    ],
  },
  {
    technique: "xWingRows",
    tier: 5,
    givens: [
      3, 0, 0, 5, 0, 6, 8, 0, 2, 0, 2, 0, 9, 4, 0, 0, 0, 7, 0, 0, 0, 0, 0, 0, 0,
      0, 1, 0, 0, 0, 4, 0, 0, 0, 0, 0, 9, 8, 0, 0, 0, 3, 0, 7, 4, 0, 0, 0, 8, 5,
      0, 0, 0, 0, 1, 7, 0, 6, 0, 0, 0, 2, 8, 6, 0, 0, 0, 0, 0, 0, 9, 0, 0, 9, 0,
      0, 8, 0, 4, 0, 0,
    ],
  },
  {
    technique: "xWingCols",
    tier: 5,
    givens: [
      8, 0, 0, 9, 0, 0, 0, 0, 3, 3, 9, 0, 0, 4, 0, 7, 0, 0, 0, 0, 6, 0, 1, 0, 9,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 7, 5, 0, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0,
      7, 0, 0, 4, 5, 0, 0, 1, 0, 0, 0, 0, 2, 6, 0, 0, 2, 0, 8, 0, 0, 0, 0, 0, 3,
      0, 0, 9, 5, 1, 0,
    ],
  },
];

describe("gradeSudoku", () => {
  it("grades a naked-singles-only puzzle 1", () => {
    // FULL_GRID minus three cells sharing no unit: each is a naked single.
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
    // Belt-and-suspenders: follows from P2 + counter correctness; kept
    // because it exercises solveSudoku's public path and catches gross
    // wiring mistakes cheaply.
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(solveSudoku(puzzle.givens)).toEqual(puzzle.solution);
      }),
      { seed: FC_SEED, numRuns: 25 },
    );
    // Explicit timeout: Sundays cost ~140 ms mean (spike-measured); the pin
    // lives here because ADR-0017 forbids a vitest config.
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
