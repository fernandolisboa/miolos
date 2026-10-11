import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createSeededRandom, WEEKDAYS } from "../../src/index";
import {
  QUEENS_WEEKDAY_CRITERIA,
  countQueensSolutions,
  generateQueens,
  gradeQueens,
  isValidQueensSolution,
  validateQueens,
} from "../../src/queens/index";
import { repairRegions } from "../../src/queens/generate";
import {
  board,
  instrumentSolutions,
  isCanonical,
  isContiguous,
} from "./fixtures";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

describe("generateQueens", () => {
  // ADR-0055: worst contended local ms × 4, next 5_000 — P1 1987 → 10_000, P2 2317 → 10_000, P4 6920 → 30_000, Sundays 7208 → 30_000.
  it("P1 — generated puzzles are well-formed, unique and on the weekday ramp", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateQueens({ seed, weekday });
        const criteria = QUEENS_WEEKDAY_CRITERIA[weekday];
        expect(puzzle.size).toBe(criteria.size);
        expect(puzzle.seed).toBe(seed);
        expect(puzzle.weekday).toBe(weekday);
        expect(puzzle.regions).toHaveLength(criteria.size ** 2);
        expect(new Set(puzzle.regions).size).toBe(criteria.size);
        expect(isContiguous(puzzle)).toBe(true);
        expect(isCanonical(puzzle)).toBe(true);
        expect(isValidQueensSolution(puzzle, puzzle.solution)).toBe(true);
        expect(countQueensSolutions(puzzle, 3)).toBe(1);
        expect(validateQueens(puzzle)).toEqual({
          ok: true,
          advancedSteps: puzzle.advancedSteps,
        });
        const grade = gradeQueens(puzzle);
        expect(grade.solved).toBe(true);
        expect(grade.maxTier).toBeLessThanOrEqual(criteria.maxTier);
        expect(puzzle.advancedSteps).toBe(grade.advancedSteps);
        expect(puzzle.advancedSteps).toBeGreaterThanOrEqual(criteria.minSteps);
        expect(puzzle.advancedSteps).toBeLessThanOrEqual(criteria.maxSteps);
      }),
      { numRuns: 150 },
    );
  }, 10_000);

  it("P2 — determinism: same (seed, weekday) yields a deep-equal puzzle", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        expect(generateQueens({ seed, weekday })).toEqual(
          generateQueens({ seed, weekday }),
        );
      }),
      { numRuns: 100 },
    );
  }, 10_000);

  it("P3 — seed normalization: seeds alias modulo 2^32", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        expect(generateQueens({ seed: seed + 2 ** 32, weekday })).toEqual(
          generateQueens({ seed, weekday }),
        );
      }),
      { numRuns: 25 },
    );
  });

  it("P4 — the N!-permutation instrument finds exactly the planted solution", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateQueens({ seed, weekday });
        expect(instrumentSolutions(puzzle)).toEqual([puzzle.solution]);
      }),
      { numRuns: 60 },
    );
  }, 30_000);

  it("generates every Sunday of 200 fixed seeds within the attempt cap", () => {
    for (let seed = 0; seed < 200; seed += 1) {
      expect(generateQueens({ seed, weekday: 7 }).seed).toBe(seed);
    }
  }, 30_000);
});

describe("repairRegions", () => {
  it("gives up when every cell of the second solution is buried inside its region", () => {
    const six = board("111104 111144 211144 255344 555444 555444");
    const planted = [4, 8, 12, 21, 29, 31];
    const other = [4, 8, 12, 21, 25, 35];
    const asGrid = (cells: number[]) =>
      six.regions.map((_, cell) => (cells.includes(cell) ? 1 : 0));
    expect(instrumentSolutions(six)).toEqual([asGrid(other), asGrid(planted)]);
    const regions = [...six.regions];
    expect(repairRegions(6, regions, planted, createSeededRandom(1))).toBe(
      false,
    );
    expect(regions).toEqual(six.regions);
  });
});
