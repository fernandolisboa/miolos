import { generateBinairo } from "@miolos/games/binairo";
import { describe, expect, it } from "vitest";

import {
  binairoDailyContentSchema,
  DailyProjectionUnsupportedError,
  dailyBinairoResponseSchema,
  dailyPuzzleResponseSchema,
  stripDailyContent,
} from "../src/index";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/** Every key at any depth of a JSON-shaped value (the leak-scan probe). */
function collectKeys(
  value: unknown,
  into: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, into);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      collectKeys(nested, into);
    }
  }
  return into;
}

describe("stripDailyContent (binairo)", () => {
  it("output strict-parses and carries no solution/seed, real engine output, all 7 weekdays", () => {
    for (const weekday of WEEKDAYS) {
      const puzzle = generateBinairo({ seed: 1000 + weekday, weekday });
      const stripped = stripDailyContent("binairo", "2026-08-03", puzzle);
      expect(dailyPuzzleResponseSchema.parse(stripped)).toEqual(stripped);
      const keys = collectKeys(stripped);
      expect(keys.has("solution")).toBe(false);
      expect(keys.has("seed")).toBe(false);
      expect(keys.has("weekday")).toBe(false);
      expect(keys.has("givensCount")).toBe(false);
      expect(keys.has("requiredTier")).toBe(false);
      expect(stripped).toEqual({
        game: "binairo",
        date: "2026-08-03",
        size: 8,
        givens: puzzle.givens,
      });
    }
  });

  it("throws DailyProjectionUnsupportedError for sudoku (fail-closed until #23)", () => {
    expect(() => stripDailyContent("sudoku", "2026-08-03", {})).toThrow(
      DailyProjectionUnsupportedError,
    );
  });

  it("throws DailyProjectionUnsupportedError for nonogram (fail-closed until #25)", () => {
    expect(() => stripDailyContent("nonogram", "2026-08-03", {})).toThrow(
      DailyProjectionUnsupportedError,
    );
  });

  it("throws DailyProjectionUnsupportedError for termo (fail-closed until #27)", () => {
    expect(() => stripDailyContent("termo", "2026-08-03", {})).toThrow(
      DailyProjectionUnsupportedError,
    );
  });
});

describe("dailyBinairoResponseSchema", () => {
  it("rejects a payload smuggling solution (strictObject proof)", () => {
    const puzzle = generateBinairo({ seed: 42, weekday: 3 });
    const smuggled = {
      game: "binairo",
      date: "2026-08-03",
      size: 8,
      givens: puzzle.givens,
      solution: puzzle.solution,
    };
    expect(dailyBinairoResponseSchema.safeParse(smuggled).success).toBe(false);
    expect(dailyPuzzleResponseSchema.safeParse(smuggled).success).toBe(false);
  });
});

describe("binairoDailyContentSchema", () => {
  it("round-trips a generated puzzle", () => {
    const puzzle = generateBinairo({ seed: 7, weekday: 5 });
    expect(binairoDailyContentSchema.parse(puzzle)).toEqual(puzzle);
  });

  it("rejects a content payload with an unknown field (fail-closed drift, ADR-0024)", () => {
    const puzzle = generateBinairo({ seed: 7, weekday: 5 });
    const drifted = { ...puzzle, hint: "benign additive field" };
    expect(binairoDailyContentSchema.safeParse(drifted).success).toBe(false);
  });

  it("rejects a content payload missing the solution (shape mirror, not a subset)", () => {
    const { solution: _solution, ...withoutSolution } = generateBinairo({
      seed: 7,
      weekday: 5,
    });
    expect(binairoDailyContentSchema.safeParse(withoutSolution).success).toBe(
      false,
    );
  });
});
