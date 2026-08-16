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
    // Explicit timeout (ADR-0055 decisions 2 and 4). P1 and P2 are ONE
    // population: two properties over the same generator, the same
    // arbitraries and the same seed domain, differing only by 50 runs — and
    // their local ordering reverses between measurement sessions, so both
    // take the population maximum rather than a per-test figure that would
    // pin a scheduling accident. P1's own figures: 3246 ms on CI (gate run
    // 31888933252 — 64.9 % of vitest's 5000 ms default) and 5051 ms under
    // contended local fan-out. The pair's maximum is P2's 5922 ms (contended
    // local, pooled over 11 samples), so 5922 x 4 = 23 688 -> 25 000 ms.
    // P3 is deliberately left bare: 1776 ms contended local (35.5 %) and
    // 581 ms on CI (11.6 %), both under ADR-0055's 40 %-of-budget trigger.
    // A ceiling, not a target: over budget / 2 = 12 500 ms is a defect to
    // diagnose and record, never a number to raise — budget / 2 and not
    // budget / 4 because budget = anchor x 4, so budget / 4 IS the anchor
    // and would fire on any session that sets a new sample maximum, which
    // ADR-0055 decision 2 predicts as normal. In-file because
    // ADR-0017 forbids a vitest config here; the run count above is
    // untouched, because ADR-0023 floors it and time is never bought by
    // sampling less.
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
    // Explicit timeout (ADR-0055 decisions 2 and 4), the same 25 000 ms as
    // P1 for the same reason: one population, one number. P2's own figures
    // are the pair's anchor — 5922 ms under contended local fan-out (pooled
    // over 11 samples, the largest either property has produced) and 2667 ms
    // on CI (gate run 31888933252 — 53.3 % of vitest's 5000 ms default); it
    // is also the only one of the two with a recorded real CI failure,
    // killed at >= 5165 ms in gate run 31846743499. 5922 x 4 = 23 688 ->
    // 25 000 ms. A ceiling, not a target: over budget / 2 = 12 500 ms is a
    // defect to diagnose and record, never a number to raise — budget / 2
    // and not budget / 4 because budget = anchor x 4, so budget / 4 IS the
    // anchor and fires on the new sample maximum ADR-0055 decision 2
    // predicts as normal. In-file
    // because ADR-0017 forbids a vitest config here; the run count above is
    // untouched per ADR-0023.
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
