import { generateBinairo } from "@miolos/games/binairo";
import {
  generateCrossword,
  type CrosswordPuzzle,
  type CrosswordSize as GamesCrosswordSize,
} from "@miolos/games/crossword";
import {
  generateNonogram,
  type NonogramPuzzle,
  type Weekday as NonogramWeekday,
} from "@miolos/games/nonogram";
import {
  generateMinesweeperDaily,
  validateMinesweeperDaily,
  MINESWEEPER_DAILY_SIZE,
  type MinesweeperDaily,
} from "@miolos/games/minesweeper";
import {
  generateQueens,
  isValidQueensSolution,
  type QueensPuzzle,
} from "@miolos/games/queens";
import {
  generateDailySudoku,
  type SudokuPuzzle,
  type Weekday,
} from "@miolos/games/sudoku";
import { MAX_GUESSES, normalizeWord, WORD_LENGTH } from "@miolos/games/termo";
import { TERMO_ANSWERS } from "@miolos/games/termo-answers";
import { describe, expect, expectTypeOf, it } from "vitest";

import {
  binairoDailyContentSchema,
  CROSSWORD_SIZES,
  crosswordDailyContentSchema,
  DAILY_MINESWEEPER_SIZE,
  DailyProjectionUnsupportedError,
  dailyBinairoResponseSchema,
  dailyCrosswordResponseSchema,
  dailyMinesweeperResponseSchema,
  dailyNonogramResponseSchema,
  dailyPuzzleResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  dailyTermoResponseSchema,
  minesweeperDailyContentSchema,
  nonogramDailyContentSchema,
  projectCrossword,
  queensDailyContentSchema,
  stripDailyContent,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
  type CrosswordDailyContent,
  type CrosswordSize,
  type MinesweeperDailyContent,
  type QueensDailyContent,
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
  it("T-CORE-S17: every curated answer parses, round-trips unchanged, and agrees with normalizeWord", () => {
    expect(TERMO_ANSWERS.length).toBe(626);
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

  it("T-CORE-S19: carries no forbidden daily key at any depth, over every curated answer", () => {
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

const CROSSWORD_SEEDS = Array.from({ length: 12 }, (_, i) => 20_260_928 + i);

function crosswordDaily(seed = CROSSWORD_SEEDS[0] ?? 0): CrosswordPuzzle {
  return generateCrossword(seed);
}

const SEVEN = generateCrossword(CROSSWORD_SEEDS[0] ?? 0, 7);

function whiteGrid(rowWidths: readonly number[]): string[][] {
  return rowWidths.map((width) => Array.from({ length: width }, () => "a"));
}

const square = (side: number): number[] =>
  Array.from({ length: side }, () => side);

const MALFORMED_GRIDS = [
  [],
  square(4),
  square(6),
  square(8),
  [5, 5, 5, 5, 5, 5, 5],
  [7, 7, 7, 7, 7],
  [5, 7, 5, 5, 5],
  [7, 7, 7, 5, 7, 7, 7],
].map(whiteGrid);

function whiteCrossword(
  grid: readonly (readonly string[])[],
  clue: Record<string, unknown> = {},
): unknown {
  return {
    game: "crossword",
    date: "2026-10-22",
    grid,
    clues: [
      {
        number: 1,
        direction: "across",
        row: 0,
        col: 0,
        length: 1,
        clue: "Letra",
        ...clue,
      },
    ],
  };
}

function mutableCrossword(): CrosswordDailyContent {
  return crosswordDailyContentSchema.parse(
    JSON.parse(JSON.stringify(crosswordDaily())),
  );
}

describe("crosswordDailyContentSchema", () => {
  it("T-CORE-S122: real engine output parses and round-trips unchanged, and the type is the engine's", () => {
    for (const seed of CROSSWORD_SEEDS) {
      const puzzle = crosswordDaily(seed);
      const parsed: CrosswordPuzzle = crosswordDailyContentSchema.parse(puzzle);
      expect(parsed).toEqual(puzzle);
    }
  });

  it("T-CORE-S122: strict at every level, and a malformed grid or entry fails", () => {
    const withTopLevelExtra = { ...mutableCrossword(), solution: [] };
    const withEntryExtra = mutableCrossword();
    Object.assign(withEntryExtra.entries[0] ?? {}, { answer: "x" });
    const withoutSeed: Partial<CrosswordDailyContent> = mutableCrossword();
    delete withoutSeed.seed;
    const shortGrid = mutableCrossword();
    shortGrid.grid.pop();
    const upperCell = mutableCrossword();
    upperCell.grid[0]?.splice(0, 1, "A");
    const noEntries = { ...mutableCrossword(), entries: [] };

    for (const drifted of [
      withTopLevelExtra,
      withEntryExtra,
      withoutSeed,
      shortGrid,
      upperCell,
      noEntries,
    ]) {
      expect(crosswordDailyContentSchema.safeParse(drifted).success).toBe(
        false,
      );
    }
  });
});

describe("stripDailyContent (crossword)", () => {
  it("T-CORE-S123: projects exactly game, date, grid and the clues, by allowlist, over real engine output", () => {
    for (const seed of CROSSWORD_SEEDS) {
      const puzzle = crosswordDaily(seed);
      const projected = stripDailyContent("crossword", "2026-09-28", puzzle);
      expect(dailyPuzzleResponseSchema.parse(projected)).toEqual(projected);
      const stripped = dailyCrosswordResponseSchema.parse(projected);

      expect(Object.keys(stripped).sort()).toEqual([
        "clues",
        "date",
        "game",
        "grid",
      ]);
      expect(stripped.grid).toEqual(puzzle.grid);
      expect(stripped.clues).toEqual(
        puzzle.entries.map((entry) => ({
          number: entry.number,
          direction: entry.direction,
          row: entry.row,
          col: entry.col,
          length: entry.normalized.length,
          clue: entry.clue,
        })),
      );

      const keys = collectKeys(stripped);
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden), forbidden).toBe(false);
      }
    }
  });

  it("T-CORE-S123: FORBIDDEN_DAILY_KEYS names every withheld crossword key", () => {
    for (const withheld of ["seed", "canonical", "normalized"]) {
      expect(FORBIDDEN_DAILY_KEYS).toContain(withheld);
    }
  });

  it("T-CORE-S123: a drifted content throws", () => {
    for (const drifted of [
      {},
      { ...crosswordDaily(), extra: true },
      { grid: crosswordDaily().grid, entries: crosswordDaily().entries },
      null,
    ]) {
      expect(() =>
        stripDailyContent("crossword", "2026-09-28", drifted),
      ).toThrow();
    }
  });
});

describe("dailyCrosswordResponseSchema", () => {
  const valid = dailyCrosswordResponseSchema.parse(
    stripDailyContent("crossword", "2026-09-28", crosswordDaily()),
  );
  const blockAt = ((): readonly [number, number] => {
    for (const [row, cells] of valid.grid.entries()) {
      const col = cells.indexOf(null);
      if (col !== -1) {
        return [row, col];
      }
    }
    throw new Error("no block in the fixture");
  })();

  function withClue(overrides: Record<string, unknown>): unknown {
    const [first, ...rest] = valid.clues;
    return { ...valid, clues: [{ ...first, ...overrides }, ...rest] };
  }

  it("T-CORE-S123: every clue cell must be in bounds and white", () => {
    expect(dailyCrosswordResponseSchema.parse(valid)).toEqual(valid);

    const [blockRow, blockCol] = blockAt;
    for (const body of [
      withClue({ row: 0, col: 3, direction: "across", length: 3 }),
      withClue({ row: 3, col: 0, direction: "down", length: 3 }),
      withClue({ row: -1 }),
      withClue({ row: blockRow, col: blockCol, length: 1 }),
      withClue({ extra: 1 }),
      withClue({ direction: "diagonal" }),
      { ...valid, clues: [] },
      { ...valid, seed: 1 },
    ]) {
      expect(
        dailyCrosswordResponseSchema.safeParse(body).success,
        JSON.stringify(body),
      ).toBe(false);
      expect(dailyPuzzleResponseSchema.safeParse(body).success).toBe(false);
    }
  });

  it("T-CORE-S131: a hostile clue length fails fast instead of walking a billion cells", () => {
    const started = Date.now();
    const result = dailyCrosswordResponseSchema.safeParse(
      withClue({ length: 1e9 }),
    );
    expect(result.success).toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("T-CORE-S123: the grid is a square of a side in CROSSWORD_SIZES, of a-z or null", () => {
    for (const grid of [
      valid.grid.slice(1),
      valid.grid.map((row) => row.slice(1)),
      valid.grid.map((row, index) =>
        index === 0 ? row.map((cell) => (cell === null ? null : "é")) : row,
      ),
      valid.grid.map((row, index) =>
        index === 0 ? row.map((cell) => (cell === null ? null : "ab")) : row,
      ),
    ]) {
      expect(
        dailyCrosswordResponseSchema.safeParse({ ...valid, grid }).success,
      ).toBe(false);
    }

    for (const side of CROSSWORD_SIZES) {
      const body = whiteCrossword(whiteGrid(square(side)));
      expect(dailyPuzzleResponseSchema.parse(body)).toEqual(body);
    }
    for (const grid of MALFORMED_GRIDS) {
      const label = JSON.stringify(grid.map((row) => row.length));
      expect(
        dailyPuzzleResponseSchema.safeParse(whiteCrossword(grid)).success,
        label,
      ).toBe(false);
      expect(
        crosswordDailyContentSchema.safeParse({ ...SEVEN, grid }).success,
        label,
      ).toBe(false);
    }
  });

  it("T-CORE-S191: a clue reaching row or column 6 fits a 7x7 grid and nothing narrower", () => {
    const edge = [
      { row: 6, col: 0, direction: "across", length: 7 },
      { row: 0, col: 6, direction: "down", length: 7 },
    ];
    for (const clue of edge) {
      const seven = whiteCrossword(whiteGrid(square(7)), clue);
      expect(dailyCrosswordResponseSchema.parse(seven)).toEqual(seven);
      for (const grid of [
        whiteGrid(square(5)),
        whiteGrid([7, 7, 7, 7, 7]),
        whiteGrid([5, 5, 5, 5, 5, 5, 5]),
      ]) {
        expect(
          dailyCrosswordResponseSchema.safeParse(whiteCrossword(grid, clue))
            .success,
          JSON.stringify(clue),
        ).toBe(false);
      }
    }
    expect(
      dailyCrosswordResponseSchema.safeParse(
        whiteCrossword(whiteGrid(square(7)), { row: 7 }),
      ).success,
    ).toBe(false);
  });
});

describe("projectCrossword", () => {
  it("T-CORE-S187: projects a 7x7 puzzle by allowlist", () => {
    const projected = projectCrossword("1970-01-01", SEVEN);

    expect(Object.keys(projected).sort()).toEqual([
      "clues",
      "date",
      "game",
      "grid",
    ]);
    expect(projected.grid).toEqual(SEVEN.grid);
    expect(projected.grid).toHaveLength(7);
    expect(projected.clues).toEqual(
      SEVEN.entries.map((entry) => ({
        number: entry.number,
        direction: entry.direction,
        row: entry.row,
        col: entry.col,
        length: entry.normalized.length,
        clue: entry.clue,
      })),
    );
    const keys = collectKeys(projected);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  });

  it("T-CORE-S187: projects exactly what the daily strip does at 5 and 7, and 5 and 7 are the sizes", () => {
    for (const seed of CROSSWORD_SEEDS) {
      for (const size of CROSSWORD_SIZES) {
        const puzzle = generateCrossword(seed, size);
        expect(projectCrossword("2026-09-28", puzzle)).toEqual(
          stripDailyContent("crossword", "2026-09-28", puzzle),
        );
      }
    }
    expect(CROSSWORD_SIZES).toEqual([5, 7]);
    expectTypeOf<CrosswordSize>().toEqualTypeOf<GamesCrosswordSize>();
  });

  it("T-CORE-S188: every daily shape and the strip accept the engine's 7x7 and 5x5 output", () => {
    for (const puzzle of [SEVEN, crosswordDaily()]) {
      const stripped = stripDailyContent("crossword", "2026-10-22", puzzle);

      expect(stripped).toEqual(projectCrossword("2026-10-22", puzzle));
      expect(dailyCrosswordResponseSchema.parse(stripped)).toEqual(stripped);
      expect(dailyPuzzleResponseSchema.parse(stripped)).toEqual(stripped);
      expect(crosswordDailyContentSchema.parse(puzzle)).toEqual(puzzle);
    }
  });
});

const queensDailies: readonly QueensPuzzle[] = WEEKDAYS.map((weekday) =>
  generateQueens({ seed: 20_261_011 + weekday, weekday }),
);

function mutableQueens(): QueensDailyContent {
  return queensDailyContentSchema.parse(
    JSON.parse(JSON.stringify(queensDailies[0])),
  );
}

describe("queensDailyContentSchema", () => {
  it("T-CORE-S132: real engine output parses and round-trips unchanged, with exactly the engine's keys", () => {
    for (const puzzle of queensDailies) {
      const parsed: Omit<QueensPuzzle, "weekday"> =
        queensDailyContentSchema.parse(puzzle);
      expect(parsed).toEqual(puzzle);
      expect(Object.keys(queensDailyContentSchema.shape).sort()).toEqual(
        Object.keys(puzzle).sort(),
      );
    }
  });

  it("T-CORE-S132: strict, sized and closed — an extra key, a missing key, a wrong size or a non-binary cell fails", () => {
    const withoutSteps: Partial<QueensDailyContent> = mutableQueens();
    delete withoutSteps.advancedSteps;
    const shortSolution = mutableQueens();
    shortSolution.solution.pop();
    const shortRegions = mutableQueens();
    shortRegions.regions.pop();

    for (const drifted of [
      { ...mutableQueens(), extra: true },
      withoutSteps,
      { ...mutableQueens(), size: 6 },
      { ...mutableQueens(), size: 10 },
      shortSolution,
      shortRegions,
      { ...mutableQueens(), solution: mutableQueens().solution.map(() => 2) },
      { ...mutableQueens(), weekday: 8 },
    ]) {
      expect(queensDailyContentSchema.safeParse(drifted).success).toBe(false);
    }
  });
});

describe("stripDailyContent (queens)", () => {
  it("T-CORE-S133: projects exactly game, date, size and regions, by allowlist, over real engine output of every weekday", () => {
    for (const puzzle of queensDailies) {
      const projected = stripDailyContent("queens", "2026-10-12", puzzle);
      expect(dailyPuzzleResponseSchema.parse(projected)).toEqual(projected);
      const stripped = dailyQueensResponseSchema.parse(projected);

      expect(stripped).toEqual({
        game: "queens",
        date: "2026-10-12",
        size: puzzle.size,
        regions: puzzle.regions,
      });
      expect(
        isValidQueensSolution(
          { size: stripped.size, regions: stripped.regions },
          puzzle.solution,
        ),
      ).toBe(true);

      const keys = collectKeys(stripped);
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden), forbidden).toBe(false);
      }
      expect(keys.has("weekday")).toBe(false);
    }
  });

  it("T-CORE-S133: FORBIDDEN_DAILY_KEYS names every withheld queens key but the weekday", () => {
    for (const withheld of ["solution", "seed", "advancedSteps"]) {
      expect(FORBIDDEN_DAILY_KEYS).toContain(withheld);
    }
  });

  it("T-CORE-S133: a region map must be size x size, use only ids 0..size-1, and use every one", () => {
    const valid = dailyQueensResponseSchema.parse(
      stripDailyContent("queens", "2026-10-12", queensDailies[0]),
    );
    const top = valid.size - 1;
    const missingId = valid.regions.map((id) => (id === top ? 0 : id));
    for (const body of [
      { ...valid, regions: valid.regions.slice(1) },
      { ...valid, regions: [...valid.regions, 0] },
      { ...valid, regions: [valid.size, ...valid.regions.slice(1)] },
      { ...valid, regions: [-1, ...valid.regions.slice(1)] },
      { ...valid, regions: [0.5, ...valid.regions.slice(1)] },
      { ...valid, regions: missingId },
      { ...valid, size: 8 },
      { ...valid, solution: [] },
    ]) {
      expect(dailyQueensResponseSchema.safeParse(body).success).toBe(false);
    }
  });
});

const minesweeperDailies: readonly MinesweeperDaily[] = WEEKDAYS.map(
  (weekday) =>
    generateMinesweeperDaily({ seed: 20_261_016 + weekday, weekday }),
);

function mutableMinesweeper(): MinesweeperDailyContent {
  return minesweeperDailyContentSchema.parse(
    JSON.parse(JSON.stringify(minesweeperDailies[0])),
  );
}

describe("minesweeperDailyContentSchema", () => {
  it("T-CORE-S200: core's daily size is the engine's, and real engine output of every weekday parses and round-trips with exactly the engine's keys", () => {
    expect(DAILY_MINESWEEPER_SIZE).toEqual(MINESWEEPER_DAILY_SIZE);
    for (const puzzle of minesweeperDailies) {
      const parsed: Omit<MinesweeperDaily, "weekday"> =
        minesweeperDailyContentSchema.parse(puzzle);
      expect(parsed).toEqual(puzzle);
      expect(Object.keys(minesweeperDailyContentSchema.shape).sort()).toEqual(
        Object.keys(puzzle).sort(),
      );
    }
  });

  it("T-CORE-S200: strict and sized — an extra key, a missing key, a wrong size, a non-binary cell or an out-of-range start fails", () => {
    const withoutStart: Partial<MinesweeperDailyContent> = mutableMinesweeper();
    delete withoutStart.start;
    const shortMines = mutableMinesweeper();
    shortMines.mines.pop();

    for (const drifted of [
      { ...mutableMinesweeper(), extra: true },
      withoutStart,
      { ...mutableMinesweeper(), rows: 9 },
      { ...mutableMinesweeper(), columns: 16 },
      shortMines,
      {
        ...mutableMinesweeper(),
        mines: mutableMinesweeper().mines.map(() => 2),
      },
      { ...mutableMinesweeper(), start: 160 },
      { ...mutableMinesweeper(), start: -1 },
      { ...mutableMinesweeper(), weekday: 8 },
    ]) {
      expect(minesweeperDailyContentSchema.safeParse(drifted).success).toBe(
        false,
      );
    }
  });
});

describe("stripDailyContent (minesweeper)", () => {
  it("T-CORE-S198: projects exactly game, date, rows, columns, mines and start, by allowlist, over real engine output of every weekday", () => {
    for (const puzzle of minesweeperDailies) {
      const projected = stripDailyContent("minesweeper", "2026-10-16", puzzle);
      expect(dailyPuzzleResponseSchema.parse(projected)).toEqual(projected);
      expect(dailyMinesweeperResponseSchema.parse(projected)).toEqual({
        game: "minesweeper",
        date: "2026-10-16",
        rows: puzzle.rows,
        columns: puzzle.columns,
        mines: puzzle.mines,
        start: puzzle.start,
      });

      const keys = collectKeys(projected);
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden), forbidden).toBe(false);
      }
      expect(keys.has("seed")).toBe(false);
      expect(keys.has("weekday")).toBe(false);
    }
  });

  it("T-CORE-S198: the projection holds rows x columns cells of 0 or 1, and a start in range whose 3x3 holds no mine", () => {
    const valid = dailyMinesweeperResponseSchema.parse(
      stripDailyContent("minesweeper", "2026-10-16", minesweeperDailies[0]),
    );
    const mined = (cell: number) =>
      valid.mines.map((mine, index) => (index === cell ? 1 : mine));
    const below = valid.start + valid.columns;
    const besideMines =
      below < valid.mines.length
        ? mined(below)
        : mined(valid.start - valid.columns);
    for (const body of [
      { ...valid, mines: valid.mines.slice(1) },
      { ...valid, mines: [...valid.mines, 0] },
      { ...valid, mines: valid.mines.map(() => 2) },
      { ...valid, mines: mined(valid.start) },
      { ...valid, mines: besideMines },
      { ...valid, start: 160 },
      { ...valid, start: 1.5 },
      { ...valid, rows: 9 },
      { ...valid, columns: 9 },
      { ...valid, seed: 1 },
      { ...valid, weekday: 5 },
    ]) {
      expect(
        dailyMinesweeperResponseSchema.safeParse(body).success,
        JSON.stringify(Object.keys(body)),
      ).toBe(false);
    }
  });
});

describe("dailyMinesweeperResponseSchema against the engine's validator", () => {
  it("T-CORE-S203: a mine moved into or just around the start's 3x3 is rejected exactly when validateMinesweeperDaily reports start-not-clear", () => {
    const puzzles = [0, 7_919].flatMap((offset) =>
      WEEKDAYS.map((weekday) =>
        generateMinesweeperDaily({ seed: 4_242 + offset + weekday, weekday }),
      ),
    );
    const verdicts = new Set<boolean>();
    for (const puzzle of puzzles) {
      const { rows, columns, start } = puzzle;
      const row = Math.floor(start / columns);
      const column = start % columns;
      const near = (cell: number, reach: number) =>
        Math.abs(Math.floor(cell / columns) - row) <= reach &&
        Math.abs((cell % columns) - column) <= reach;
      const donor = puzzle.mines.findIndex(
        (mine, cell) => mine === 1 && !near(cell, 2),
      );
      for (let cell = 0; cell < rows * columns; cell += 1) {
        if (!near(cell, 2) || puzzle.mines[cell] === 1) {
          continue;
        }
        const mines = puzzle.mines.map((mine, index) =>
          index === cell ? 1 : index === donor ? 0 : mine,
        );
        const verdict = validateMinesweeperDaily({ ...puzzle, mines });
        const notClear =
          !verdict.ok && verdict.failures.includes("start-not-clear");
        const accepted = dailyMinesweeperResponseSchema.safeParse({
          game: "minesweeper",
          date: "2026-10-16",
          rows,
          columns,
          mines,
          start,
        }).success;
        expect(accepted, `${String(puzzle.seed)} ${String(cell)}`).toBe(
          !notClear,
        );
        expect(notClear).toBe(near(cell, 1));
        verdicts.add(accepted);
      }
    }
    expect(verdicts).toEqual(new Set([true, false]));
  });
});
