import { generateBinairo } from "@miolos/games/binairo";
import {
  generateNonogram,
  type NonogramPuzzle,
  type Weekday as NonogramWeekday,
} from "@miolos/games/nonogram";
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
  dailyNonogramResponseSchema,
  dailyPuzzleResponseSchema,
  dailySudokuResponseSchema,
  nonogramDailyContentSchema,
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

/**
 * Real nonogram engine output for a weekday. No memo and no timeout
 * constant, deliberately (plan 020 §19 "Timeouts"): generate+validate
 * measures 0.0354 ms on weekday 1 (5x5) and 0.1902 ms on weekday 7 (15x15),
 * and the one-off ~34 ms pool build is already memoized inside
 * `difficulty.ts`, so the whole seven-weekday sweep sits three orders of
 * magnitude under vitest's 5 000 ms default.
 */
function nonogramDaily(weekday: NonogramWeekday): NonogramPuzzle {
  return generateNonogram(20_260_803 + weekday, weekday);
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

  // The "throws for sudoku (fail-closed until #23)" case that stood here is
  // REPLACED by `describe("stripDailyContent (sudoku)")` below — #23 lands
  // the projection, so the throw is no longer the contract. nonogram and
  // termo keep theirs.

  // The "throws for nonogram (fail-closed until #25)" case that stood here is
  // REPLACED by `describe("stripDailyContent (nonogram)")` below — #25 lands
  // the projection, so the throw is no longer the contract. termo keeps its.

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

describe("stripDailyContent (nonogram)", () => {
  // T-CORE-S8 (plan 020 §19).
  it("projects exactly game/date/size/clues, real engine output, all 7 weekdays", () => {
    for (const weekday of WEEKDAYS) {
      const puzzle = nonogramDaily(weekday);
      const stripped = stripDailyContent("nonogram", "2026-08-03", puzzle);
      expect(dailyPuzzleResponseSchema.parse(stripped)).toEqual(stripped);
      expect(stripped).toEqual({
        game: "nonogram",
        date: "2026-08-03",
        size: puzzle.size,
        clues: puzzle.clues,
      });
      // The allowlist is the contract, so the key SET is asserted, not just
      // the absence of the withheld ones (ADR-0024 decision 3).
      expect(Object.keys(stripped).sort()).toEqual([
        "clues",
        "date",
        "game",
        "size",
      ]);
    }
  });

  // T-CORE-S9 (plan 020 §19) — the ADR-0004 leak scan for the third game,
  // and D1's mechanical proof: the whole reveal is withheld (ADR-0033).
  it("carries no forbidden daily key at any depth, all 7 weekdays", () => {
    for (const weekday of WEEKDAYS) {
      const stripped = stripDailyContent(
        "nonogram",
        "2026-08-03",
        nonogramDaily(weekday),
      );
      const keys = collectKeys(stripped);
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
    }
  });

  // T-CORE-S12 (plan 020 §19), mirroring the `clueCount` meaningfulness test
  // above. Without these three keys the scan would pass on a projection that
  // flattened the reveal's identity to top-level fields, which is exactly the
  // mistake `clueCount` was added to prevent at #23 (P2).
  it("counts motifId/name/mirrored as forbidden — the scan is meaningful for nonogram", () => {
    const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;
    expect(forbidden).toContain("motifId");
    expect(forbidden).toContain("name");
    expect(forbidden).toContain("mirrored");
  });
});

describe("dailyNonogramResponseSchema", () => {
  // T-CORE-S11 (plan 020 §19).
  it("rejects a payload smuggling reveal, seed or weekday (strictObject proof)", () => {
    const puzzle = nonogramDaily(7);
    const base = {
      game: "nonogram",
      date: "2026-08-03",
      size: puzzle.size,
      clues: puzzle.clues,
    };
    const smuggled = [
      { ...base, reveal: puzzle.reveal },
      { ...base, seed: puzzle.seed },
      { ...base, weekday: puzzle.weekday },
      // The identity flattened to top-level keys — the projection shape
      // FORBIDDEN_DAILY_KEYS' new members exist to catch (P2).
      { ...base, name: puzzle.reveal.name },
      { ...base, motifId: puzzle.reveal.motifId },
      { ...base, mirrored: puzzle.reveal.mirrored },
    ];
    expect(dailyNonogramResponseSchema.safeParse(base).success).toBe(true);
    expect(dailyPuzzleResponseSchema.safeParse(base).success).toBe(true);
    for (const payload of smuggled) {
      expect(dailyNonogramResponseSchema.safeParse(payload).success).toBe(
        false,
      );
      expect(dailyPuzzleResponseSchema.safeParse(payload).success).toBe(false);
    }
  });

  it("rejects a size that disagrees with clues.size", () => {
    const puzzle = nonogramDaily(1);
    const disagreeing = {
      game: "nonogram",
      date: "2026-08-03",
      size: 8,
      clues: puzzle.clues,
    };
    expect(dailyNonogramResponseSchema.safeParse(disagreeing).success).toBe(
      false,
    );
    expect(dailyPuzzleResponseSchema.safeParse(disagreeing).success).toBe(
      false,
    );
  });
});

describe("nonogramDailyContentSchema", () => {
  // T-CORE-S10 (plan 020 §19). The schema mirrors `NonogramPuzzle` exactly —
  // game, seed, weekday, size, clues, reveal and nothing else.
  it("round-trips generated puzzles, all 7 weekdays", () => {
    for (const weekday of WEEKDAYS) {
      const puzzle = nonogramDaily(weekday);
      expect(nonogramDailyContentSchema.parse(puzzle)).toEqual(puzzle);
    }
  });

  it("mirrors NonogramPuzzle's key set exactly — the round-trip alone cannot catch an added OPTIONAL field", () => {
    expect(Object.keys(nonogramDailyContentSchema.shape).sort()).toEqual(
      Object.keys(nonogramDaily(4)).sort(),
    );
  });

  it("rejects a content payload with the game key removed (N2 — the field that drains the buffer)", () => {
    // Nonogram is the only engine whose puzzle object carries `game`
    // (nonogram/types.ts:33, written at generate.ts:48). Omitting it from
    // this strictObject fails every pre-insert parse, drains the buffer one
    // day per day, and fires the depth alert.
    const puzzle = nonogramDaily(4);
    const withoutGame = {
      seed: puzzle.seed,
      weekday: puzzle.weekday,
      size: puzzle.size,
      clues: puzzle.clues,
      reveal: puzzle.reveal,
    };
    expect(nonogramDailyContentSchema.safeParse(withoutGame).success).toBe(
      false,
    );
    expect(nonogramDailyContentSchema.safeParse(puzzle).success).toBe(true);
  });

  it("rejects a content payload with an unknown field (fail-closed drift, ADR-0024)", () => {
    const drifted = { ...nonogramDaily(4), hint: "benign additive field" };
    expect(nonogramDailyContentSchema.safeParse(drifted).success).toBe(false);
  });

  it("rejects a size that disagrees with clues.size, and a size outside the ramp", () => {
    const puzzle = nonogramDaily(1);
    expect(
      nonogramDailyContentSchema.safeParse({ ...puzzle, size: 8 }).success,
    ).toBe(false);
    expect(
      nonogramDailyContentSchema.safeParse({
        ...puzzle,
        size: 20,
        clues: { ...puzzle.clues, size: 20 },
      }).success,
    ).toBe(false);
  });

  it("rejects truncated rows and truncated cols", () => {
    const puzzle = nonogramDaily(2);
    const shortRows = {
      ...puzzle,
      clues: { ...puzzle.clues, rows: puzzle.clues.rows.slice(0, -1) },
    };
    const shortCols = {
      ...puzzle,
      clues: { ...puzzle.clues, cols: puzzle.clues.cols.slice(0, -1) },
    };
    expect(nonogramDailyContentSchema.safeParse(shortRows).success).toBe(false);
    expect(nonogramDailyContentSchema.safeParse(shortCols).success).toBe(false);
  });

  it("rejects a non-square reveal.solution, short by a row and ragged by a cell", () => {
    const puzzle = nonogramDaily(2);
    const firstRow = puzzle.reveal.solution[0];
    if (firstRow === undefined) {
      throw new Error("fixture invariant: a generated solution has rows");
    }
    const shortSolution = {
      ...puzzle,
      reveal: {
        ...puzzle.reveal,
        solution: puzzle.reveal.solution.slice(0, -1),
      },
    };
    const raggedSolution = {
      ...puzzle,
      reveal: {
        ...puzzle.reveal,
        solution: [firstRow.slice(0, -1), ...puzzle.reveal.solution.slice(1)],
      },
    };
    expect(nonogramDailyContentSchema.safeParse(shortSolution).success).toBe(
      false,
    );
    expect(nonogramDailyContentSchema.safeParse(raggedSolution).success).toBe(
      false,
    );
  });

  it("rejects a [0] run — an all-empty line is [], never [0]", () => {
    // nonogram/types.ts:10 and clues.ts:22: the UI renders "0" for an empty
    // run list, so a stored [0] is drift, not data.
    const puzzle = nonogramDaily(2);
    const zeroRun = {
      ...puzzle,
      clues: {
        ...puzzle.clues,
        rows: [[0], ...puzzle.clues.rows.slice(1)],
      },
    };
    expect(nonogramDailyContentSchema.safeParse(zeroRun).success).toBe(false);
  });
});
