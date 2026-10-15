import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  CROSSWORD_MAX_GENERATION_ATTEMPTS,
  generateCrossword,
  generateFrom,
} from "../../src/crossword/generate";
import { CROSSWORD_TEMPLATES } from "../../src/crossword/templates";
import { CrosswordGenerationError } from "../../src/crossword/types";
import type { CrosswordPuzzle, CrosswordSize } from "../../src/crossword/types";
import { validateCrossword } from "../../src/crossword/validate";

const seedArb = fc.integer({ min: 0, max: 0xffffffff });
const SIZES: readonly CrosswordSize[] = [5, 7];
// ADR-0055: CI gate ms × 4, next 5_000 — P1 side 7 3822 → 20_000; P2 side 5 2284 → 10_000, side 7 6222 → 25_000.
const TIMEOUT_MS: Readonly<
  Record<CrosswordSize, { p1: number | undefined; p2: number }>
> = {
  5: { p1: undefined, p2: 10_000 },
  7: { p1: 20_000, p2: 25_000 },
};

function shapeOf(puzzle: CrosswordPuzzle): string {
  return puzzle.grid
    .map((row) => row.map((cell) => (cell === null ? "#" : ".")).join(""))
    .join("/");
}

describe("generateCrossword", () => {
  for (const size of SIZES) {
    it(
      `P1 — every generated puzzle of side ${String(size)} validates`,
      () => {
        fc.assert(
          fc.property(seedArb, (seed) => {
            const puzzle = generateCrossword(seed, size);
            expect(puzzle.seed).toBe(seed);
            expect(puzzle.grid).toHaveLength(size);
            expect(validateCrossword(puzzle)).toEqual({
              ok: true,
              failures: [],
            });
          }),
          { numRuns: 100 },
        );
      },
      TIMEOUT_MS[size].p1,
    );

    it(
      `P2 — determinism: the same seed yields a deep-equal puzzle of side ${String(size)}`,
      () => {
        fc.assert(
          fc.property(seedArb, (seed) => {
            expect(generateCrossword(seed, size)).toEqual(
              generateCrossword(seed, size),
            );
          }),
          { numRuns: 100 },
        );
      },
      TIMEOUT_MS[size].p2,
    );
  }

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

  it.each(SIZES)(
    "every shipped template of side %i is drawn and filled",
    (size) => {
      const drawn = new Set(
        Array.from({ length: 60 }, (_, seed) =>
          shapeOf(generateCrossword(seed, size)),
        ),
      );
      expect(drawn).toEqual(
        new Set(
          CROSSWORD_TEMPLATES[size].map((template) => template.join("/")),
        ),
      );
    },
  );

  it("throws CrosswordGenerationError after every attempt fails", () => {
    const unfillable = ["mar", "casa", "praia"].map((word) => ({
      normalized: word,
      canonical: word,
      clue: word,
    }));
    let caught: unknown;
    try {
      generateFrom(7, 5, unfillable);
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
