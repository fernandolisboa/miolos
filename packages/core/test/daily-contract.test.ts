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
import {
  MAX_GUESSES,
  normalizeWord,
  TERMO_ANSWERS,
  WORD_LENGTH,
} from "@miolos/games/termo";
import { describe, expect, it } from "vitest";

import {
  binairoDailyContentSchema,
  DailyProjectionUnsupportedError,
  dailyBinairoResponseSchema,
  dailyNonogramResponseSchema,
  dailyPuzzleResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  nonogramDailyContentSchema,
  stripDailyContent,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "../src/index";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "../src/testing";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

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

const SUDOKU_SWEEP_TIMEOUT_MS = 30_000;

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
});

describe("DailyProjectionUnsupportedError (unreachable, still exported)", () => {
  it("is still exported, still an Error, and still carries the game it was built for", () => {
    const error = new DailyProjectionUnsupportedError("termo");
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("DailyProjectionUnsupportedError");
    expect(error.game).toBe("termo");
  });
});

describe("stripDailyContent (sudoku)", () => {
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
    const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;
    expect(forbidden).toContain("clueCount");
  });
});

describe("dailySudokuResponseSchema", () => {
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

      expect(Object.keys(stripped).sort()).toEqual([
        "clues",
        "date",
        "game",
        "size",
      ]);
    }
  });

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

  it("counts motifId/name/mirrored as forbidden — the scan is meaningful for nonogram", () => {
    const forbidden: readonly string[] = FORBIDDEN_DAILY_KEYS;
    expect(forbidden).toContain("motifId");
    expect(forbidden).toContain("name");
    expect(forbidden).toContain("mirrored");
  });
});

describe("dailyNonogramResponseSchema", () => {
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
    const short = nonogramDailyContentSchema.safeParse(shortSolution);
    const ragged = nonogramDailyContentSchema.safeParse(raggedSolution);
    expect(short.success).toBe(false);
    expect(ragged.success).toBe(false);

    expect(short.error?.issues.map((issue) => issue.message)).toContain(
      "reveal.solution must be size x size",
    );
    expect(ragged.error?.issues.map((issue) => issue.message)).toContain(
      "reveal.solution must be size x size",
    );
  });

  it("rejects a [0] run — an all-empty line is [], never [0]", () => {
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

describe("termoDailyContentSchema", () => {
  it("T-CORE-S17: all 400 curated answers parse, round-trip unchanged, and agree with normalizeWord", () => {
    expect(TERMO_ANSWERS.length).toBe(400);
    for (const answer of TERMO_ANSWERS) {
      const parsed = termoDailyContentSchema.parse(answer);
      expect(parsed).toEqual({
        canonical: answer.canonical,
        normalized: answer.normalized,
      });

      expect(normalizeWord(answer.canonical)).toBe(answer.normalized);
    }
  });

  it("T-CORE-S17: a 401st answer carrying an extra field fails (fail-closed drift, ADR-0024)", () => {
    const [first] = TERMO_ANSWERS;
    if (first === undefined) {
      throw new Error("unreachable: TERMO_ANSWERS is empty");
    }

    expect(
      termoDailyContentSchema.safeParse({ ...first, index: 0 }).success,
    ).toBe(false);
    expect(
      termoDailyContentSchema.safeParse({ ...first, seed: 12 }).success,
    ).toBe(false);
    expect(
      termoDailyContentSchema.safeParse({ ...first, game: "termo" }).success,
    ).toBe(false);
  });

  it("T-CORE-S17: rejects a missing field and a non-ASCII normalized form", () => {
    expect(
      termoDailyContentSchema.safeParse({ canonical: "sarau" }).success,
    ).toBe(false);
    expect(
      termoDailyContentSchema.safeParse({ normalized: "sarau" }).success,
    ).toBe(false);

    expect(
      termoDailyContentSchema.safeParse({
        canonical: "então",
        normalized: "então",
      }).success,
    ).toBe(false);
    expect(
      termoDailyContentSchema.safeParse({
        canonical: "então",
        normalized: "ENTAO",
      }).success,
    ).toBe(false);
  });

  it("T-CORE-S18a: the literal 5 is the ENGINE's WORD_LENGTH, and MAX_GUESSES is 6", () => {
    expect(WORD_LENGTH).toBe(5);
    expect(MAX_GUESSES).toBe(6);
    expect(
      termoDailyContentSchema.safeParse({
        canonical: "a".repeat(WORD_LENGTH),
        normalized: "a".repeat(WORD_LENGTH),
      }).success,
    ).toBe(true);
    for (const length of [WORD_LENGTH - 1, WORD_LENGTH + 1]) {
      expect(
        termoDailyContentSchema.safeParse({
          canonical: "a".repeat(length),
          normalized: "a".repeat(length),
        }).success,
        `length ${String(length)} must fail both fields`,
      ).toBe(false);
    }
  });

  it("T-CORE-S18a: `.length(5)` counts JS characters, so an accented answer of five letters passes", () => {
    const accented = TERMO_ANSWERS.filter(
      (answer) => answer.canonical !== answer.normalized,
    );
    expect(accented.length).toBeGreaterThan(0);
    for (const answer of accented) {
      expect(termoDailyContentSchema.safeParse(answer).success).toBe(true);
    }
  });
});

describe("stripDailyContent (termo)", () => {
  const CONTENT = { canonical: "então", normalized: "entao" };

  it("T-CORE-S19: projects EXACTLY game/date — the whole contract is negative", () => {
    const stripped = stripDailyContent("termo", "2026-08-03", CONTENT);
    expect(stripped).toEqual({ game: "termo", date: "2026-08-03" });
    expect(Object.keys(stripped).sort()).toEqual(["date", "game"]);
    expect(dailyPuzzleResponseSchema.parse(stripped)).toEqual(stripped);
  });

  it("T-CORE-S19: carries no forbidden daily key at any depth, over all 400 answers", () => {
    for (const answer of TERMO_ANSWERS) {
      const stripped = stripDailyContent("termo", "2026-08-03", answer);
      const keys = collectKeys(stripped);

      expect(keys.has("game")).toBe(true);
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden)).toBe(false);
      }
    }
  });

  it("T-CORE-S19: a projection carrying canonical or normalized fails the response schema", () => {
    for (const smuggled of [
      { game: "termo", date: "2026-08-03", canonical: "então" },
      { game: "termo", date: "2026-08-03", normalized: "entao" },
      { game: "termo", date: "2026-08-03", answer: "entao" },
    ]) {
      expect(dailyTermoResponseSchema.safeParse(smuggled).success).toBe(false);
      expect(dailyPuzzleResponseSchema.safeParse(smuggled).success).toBe(false);
    }
  });

  it("T-CORE-S19: a drifted content THROWS — a 200 has to mean playable", () => {
    for (const drifted of [
      {},
      { canonical: "então" },
      { canonical: "então", normalized: "entao", index: 3 },
      { canonical: "cafe", normalized: "cafe" },
      null,
    ]) {
      expect(() => stripDailyContent("termo", "2026-08-03", drifted)).toThrow();
    }
  });

  it("T-CORE-S19: the date is projected verbatim and a malformed one fails", () => {
    expect(stripDailyContent("termo", "2026-12-31", CONTENT)).toEqual({
      game: "termo",
      date: "2026-12-31",
    });
    expect(() => stripDailyContent("termo", "31/12/2026", CONTENT)).toThrow();
  });
});
