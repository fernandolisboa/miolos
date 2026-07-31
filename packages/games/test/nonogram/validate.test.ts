import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { WEEKDAYS } from "../../src/weekday";
import { WEEKDAY_CRITERIA } from "../../src/nonogram/difficulty";
import { generateNonogram } from "../../src/nonogram/generate";
import { effortScore, solveNonogram } from "../../src/nonogram/solve";
import {
  NonogramGenerationError,
  type NonogramPuzzle,
} from "../../src/nonogram/types";
import { validateNonogram } from "../../src/nonogram/validate";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

function tamper(
  puzzle: NonogramPuzzle,
  change: (solution: boolean[][]) => boolean[][],
): NonogramPuzzle {
  const solution = change(puzzle.reveal.solution.map((row) => [...row]));
  return { ...puzzle, reveal: { ...puzzle.reveal, solution } };
}

describe("validateNonogram", () => {
  it("approves every generated puzzle and enforces the weekday criteria", () => {
    // The issue's third acceptance criterion.
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateNonogram(seed, weekday);
        const criteria = WEEKDAY_CRITERIA[weekday];
        expect(validateNonogram(puzzle)).toEqual({ ok: true, failures: [] });
        expect(puzzle.size).toBe(criteria.size);
        const result = solveNonogram(puzzle.clues);
        const score = effortScore(result);
        expect(score).toBeGreaterThanOrEqual(criteria.minEffort);
        expect(score).toBeLessThan(criteria.maxEffort);
      }),
      { numRuns: 100 },
    );
  });

  it("rejects a tampered solution cell", () => {
    const puzzle = generateNonogram(7, 4);
    const tampered = tamper(puzzle, (solution) => {
      const row = solution[0];
      if (row !== undefined) {
        row[0] = !row[0];
      }
      return solution;
    });
    const verdict = validateNonogram(tampered);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain("clues-solution-mismatch");
  });

  it("rejects clues that do not match the solution", () => {
    const puzzle = generateNonogram(11, 2);
    const emptyClues = {
      size: puzzle.size,
      rows: Array.from({ length: puzzle.size }, (): number[] => []),
      cols: Array.from({ length: puzzle.size }, (): number[] => []),
    };
    const verdict = validateNonogram({ ...puzzle, clues: emptyClues });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain("clues-solution-mismatch");
    expect(verdict.failures).toContain("solved-grid-differs-from-solution");
  });

  it("rejects a wrong-size solution grid", () => {
    const puzzle = generateNonogram(13, 6);
    const truncated = tamper(puzzle, (solution) => solution.slice(1));
    const verdict = validateNonogram(truncated);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain("solution-dimensions-mismatch");
  });

  it("rejects a puzzle whose effort falls outside its weekday band", () => {
    // A valid Tuesday (easy-band 8×8) puzzle re-labeled as Wednesday
    // (hard-band 8×8): same size, consistent clues, out-of-band effort.
    const tuesday = generateNonogram(21, 2);
    const relabeled: NonogramPuzzle = { ...tuesday, weekday: 3 };
    const verdict = validateNonogram(relabeled);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toEqual(["effort-out-of-band"]);
  });

  it("rejects a size that does not match the weekday criteria", () => {
    const monday = generateNonogram(3, 1);
    const relabeled: NonogramPuzzle = { ...monday, weekday: 7 };
    const verdict = validateNonogram(relabeled);
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain("size-out-of-criteria");
  });

  it("exposes a typed generation error with seed, weekday and attempts", () => {
    // Constructed directly: the generator path is unreachable with valid
    // content (every pool entry is harness-proven).
    const error = new NonogramGenerationError(42, 5, 8);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("NonogramGenerationError");
    expect(error.seed).toBe(42);
    expect(error.weekday).toBe(5);
    expect(error.attempts).toBe(8);
    expect(error.message).toContain("42");
  });
});
