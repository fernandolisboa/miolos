import { generateBinairo } from "@miolos/games/binairo";
import {
  generateDailySudoku,
  type SudokuPuzzle,
  type Weekday,
} from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  binairoDailyContentSchema,
  DailyProjectionUnsupportedError,
  dailyBinairoResponseSchema,
  dailyPuzzleResponseSchema,
  dailySudokuResponseSchema,
  stripDailyContent,
  sudokuDailyContentSchema,
} from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

/**
 * Real engine output per weekday, generated ONCE per run and shared by the
 * three describes below — the seven-weekday sweep costs 90 ms here and
 * re-generating per test would pay it three times for nothing.
 */
const sudokuDailies = new Map<Weekday, SudokuPuzzle>();

function sudokuDaily(weekday: Weekday): SudokuPuzzle {
  const cached = sudokuDailies.get(weekday);
  if (cached !== undefined) {
    return cached;
  }
  const puzzle = generateDailySudoku({ seed: 20_260_803 + weekday, weekday });
  sudokuDailies.set(weekday, puzzle);
  return puzzle;
}

/**
 * Every test that can be the first to touch `sudokuDaily` carries this.
 * Vitest's default per-test timeout is 5 000 ms and no config in this
 * package raises it (plan 018 §15, landmine 25). Arithmetic: the seven
 * weekdays measure 90 ms total on this machine (worst 34 ms, the tier-5
 * Sunday), a pathological seed has been measured at 346 ms for one puzzle
 * (plan 018 §19.6) and CI runners are ~4x slower (commit 271a935), so the
 * honest CI worst case is 7 x 346 x 4 ≈ 9.7 s.
 */
const SUDOKU_SWEEP_TIMEOUT_MS = 30_000;

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

  // The "throws for sudoku (fail-closed until #23)" case that stood here is
  // REPLACED by `describe("stripDailyContent (sudoku)")` below — #23 lands
  // the projection, so the throw is no longer the contract. nonogram and
  // termo keep theirs.

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

describe("stripDailyContent (sudoku)", () => {
  // T-CORE-S1 (plan 018 §15).
  it(
    "projects exactly game/date/givens/tier, real engine output, all 7 weekdays",
    () => {
      for (const weekday of WEEKDAYS) {
        const puzzle = sudokuDaily(weekday);
        const stripped = stripDailyContent("sudoku", "2026-08-03", puzzle);
        expect(dailyPuzzleResponseSchema.parse(stripped)).toEqual(stripped);
        expect(stripped).toEqual({
          game: "sudoku",
          date: "2026-08-03",
          givens: puzzle.givens,
          tier: puzzle.tier,
        });
        // The allowlist is the contract, so the key SET is asserted, not
        // just the absence of the withheld ones.
        expect(Object.keys(stripped).sort()).toEqual([
          "date",
          "game",
          "givens",
          "tier",
        ]);
      }
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  // T-CORE-S2 (plan 018 §15) — the ADR-0004 leak scan for the second game.
  it(
    "carries no forbidden daily key at any depth, all 7 weekdays",
    () => {
      for (const weekday of WEEKDAYS) {
        const stripped = stripDailyContent(
          "sudoku",
          "2026-08-03",
          sudokuDaily(weekday),
        );
        const keys = collectKeys(stripped);
        for (const forbidden of FORBIDDEN_DAILY_KEYS) {
          expect(keys.has(forbidden)).toBe(false);
        }
      }
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it("counts clueCount as forbidden — the scan is meaningful for sudoku (S22)", () => {
    // Without this key the leak scan above would pass on a projection that
    // shipped sudoku's clue metadata; #23 is the ticket `testing.ts`'s TSDoc
    // names as owing it.
    const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;
    expect(forbidden).toContain("clueCount");
  });
});

describe("dailySudokuResponseSchema", () => {
  // T-CORE-S4 (plan 018 §15).
  it(
    "rejects a payload smuggling solution or clueCount (strictObject proof)",
    () => {
      const puzzle = sudokuDaily(7);
      const base = {
        game: "sudoku",
        date: "2026-08-03",
        givens: puzzle.givens,
        tier: puzzle.tier,
      };
      const withSolution = { ...base, solution: puzzle.solution };
      const withClueCount = { ...base, clueCount: puzzle.clueCount };
      expect(dailySudokuResponseSchema.safeParse(base).success).toBe(true);
      expect(dailySudokuResponseSchema.safeParse(withSolution).success).toBe(
        false,
      );
      expect(dailyPuzzleResponseSchema.safeParse(withSolution).success).toBe(
        false,
      );
      expect(dailySudokuResponseSchema.safeParse(withClueCount).success).toBe(
        false,
      );
      expect(dailyPuzzleResponseSchema.safeParse(withClueCount).success).toBe(
        false,
      );
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );
});

describe("sudokuDailyContentSchema", () => {
  // T-CORE-S3 (plan 018 §15). The schema mirrors `SudokuPuzzle` exactly —
  // givens, solution, tier, clueCount, seed and nothing else.
  it(
    "round-trips a generated puzzle",
    () => {
      const puzzle = sudokuDaily(4);
      expect(sudokuDailyContentSchema.parse(puzzle)).toEqual(puzzle);
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "mirrors SudokuPuzzle's key set exactly — the round-trip alone cannot catch an added OPTIONAL field",
    () => {
      expect(Object.keys(sudokuDailyContentSchema.shape).sort()).toEqual(
        Object.keys(sudokuDaily(4)).sort(),
      );
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "rejects a content payload with an unknown field (fail-closed drift, ADR-0024)",
    () => {
      const drifted = { ...sudokuDaily(4), hint: "benign additive field" };
      expect(sudokuDailyContentSchema.safeParse(drifted).success).toBe(false);
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "rejects a content payload missing the solution (shape mirror, not a subset)",
    () => {
      const puzzle = sudokuDaily(4);
      const withoutSolution = {
        givens: puzzle.givens,
        tier: puzzle.tier,
        clueCount: puzzle.clueCount,
        seed: puzzle.seed,
      };
      expect(sudokuDailyContentSchema.safeParse(withoutSolution).success).toBe(
        false,
      );
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "rejects a 0 in the solution — a solved cell is never empty",
    () => {
      const puzzle = sudokuDaily(4);
      const holed = {
        ...puzzle,
        solution: [0, ...puzzle.solution.slice(1)],
      };
      expect(sudokuDailyContentSchema.safeParse(holed).success).toBe(false);
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "rejects an 80- and an 82-length grid on both givens and solution",
    () => {
      const puzzle = sudokuDaily(4);
      const short = { ...puzzle, givens: puzzle.givens.slice(0, 80) };
      const long = { ...puzzle, givens: [...puzzle.givens, 0] };
      const shortSolution = {
        ...puzzle,
        solution: puzzle.solution.slice(0, 80),
      };
      const longSolution = { ...puzzle, solution: [...puzzle.solution, 1] };
      expect(sudokuDailyContentSchema.safeParse(short).success).toBe(false);
      expect(sudokuDailyContentSchema.safeParse(long).success).toBe(false);
      expect(sudokuDailyContentSchema.safeParse(shortSolution).success).toBe(
        false,
      );
      expect(sudokuDailyContentSchema.safeParse(longSolution).success).toBe(
        false,
      );
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );

  it(
    "rejects a cell outside 0-9 and a tier outside 1-5",
    () => {
      const puzzle = sudokuDaily(4);
      expect(
        sudokuDailyContentSchema.safeParse({
          ...puzzle,
          givens: [10, ...puzzle.givens.slice(1)],
        }).success,
      ).toBe(false);
      expect(
        sudokuDailyContentSchema.safeParse({ ...puzzle, tier: 6 }).success,
      ).toBe(false);
    },
    SUDOKU_SWEEP_TIMEOUT_MS,
  );
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
    const puzzle = generateBinairo({ seed: 7, weekday: 5 });
    const withoutSolution = {
      size: puzzle.size,
      seed: puzzle.seed,
      weekday: puzzle.weekday,
      givens: puzzle.givens,
      givensCount: puzzle.givensCount,
      requiredTier: puzzle.requiredTier,
    };
    expect(binairoDailyContentSchema.safeParse(withoutSolution).success).toBe(
      false,
    );
  });
});
