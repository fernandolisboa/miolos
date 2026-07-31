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

// The acceptance-criteria proofs (plan §4): every invariant is re-proved
// by the independent counting solver — validated against hand-built
// fixtures in solver.test.ts — over the full uint32 seed domain × all
// seven weekdays. Run counts are a floor: never below 100 for P1/P2.

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

describe("generateBinairo", () => {
  it("P1 — generated puzzles are valid, unique, solvable and on-ramp", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        // Not throwing is sampled evidence that the criteria table is
        // achievable (a cap error fails here loudly). Unlike solvable /
        // unique / deterministic, achievability has no construction-level
        // proof: "prove" is reserved for those three.
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
        // Independent re-proof of solvable (>= 1) and unique (== 1) in one
        // call; limit 3 so "exactly 1" is meaningful.
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
        // The validator approves its own generator — the #17 contract.
        expect(
          validateBinairo(
            { givens: puzzle.givens, solution: puzzle.solution },
            weekday,
          ).approved,
        ).toBe(true);
      }),
      { numRuns: 150 },
    );
  });

  it("P2 — determinism: same (seed, weekday) yields a deep-equal puzzle", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const a = generateBinairo({ seed, weekday });
        const b = generateBinairo({ seed, weekday });
        expect(a).toEqual(b);
      }),
      { numRuns: 100 },
    );
  });

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
