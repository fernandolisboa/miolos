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
import { grid, solved } from "./fixtures";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

const PINNED = [
  {
    seed: 20_261_013,
    weekday: 1,
    givens:
      "001.1101 .1....0. 001.011. 1101010. ..1.10.1 .0.1.01. 01..0... 1.00101.",
    solution:
      "00101101 11001001 00110110 11010100 00101011 10110010 01010101 11001010",
    givensCount: 39,
    requiredTier: 1,
  },
  {
    seed: 20_261_014,
    weekday: 4,
    givens:
      "......1. 1.0.0.11 01.0.001 ..1.01.. ...0..0. 0..010.. .......0 .11....0",
    solution:
      "10010110 10010011 01101001 00110110 11001001 00101011 11010100 01101100",
    givensCount: 25,
    requiredTier: 2,
  },
  {
    seed: 20_261_015,
    weekday: 7,
    givens:
      "..11...0 ..1100.. 1..0.... ......1. ....0..0 .1.1..0. .....0.. 10......",
    solution:
      "00110110 00110011 11001100 01001011 10110100 01010101 11001010 10101001",
    givensCount: 18,
    requiredTier: 2,
  },
] as const;

describe("generateBinairo", () => {
  it.each(PINNED)(
    "pins the literal puzzle and grade for seed $seed on weekday $weekday",
    ({ seed, weekday, givens, solution, givensCount, requiredTier }) => {
      const puzzle = generateBinairo({ seed, weekday });

      expect(puzzle).toEqual({
        size: BINAIRO_SIZE,
        seed,
        weekday,
        givens: grid(givens),
        solution: solved(solution),
        givensCount,
        requiredTier,
      });
      expect(gradeBinairo(puzzle.givens)).toEqual({
        solvable: true,
        unique: true,
        requiredTier,
      });
    },
  );

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
