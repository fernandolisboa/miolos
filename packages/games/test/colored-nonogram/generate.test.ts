import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { deriveColoredClues } from "../../src/colored-nonogram/clues";
import { generateColoredNonogram } from "../../src/colored-nonogram/generate";
import { solveColoredNonogram } from "../../src/colored-nonogram/solve";
import { FC_SEED, seedArb } from "../daily-arbitraries";
import { propertyRuns } from "../property-runs";
import { COLORED_SIZES } from "./fixtures";

const sizeArb = fc.constantFrom(...COLORED_SIZES);

describe("generateColoredNonogram", () => {
  it("maps a seed and a size to one puzzle", () => {
    fc.assert(
      fc.property(seedArb, sizeArb, (seed, size) => {
        expect(generateColoredNonogram(seed, size)).toEqual(
          generateColoredNonogram(seed, size),
        );
      }),
      { seed: FC_SEED, numRuns: propertyRuns(1000) },
    );
  });

  it("returns clues its solution derives and line-solves to", () => {
    fc.assert(
      fc.property(seedArb, sizeArb, (seed, size) => {
        const puzzle = generateColoredNonogram(seed, size);
        const { palette } = puzzle.clues;

        expect(Object.keys(puzzle).sort()).toEqual([
          "clues",
          "seed",
          "size",
          "solution",
          "tones",
        ]);
        expect(puzzle.size).toBe(size);
        expect(puzzle.seed).toBe(seed);
        expect(puzzle.tones).toBe(
          puzzle.solution.map((tone) => palette[tone - 1] ?? ".").join(""),
        );
        expect(deriveColoredClues(size, puzzle.tones)).toEqual(puzzle.clues);
        expect(solveColoredNonogram(puzzle.clues)).toEqual(puzzle.solution);
      }),
      { seed: FC_SEED, numRuns: propertyRuns(1000) },
    );
  });

  it("carries no motif id, which marks daily-scope bundles", () => {
    expect(JSON.stringify(generateColoredNonogram(7, 15))).not.toContain(
      "motifId",
    );
  });

  it("rejects a size with no coloured picture", () => {
    expect(() => generateColoredNonogram(1, 7)).toThrow(RangeError);
  });
});
