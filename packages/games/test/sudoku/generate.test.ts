import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  SUDOKU_MAX_GENERATION_ATTEMPTS,
  SudokuGenerationError,
  countSudokuSolutions,
  generateDailySudoku,
  generateSudoku,
  getSudokuConflicts,
  gradeSudoku,
  isSudokuSolved,
  sudokuCriteriaForWeekday,
  validateSudoku,
  type SudokuApprovalCriteria,
  type Weekday,
} from "../../src/sudoku/index";
import { FULL_PROPERTIES, PR_GATE_RUNS, propertyRuns } from "../property-runs";

const FC_SEED = 220_022;
const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom<Weekday>(1, 2, 3, 4, 5, 6, 7);

const PINNED_SEED = 123456789;
const PINNED_WEEKDAY: Weekday = 4;
const PINNED_GIVENS: readonly number[] = [
  0, 3, 0, 0, 0, 7, 0, 0, 6, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 8, 4, 0, 2, 0,
  5, 0, 0, 0, 0, 0, 4, 0, 5, 0, 0, 0, 0, 6, 1, 0, 0, 9, 2, 0, 1, 0, 0, 0, 0, 0,
  0, 0, 8, 0, 1, 7, 0, 3, 0, 0, 0, 4, 6, 0, 9, 0, 0, 3, 7, 0, 3, 0, 0, 0, 0, 8,
  0, 0, 0,
];
const PINNED_SOLUTION: readonly number[] = [
  2, 3, 4, 5, 9, 7, 1, 8, 6, 6, 8, 5, 1, 3, 2, 9, 4, 7, 1, 7, 9, 8, 4, 6, 2, 3,
  5, 9, 2, 6, 3, 8, 4, 7, 5, 1, 7, 4, 3, 6, 1, 5, 8, 9, 2, 5, 1, 8, 2, 7, 9, 4,
  6, 3, 8, 9, 1, 7, 6, 3, 5, 2, 4, 4, 6, 2, 9, 5, 1, 3, 7, 8, 3, 5, 7, 4, 2, 8,
  6, 1, 9,
];

describe("the reduced pull-request sample (#126, ADR-0059)", () => {
  const asserted = (numRuns: number): (readonly [number, Weekday])[] => {
    const seen: (readonly [number, Weekday])[] = [];
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        seen.push([seed, weekday]);
      }),
      { seed: FC_SEED, numRuns },
    );
    return seen;
  };

  const drawn = (numRuns: number): readonly (readonly [number, Weekday])[] =>
    fc.sample(fc.tuple(seedArb, weekdayArb), { seed: FC_SEED, numRuns });

  it("is drawn by fc.assert itself, not by a lookalike that may diverge", () => {
    expect(drawn(PR_GATE_RUNS)).toEqual(asserted(PR_GATE_RUNS));
    expect(drawn(100)).toEqual(asserted(100));
  });

  it("draws every weekday, which is what sizes it at 25 and not less", () => {
    const weekdays = new Set(
      asserted(PR_GATE_RUNS).map(([, weekday]) => weekday),
    );
    expect([...weekdays].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(new Set(asserted(PR_GATE_RUNS).map(([seed]) => seed)).size).toBe(
      PR_GATE_RUNS,
    );
  });

  it("is a strict prefix of the full sample, so the gate proves a subset", () => {
    expect(asserted(100).slice(0, PR_GATE_RUNS)).toEqual(
      asserted(PR_GATE_RUNS),
    );
  });

  it("declares, in the run itself, which sample this run took", () => {
    expect(propertyRuns(100)).toBe(FULL_PROPERTIES ? 100 : PR_GATE_RUNS);
    expect(propertyRuns(35)).toBe(FULL_PROPERTIES ? 35 : PR_GATE_RUNS);
    expect(propertyRuns(10)).toBe(10);
  });
});

describe("generateSudoku / generateDailySudoku", () => {
  it("P1 — determinism: same (seed, weekday) yields deep-equal puzzles", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const first = generateDailySudoku({ seed, weekday });
        const second = generateDailySudoku({ seed, weekday });
        expect(second).toEqual(first);
      }),

      { seed: FC_SEED, numRuns: propertyRuns(100) },
    );
  }, 625_000);

  it("P1 — pinned regression: the literal expected puzzle for a fixed seed", () => {
    const puzzle = generateDailySudoku({
      seed: PINNED_SEED,
      weekday: PINNED_WEEKDAY,
    });
    expect(puzzle.givens).toEqual(PINNED_GIVENS);
    expect(puzzle.solution).toEqual(PINNED_SOLUTION);
    expect(puzzle.tier).toBe(3);
    expect(puzzle.clueCount).toBe(26);
    expect(puzzle.seed).toBe(PINNED_SEED);
  });

  it("P2 — solvability + uniqueness + integrity on every instance", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateDailySudoku({ seed, weekday });
        for (let i = 0; i < 81; i += 1) {
          const given = puzzle.givens[i]!;
          expect(given === 0 || given === puzzle.solution[i]).toBe(true);
        }
        expect(isSudokuSolved(puzzle.solution)).toBe(true);
        expect(puzzle.clueCount).toBe(
          puzzle.givens.filter((v) => v !== 0).length,
        );

        expect(countSudokuSolutions(puzzle.givens, 2)).toBe(1);
        expect(getSudokuConflicts(puzzle.givens)).toEqual([]);
      }),

      { seed: FC_SEED, numRuns: propertyRuns(100) },
    );
  }, 240_000);

  it("P3 — weekday ramp / approval on every instance", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const criteria = sudokuCriteriaForWeekday(weekday);
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(gradeSudoku(puzzle.givens)).toBe(criteria.tier);
        expect(puzzle.tier).toBe(criteria.tier);
        expect(puzzle.clueCount).toBeGreaterThanOrEqual(criteria.minClues);
        expect(puzzle.clueCount).toBeLessThanOrEqual(criteria.maxClues);
        expect(validateSudoku(puzzle, criteria)).toEqual({
          approved: true,
          tier: criteria.tier,
          clueCount: puzzle.clueCount,
        });
      }),

      { seed: FC_SEED, numRuns: propertyRuns(35) },
    );
  }, 100_000);

  it("P3 — deterministic full-week coverage for fixed seeds", () => {
    const weekdays: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];
    for (const seed of [7, 77, 777]) {
      for (const weekday of weekdays) {
        const criteria = sudokuCriteriaForWeekday(weekday);
        const puzzle = generateDailySudoku({ seed, weekday });
        expect(gradeSudoku(puzzle.givens)).toBe(criteria.tier);
        expect(validateSudoku(puzzle, criteria).approved).toBe(true);
      }
    }
  }, 60_000);

  it("throws the full failure contract when the attempt cap is hit", () => {
    const impossible: SudokuApprovalCriteria = {
      tier: 1,
      minClues: 17,
      maxClues: 17,
    };
    const seed = 424242;
    let caught: unknown;
    try {
      generateSudoku({ seed, criteria: impossible, maxAttempts: 2 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(SudokuGenerationError);
    expect(caught).toBeInstanceOf(Error);
    const typed = caught as SudokuGenerationError;
    expect(typed.attempts).toBe(2);
    expect(typed.seed).toBe(seed >>> 0);
    expect(typed.criteria).toBe(impossible);
    expect(typed.message).toContain(String(seed >>> 0));
    expect(typed.message).toContain("tier: 1");
    expect(typed.message).toContain("2 attempts");

    let again: unknown;
    try {
      generateSudoku({ seed, criteria: impossible, maxAttempts: 2 });
    } catch (error) {
      again = error;
    }
    const typedAgain = again as SudokuGenerationError;
    expect(typedAgain.attempts).toBe(typed.attempts);
    expect(typedAgain.seed).toBe(typed.seed);
    expect(typedAgain.criteria).toEqual(typed.criteria);
    expect(typedAgain.message).toBe(typed.message);
  });

  it("threads maxAttempts through generateDailySudoku", () => {
    expect(() =>
      generateDailySudoku({ seed: 0, weekday: 7, maxAttempts: 1 }),
    ).toThrow(SudokuGenerationError);
    let caught: unknown;
    try {
      generateDailySudoku({ seed: 0, weekday: 7, maxAttempts: 1 });
    } catch (error) {
      caught = error;
    }
    expect((caught as SudokuGenerationError).attempts).toBe(1);
  });

  it("exposes the measured default attempt cap", () => {
    expect(SUDOKU_MAX_GENERATION_ATTEMPTS).toBe(1200);
  });

  it("rejects invalid weekdays, criteria, and maxAttempts", () => {
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 0 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 8 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateDailySudoku({ seed: 1, weekday: 1.5 as Weekday }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 0 as never, minClues: 30, maxClues: 50 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 16, maxClues: 50 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 40, maxClues: 30 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 36, maxClues: 82 },
      }),
    ).toThrow(RangeError);
    expect(() =>
      generateSudoku({
        seed: 1,
        criteria: { tier: 1, minClues: 36, maxClues: 56 },
        maxAttempts: 0,
      }),
    ).toThrow(RangeError);
  });

  it("returns frozen puzzles (deep, including the composed object)", () => {
    const puzzle = generateDailySudoku({ seed: 5, weekday: 1 });
    expect(Object.isFrozen(puzzle)).toBe(true);
    expect(Object.isFrozen(puzzle.givens)).toBe(true);
    expect(Object.isFrozen(puzzle.solution)).toBe(true);
  });
});

describe("validateSudoku", () => {
  it("rejects a puzzle whose fields lie about the grid, naming the reasons", () => {
    const criteria = sudokuCriteriaForWeekday(1);
    const puzzle = generateDailySudoku({ seed: 5, weekday: 1 });
    expect(validateSudoku(puzzle, criteria)).toEqual({
      approved: true,
      tier: puzzle.tier,
      clueCount: puzzle.clueCount,
    });
    const wrongTier = validateSudoku(puzzle, sudokuCriteriaForWeekday(7));
    expect(wrongTier.approved).toBe(false);
    if (!wrongTier.approved) {
      expect(wrongTier.reasons).toContain("too-easy");
      expect(wrongTier.reasons).toContain("tier-mismatch");
    }
    const lyingCount = validateSudoku(
      { ...puzzle, clueCount: puzzle.clueCount + 1 },
      criteria,
    );
    expect(lyingCount.approved).toBe(false);
    if (!lyingCount.approved) {
      expect(lyingCount.reasons).toEqual(["clue-count-mismatch"]);
    }
    const lyingTier = validateSudoku({ ...puzzle, tier: 5 }, criteria);
    expect(lyingTier.approved).toBe(false);
    if (!lyingTier.approved) {
      expect(lyingTier.reasons).toEqual(["tier-mismatch"]);
    }
    const firstGivenIndex = puzzle.givens.findIndex((v) => v !== 0);
    const corrupted = puzzle.givens.map((v, i) =>
      i === firstGivenIndex ? (v % 9) + 1 : v,
    );
    const contradicted = validateSudoku(
      { ...puzzle, givens: corrupted },
      criteria,
    );
    expect(contradicted.approved).toBe(false);
    if (!contradicted.approved) {
      expect(contradicted.reasons).toContain("givens-contradict-solution");
    }

    expect(
      validateSudoku(
        { ...puzzle, givens: new Array<number>(80).fill(0) },
        criteria,
      ),
    ).toEqual({ approved: false, reasons: ["malformed-grid"] });
    expect(() =>
      validateSudoku(puzzle, { tier: 1, minClues: 16, maxClues: 50 }),
    ).toThrow(RangeError);
  });
});
