import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BINAIRO_SIZE,
  BINAIRO_WEEKDAY_CRITERIA,
  countBinairoSolutions,
  generateBinairo,
  gradeBinairo,
  isValidBinairoSolution,
  validateBinairo,
} from "../../src/binairo/index";
import { WEEKDAYS } from "../../src/index";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

describe("generateBinairo", () => {
  it("P1 — generated puzzles are valid, unique, solvable and on-ramp", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateBinairo({ seed, weekday });
        const criteria = BINAIRO_WEEKDAY_CRITERIA[weekday];

        expect(puzzle.size).toBe(BINAIRO_SIZE);
        expect(puzzle.seed).toBe(seed);
        expect(puzzle.weekday).toBe(weekday);
        expect(isValidBinairoSolution(puzzle.solution)).toBe(true);
        expect(puzzle.givens).toHaveLength(BINAIRO_SIZE * BINAIRO_SIZE);
        for (let i = 0; i < puzzle.givens.length; i += 1) {
          const given = puzzle.givens[i];
          if (given !== null) {
            expect(given).toBe(puzzle.solution[i]);
          }
        }

        expect(countBinairoSolutions(puzzle.givens, 3)).toBe(1);
        expect(puzzle.givensCount).toBe(
          puzzle.givens.filter((cell) => cell !== null).length,
        );
        expect(puzzle.givensCount).toBeGreaterThanOrEqual(criteria.minGivens);
        expect(puzzle.givensCount).toBeLessThanOrEqual(criteria.maxGivens);
        const grade = gradeBinairo(puzzle.givens);
        expect(grade.requiredTier).toBe(puzzle.requiredTier);
        expect(puzzle.requiredTier).toBeGreaterThanOrEqual(criteria.minTier);
        expect(puzzle.requiredTier).toBeLessThanOrEqual(criteria.maxTier);

        expect(
          validateBinairo(
            { givens: puzzle.givens, solution: puzzle.solution },
            weekday,
          ).approved,
        ).toBe(true);
      }),
      { numRuns: 150 },
    );
  }, 25_000);

  it("P2 — determinism: same (seed, weekday) yields a deep-equal puzzle", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const a = generateBinairo({ seed, weekday });
        const b = generateBinairo({ seed, weekday });
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  }, 25_000);

  it("P3 — seed normalization: seeds alias modulo 2^32", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const a = generateBinairo({ seed, weekday });
        const b = generateBinairo({ seed: seed + 2 ** 32, weekday });
        expect(a).toEqual(b);
      }),
      { numRuns: 25 },
    );
  });
});
