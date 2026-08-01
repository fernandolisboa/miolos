import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  BINAIRO_WEEKDAY_CRITERIA,
  countBinairoSolutions,
  generateBinairo,
  validateBinairo,
} from "../../src/binairo/index";
import type {
  BinairoCell,
  BinairoGrid,
  BinairoSolvedGrid,
} from "../../src/binairo/index";
import { WEEKDAYS } from "../../src/index";
import type { Weekday } from "../../src/index";

function rejectionReasons(
  givens: BinairoGrid,
  solution: BinairoSolvedGrid | undefined,
  weekday: Weekday,
): readonly string[] {
  const result = validateBinairo({ givens, solution }, weekday);
  expect(result.approved).toBe(false);
  return result.approved ? [] : result.reasons;
}

describe("BINAIRO_WEEKDAY_CRITERIA ramp shape", () => {
  it("pins the fixed ramp shape independent of band tuning", () => {
    expect(Object.keys(BINAIRO_WEEKDAY_CRITERIA)).toHaveLength(7);
    for (const weekday of WEEKDAYS) {
      const criteria = BINAIRO_WEEKDAY_CRITERIA[weekday];
      expect(criteria.minGivens).toBeLessThanOrEqual(criteria.maxGivens);
      expect(criteria.minTier).toBeLessThanOrEqual(criteria.maxTier);
      // Tier 3 is never allowed — the type already bounds tiers at 2.
      expect(criteria.maxTier).toBeLessThanOrEqual(2);
      if (weekday > 1) {
        const previous = BINAIRO_WEEKDAY_CRITERIA[(weekday - 1) as Weekday];
        // Bands monotonically non-increasing Monday→Sunday.
        expect(criteria.minGivens).toBeLessThanOrEqual(previous.minGivens);
        expect(criteria.maxGivens).toBeLessThanOrEqual(previous.maxGivens);
        // Tiers non-decreasing.
        expect(criteria.maxTier).toBeGreaterThanOrEqual(previous.maxTier);
        expect(criteria.minTier).toBeGreaterThanOrEqual(previous.minTier);
      }
    }
    expect(BINAIRO_WEEKDAY_CRITERIA[1].maxTier).toBe(1);
    expect(BINAIRO_WEEKDAY_CRITERIA[7].minTier).toBe(2);
  });
});

describe("validateBinairo", () => {
  // Deterministic fixtures via the generator (its properties are proved
  // in generate.test.ts).
  const monday = generateBinairo({ seed: 1, weekday: 1 });
  const sunday = generateBinairo({ seed: 1, weekday: 7 });

  it("rejects a Monday puzzle validated as Sunday (too easy, too many givens)", () => {
    const reasons = rejectionReasons(monday.givens, monday.solution, 7);
    // Monday: tier 1 < Sunday's minTier 2, and 34..40 givens > Sunday's 20.
    expect(reasons).toContain("too-easy");
    expect(reasons).toContain("too-many-givens");
  });

  it("rejects a Sunday puzzle validated as Monday (too hard, too few givens)", () => {
    const reasons = rejectionReasons(sunday.givens, sunday.solution, 1);
    // Sunday: tier 2 > Monday's maxTier 1, and 16..20 givens < Monday's 34.
    expect(reasons).toContain("too-hard");
    expect(reasons).toContain("too-few-givens");
  });

  it("rejects a malformed grid outright", () => {
    expect(rejectionReasons([0, 1, null], undefined, 1)).toEqual([
      "malformed-grid",
    ]);
  });

  it("rejects a puzzle the solver proves non-unique", () => {
    // Clear givens from a generated puzzle until uniqueness is lost.
    const givens: BinairoCell[] = [...sunday.givens];
    let ambiguous = false;
    for (let i = 0; i < givens.length && !ambiguous; i += 1) {
      if (givens[i] === null) {
        continue;
      }
      givens[i] = null;
      ambiguous = countBinairoSolutions(givens, 2) > 1;
    }
    expect(ambiguous).toBe(true);
    expect(rejectionReasons(givens, sunday.solution, 7)).toContain(
      "not-unique",
    );
  });

  it("rejects contradictory givens as unsolvable", () => {
    const givens: BinairoCell[] = new Array<BinairoCell>(64).fill(null);
    givens[0] = 1;
    givens[1] = 1;
    givens[2] = 1;
    expect(rejectionReasons(givens, undefined, 1)).toContain("unsolvable");
  });

  it("rejects a tampered solution", () => {
    // Flipping one cell breaks line balance — the solution is invalid.
    const tampered = monday.solution.map((cell, index): 0 | 1 =>
      index === 0 ? (cell === 0 ? 1 : 0) : cell,
    );
    expect(rejectionReasons(monday.givens, tampered, 1)).toContain(
      "solution-invalid",
    );
  });

  it("rejects a valid solution the givens contradict", () => {
    // The complement of a valid grid is valid (all four rules are
    // symmetric under 0↔1), yet every given contradicts it.
    const complement = monday.solution.map((cell): 0 | 1 =>
      cell === 0 ? 1 : 0,
    );
    expect(rejectionReasons(monday.givens, complement, 1)).toContain(
      "givens-contradict-solution",
    );
  });

  it("property — validator and counting solver agree on uniqueness", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 0xffffffff }),
        fc.constantFrom(...WEEKDAYS),
        fc.nat(63),
        (seed, weekday, drop) => {
          const puzzle = generateBinairo({ seed, weekday });
          const givenIndices = puzzle.givens.flatMap((cell, index) =>
            cell === null ? [] : [index],
          );
          const removeAt = givenIndices[drop % givenIndices.length];
          if (removeAt === undefined) {
            return;
          }
          const givens: BinairoCell[] = [...puzzle.givens];
          givens[removeAt] = null;
          const unique = countBinairoSolutions(givens, 2) === 1;
          const verdict = validateBinairo(
            { givens, solution: puzzle.solution },
            weekday,
          );
          if (!unique) {
            expect(verdict.approved).toBe(false);
            if (!verdict.approved) {
              expect(verdict.reasons).toContain("not-unique");
            }
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});
