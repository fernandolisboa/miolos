import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { WEEKDAYS } from "../../src/weekday";
import { deriveClues } from "../../src/nonogram/clues";
import { generateNonogram } from "../../src/nonogram/generate";
import { MOTIFS } from "../../src/nonogram/motifs";
import { solveNonogram } from "../../src/nonogram/solve";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const weekdayArb = fc.constantFrom(...WEEKDAYS);

describe("generateNonogram", () => {
  it("central property: every generated puzzle is line-solvable to its reveal solution", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateNonogram(seed, weekday);
        const result = solveNonogram(puzzle.clues);
        expect(result.status).toBe("solved");
        const asBooleans = result.grid.map((row) =>
          row.map((cell) => cell === "filled"),
        );
        expect(asBooleans).toEqual(puzzle.reveal.solution);
      }),
      { numRuns: 200 },
    );
  });

  it("is deterministic: the same (seed, weekday) yields a deep-equal puzzle", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        expect(generateNonogram(seed, weekday)).toStrictEqual(
          generateNonogram(seed, weekday),
        );
      }),
      { numRuns: 100 },
    );
  });

  it("carries complete picture reveal data", () => {
    fc.assert(
      fc.property(seedArb, weekdayArb, (seed, weekday) => {
        const puzzle = generateNonogram(seed, weekday);
        expect(puzzle.reveal.name.trim().length).toBeGreaterThan(0);
        expect(MOTIFS.some((motif) => motif.id === puzzle.reveal.motifId)).toBe(
          true,
        );
        expect(puzzle.reveal.solution).toHaveLength(puzzle.size);
        for (const row of puzzle.reveal.solution) {
          expect(row).toHaveLength(puzzle.size);
        }
        expect(deriveClues(puzzle.reveal.solution)).toEqual(puzzle.clues);
      }),
      { numRuns: 100 },
    );
  });

  it("coerces the seed to uint32", () => {
    for (const weekday of WEEKDAYS) {
      const negative = generateNonogram(-1, weekday);
      const wrapped = generateNonogram(0xffffffff, weekday);
      expect(negative).toStrictEqual(wrapped);
      expect(negative.seed).toBe(0xffffffff);
    }
  });
});
