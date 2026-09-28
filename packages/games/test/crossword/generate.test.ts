import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CROSSWORD_MAX_GENERATION_ATTEMPTS,
  generateCrossword,
  generateFrom,
} from "../../src/crossword/generate";
import { CROSSWORD_TEMPLATES } from "../../src/crossword/templates";
import { CrosswordGenerationError } from "../../src/crossword/types";
import type { CrosswordPuzzle } from "../../src/crossword/types";
import { validateCrossword } from "../../src/crossword/validate";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });

function shapeOf(puzzle: CrosswordPuzzle): string {
  return puzzle.grid
    .map((row) => row.map((cell) => (cell === null ? "#" : ".")).join(""))
    .join("/");
}

describe("generateCrossword", () => {
  it("P1 — every generated puzzle validates", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const puzzle = generateCrossword(seed);
        expect(puzzle.seed).toBe(seed);
        expect(validateCrossword(puzzle)).toEqual({ ok: true, failures: [] });
      }),
      { numRuns: 100 },
    );
  });

  it("P2 — determinism: the same seed yields a deep-equal puzzle", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(generateCrossword(seed)).toEqual(generateCrossword(seed));
      }),
      { numRuns: 100 },
    );
  });

  it("P3 — seeds alias modulo 2^32", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        expect(generateCrossword(seed + 2 ** 32)).toEqual(
          generateCrossword(seed),
        );
      }),
      { numRuns: 25 },
    );
  });

  it("every shipped template is drawn and filled", () => {
    const drawn = new Set(
      Array.from({ length: 60 }, (_, seed) => shapeOf(generateCrossword(seed))),
    );
    expect(drawn).toEqual(
      new Set(CROSSWORD_TEMPLATES.map((template) => template.join("/"))),
    );
  });

  it("throws CrosswordGenerationError after every attempt fails", () => {
    const unfillable = ["mar", "casa", "praia"].map((word) => ({
      normalized: word,
      canonical: word,
      clue: word,
    }));
    let caught: unknown;
    try {
      generateFrom(7, unfillable);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CrosswordGenerationError);
    expect(caught).toMatchObject({
      seed: 7,
      attempts: CROSSWORD_MAX_GENERATION_ATTEMPTS,
    });
  });
});
