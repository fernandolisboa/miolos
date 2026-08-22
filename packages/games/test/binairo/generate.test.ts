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

// The acceptance-criteria proofs: every invariant is re-proved by the
// independent counting solver — validated against hand-built fixtures in
// solver.test.ts — over the full uint32 seed domain x all seven weekdays.
// Run counts are a floor: never below 100 for P1/P2 (ADR-0023). Per-test
// timeouts follow ADR-0055 (CI/contended-local anchor x4, rounded up): a
// ceiling to diagnose against on failure, not a target to raise.

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
        // The validator approves its own generator.
        expect(
          validateBinairo(
            { givens: puzzle.givens, solution: puzzle.solution },
            weekday,
          ).approved,
        ).toBe(true);
      }),
      { numRuns: 150 },
    );
    // P1 and P2 share one timeout: same generator, arbitraries and seed
    // domain, differing only by run count, so both take the pair's measured
    // maximum rather than a per-test figure that would pin a scheduling
    // accident. Anchor = P2's 5922 ms (contended local, pooled over 11
    // samples); 5922 x4 = 23 688 -> 25 000 ms. P1's own were 3246 ms CI /
    // 5051 ms local. Tripwire: over budget / 2 = 12 500 ms is a defect to
    // diagnose and record while still green, never a number to raise.
    // In-file because ADR-0017 forbids a vitest config in this package;
    // the run count is floored by ADR-0023 and time is never bought by
    // sampling less. Reproduce contended figures with
    // `pnpm test --force --concurrency=10`, not a bare `pnpm test` (#114
    // caps turbo at 2).
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
    // Same 25 000 ms ceiling as P1, and for the same reason (see above).
    // P2 IS the pair's anchor at 5922 ms, and the only one of the two with a
    // recorded real CI failure — killed at >= 5165 ms against vitest's bare
    // 5000 ms default.
  }, 25_000);

  // P3 is deliberately left bare, and the verdict is recorded rather than
  // left to inference: 1776 ms contended local (35.5%) and 581 ms on CI
  // (11.6%), both under ADR-0055's 40%-of-budget trigger, so it earns no
  // explicit ceiling.
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
