import {
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import { dailyPuzzles, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday, type Weekday } from "@miolos/games";
import {
  NONOGRAM_WEEKDAY_CRITERIA,
  validateNonogram,
  type NonogramPuzzle,
} from "@miolos/games/nonogram";
import { sudokuCriteriaForWeekday, validateSudoku } from "@miolos/games/sudoku";
import { TERMO_ANSWERS } from "@miolos/games/termo";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import {
  drawUniformIndex,
  MAX_BINAIRO_SEED_RETRIES_PER_DATE,
  MAX_NONOGRAM_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_RUN,
  TopUpAbortedError,
  topUpBinairoBuffer,
  topUpNonogramBuffer,
  topUpSudokuBuffer,
  topUpTermoBuffer,
  uniformDrawLimit,
} from "../src/publishing/service";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { insertControl } = vi.hoisted(() => ({
  insertControl: { throwOnCall: 0, calls: 0 },
}));

vi.mock("@miolos/db/publishing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/publishing")>();
  return {
    ...actual,
    insertDailyPuzzle: async (
      ...args: Parameters<typeof actual.insertDailyPuzzle>
    ) => {
      insertControl.calls += 1;
      if (insertControl.calls === insertControl.throwOnCall) {
        throw new Error("simulated insert failure");
      }
      return actual.insertDailyPuzzle(...args);
    },
  };
});

const { generation } = vi.hoisted(() => ({
  generation: {
    failWeekdays: new Set<number>(),
    calls: 0,
    rejectValidator: false,
    injectStrayKey: false,
  },
}));

const { nonogram } = vi.hoisted(() => {
  const state: {
    failWeekdays: Set<number>;
    calls: number;

    forceWeekday: Weekday | undefined;

    lastPuzzle: NonogramPuzzle | undefined;
    rejectValidator: boolean;
    injectStrayKey: boolean;
  } = {
    failWeekdays: new Set(),
    calls: 0,
    forceWeekday: undefined,
    lastPuzzle: undefined,
    rejectValidator: false,
    injectStrayKey: false,
  };
  return { nonogram: state };
});

const { binairo } = vi.hoisted(() => ({
  binairo: {
    failWeekdays: new Set<number>(),
    calls: 0,
    rejectValidator: false,
    injectStrayKey: false,
  },
}));

vi.mock("@miolos/games/nonogram", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@miolos/games/nonogram")>();
  return {
    ...actual,
    generateNonogram: (
      seed: Parameters<typeof actual.generateNonogram>[0],
      weekday: Parameters<typeof actual.generateNonogram>[1],
    ) => {
      nonogram.calls += 1;
      if (nonogram.failWeekdays.has(weekday)) {
        throw new actual.NonogramGenerationError(
          seed,
          weekday,
          actual.NONOGRAM_MAX_GENERATION_ATTEMPTS,
        );
      }
      const puzzle = actual.generateNonogram(
        seed,
        nonogram.forceWeekday ?? weekday,
      );
      nonogram.lastPuzzle = puzzle;
      return nonogram.injectStrayKey ? { ...puzzle, stray: 1 } : puzzle;
    },
    validateNonogram: (
      puzzle: Parameters<typeof actual.validateNonogram>[0],
    ) => {
      if (nonogram.rejectValidator) {
        return { ok: false, failures: ["clues-solution-mismatch"] };
      }
      return actual.validateNonogram(puzzle);
    },
  };
});

vi.mock("@miolos/games/sudoku", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/games/sudoku")>();
  return {
    ...actual,
    generateDailySudoku: (
      options: Parameters<typeof actual.generateDailySudoku>[0],
    ) => {
      generation.calls += 1;
      if (generation.failWeekdays.has(options.weekday)) {
        throw new actual.SudokuGenerationError(
          options.seed,
          actual.sudokuCriteriaForWeekday(options.weekday),
          actual.SUDOKU_MAX_GENERATION_ATTEMPTS,
        );
      }
      const puzzle = actual.generateDailySudoku(options);
      return generation.injectStrayKey ? { ...puzzle, stray: 1 } : puzzle;
    },
    validateSudoku: (
      puzzle: Parameters<typeof actual.validateSudoku>[0],
      criteria: Parameters<typeof actual.validateSudoku>[1],
    ) => {
      if (generation.rejectValidator) {
        return { approved: false, reasons: ["too-hard"] };
      }
      return actual.validateSudoku(puzzle, criteria);
    },
  };
});

vi.mock("@miolos/games/binairo", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/games/binairo")>();
  return {
    ...actual,
    generateBinairo: (
      options: Parameters<typeof actual.generateBinairo>[0],
    ) => {
      binairo.calls += 1;
      if (binairo.failWeekdays.has(options.weekday)) {
        throw new actual.BinairoGenerationError(
          options.seed,
          options.weekday,
          actual.BINAIRO_MAX_GENERATION_ATTEMPTS,
        );
      }
      const puzzle = actual.generateBinairo(options);
      return binairo.injectStrayKey ? { ...puzzle, stray: 1 } : puzzle;
    },
    validateBinairo: (
      puzzle: Parameters<typeof actual.validateBinairo>[0],
      weekday: Parameters<typeof actual.validateBinairo>[1],
    ) => {
      if (binairo.rejectValidator) {
        return { approved: false, reasons: ["too-hard"] };
      }
      return actual.validateBinairo(puzzle, weekday);
    },
  };
});

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  insertControl.throwOnCall = 0;
  insertControl.calls = 0;
  generation.failWeekdays.clear();
  generation.calls = 0;
  generation.rejectValidator = false;
  generation.injectStrayKey = false;
  nonogram.failWeekdays.clear();
  nonogram.calls = 0;
  nonogram.forceWeekday = undefined;
  nonogram.lastPuzzle = undefined;
  nonogram.rejectValidator = false;
  nonogram.injectStrayKey = false;
  binairo.failWeekdays.clear();
  binairo.calls = 0;
  binairo.rejectValidator = false;
  binairo.injectStrayKey = false;
});

afterAll(async () => {
  await ctx.close();
});

async function sudokuRows(): Promise<{ date: string; content: unknown }[]> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows
    .filter((row) => row.game === "sudoku")
    .map((row) => ({ date: row.date, content: row.content }));
}

async function nonogramRows(): Promise<
  { date: string; seed: number; content: unknown }[]
> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows
    .filter((row) => row.game === "nonogram")
    .map((row) => ({ date: row.date, seed: row.seed, content: row.content }));
}

async function binairoRows(): Promise<{ date: string; content: unknown }[]> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows
    .filter((row) => row.game === "binairo")
    .map((row) => ({ date: row.date, content: row.content }));
}

function weekdayOf(date: string): Weekday {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  return weekday;
}

describe("topUpBinairoBuffer", () => {
  it("T-API-S185: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);

    binairo.failWeekdays.add(weekdayOf(doomedDate));

    const result = await topUpBinairoBuffer(ctx.db, 7);

    expect(result.generated).toBe(6);
    expect(result.depth).toBe(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(doomedDate);
    expect(result.failures[0]?.reason).toContain(
      "Binairo generation exhausted",
    );
    const dates = (await binairoRows()).map((row) => row.date).sort();
    expect(dates).not.toContain(doomedDate);
    expect(dates).toHaveLength(6);

    expect(binairo.calls).toBe(6 + MAX_BINAIRO_SEED_RETRIES_PER_DATE);
  }, 30_000);

  it("T-API-S186: a validator that always rejects retries the full per-date budget", async () => {
    binairo.rejectValidator = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpBinairoBuffer(ctx.db, 1);

    expect(result.generated).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(today);
    expect(result.failures[0]?.reason).toMatch(/^validator rejected:/);
    expect(binairo.calls).toBe(MAX_BINAIRO_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S187: a schema rejection stops the date after one attempt", async () => {
    binairo.injectStrayKey = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpBinairoBuffer(ctx.db, 1);

    expect(result.generated).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(today);
    expect(result.failures[0]?.reason).toMatch(/^content schema rejected:/);
    expect(binairo.calls).toBe(1);
  });

  it("T-API-S188: a throw mid-run aborts with the partial count and failures gathered so far", async () => {
    insertControl.throwOnCall = 4;

    let caught: unknown;
    try {
      await topUpBinairoBuffer(ctx.db, 7);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TopUpAbortedError);
    const aborted = caught as TopUpAbortedError;
    expect(aborted.partial.generated).toBe(3);
    expect(aborted.partial.failures).toEqual([]);
  }, 30_000);
});

describe("topUpSudokuBuffer", () => {
  it("covers a full week with content the strict contract and the weekday criteria both accept", async () => {
    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 7, depth: 7, failures: [] });
    const rows = await sudokuRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const content = sudokuDailyContentSchema.parse(row.content);
      const weekday = isoWeekdayOf(row.date);
      if (!isWeekday(weekday)) {
        throw new Error(`unreachable: bad weekday for ${row.date}`);
      }
      const verdict = validateSudoku(
        content,
        sudokuCriteriaForWeekday(weekday),
      );
      expect(verdict.approved).toBe(true);
    }
  }, 30_000);

  it("T-API-S7: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);
    const doomedWeekday = isoWeekdayOf(doomedDate);

    generation.failWeekdays.add(doomedWeekday);

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result.generated).toBe(6);
    expect(result.depth).toBe(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(doomedDate);
    expect(result.failures[0]?.reason).toContain("No approved Sudoku found");
    const dates = (await sudokuRows()).map((row) => row.date).sort();
    expect(dates).not.toContain(doomedDate);
    expect(dates).toHaveLength(6);

    expect(generation.calls).toBe(6 + MAX_SUDOKU_SEED_RETRIES_PER_DATE);
  }, 30_000);

  it("T-API-S16: the RUN-scoped budget bounds total attempts, not depth x per-date", async () => {
    for (const weekday of [1, 2, 3, 4, 5, 6, 7]) {
      generation.failWeekdays.add(weekday);
    }
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(generation.calls).toBe(MAX_SUDOKU_SEED_RETRIES_PER_RUN);
    expect(result.generated).toBe(0);
    expect(result.depth).toBe(0);
    expect(result.failures.map((failure) => failure.date)).toEqual(
      Array.from({ length: 7 }, (_, offset) => addDays(today, offset)),
    );

    const datesThatReallyTried =
      MAX_SUDOKU_SEED_RETRIES_PER_RUN / MAX_SUDOKU_SEED_RETRIES_PER_DATE;
    for (const failure of result.failures.slice(0, datesThatReallyTried)) {
      expect(failure.reason).toContain("No approved Sudoku found");
    }
    for (const failure of result.failures.slice(datesThatReallyTried)) {
      expect(failure.reason).toBe("run seed-retry budget exhausted");
    }
  }, 30_000);

  it("an already-covered date is never charged against the run budget", async () => {
    await topUpSudokuBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const hole = addDays(today, 5);
    await ctx.db.execute(
      sql`delete from daily_puzzles where game = 'sudoku' and date = ${hole}`,
    );
    generation.calls = 0;

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 1, depth: 7, failures: [] });
    expect(generation.calls).toBe(1);
  }, 30_000);

  it("T-API-S186: a validator that always rejects retries the full per-date budget", async () => {
    generation.rejectValidator = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpSudokuBuffer(ctx.db, 1);

    expect(result.generated).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(today);
    expect(result.failures[0]?.reason).toMatch(/^validator rejected:/);
    expect(generation.calls).toBe(MAX_SUDOKU_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S187: a schema rejection burns the run budget, one attempt per date", async () => {
    generation.injectStrayKey = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpSudokuBuffer(ctx.db, 7);

    expect(generation.calls).toBe(MAX_SUDOKU_SEED_RETRIES_PER_RUN);
    expect(result.failures).toHaveLength(7);
    const schemaRejected = result.failures.slice(
      0,
      MAX_SUDOKU_SEED_RETRIES_PER_RUN,
    );
    const budgetExhausted = result.failures.slice(
      MAX_SUDOKU_SEED_RETRIES_PER_RUN,
    );
    for (const failure of schemaRejected) {
      expect(failure.reason).toMatch(/^content schema rejected:/);
    }
    for (const failure of budgetExhausted) {
      expect(failure.reason).toBe("run seed-retry budget exhausted");
    }
    expect(result.failures.map((failure) => failure.date)).toEqual(
      Array.from({ length: 7 }, (_, offset) => addDays(today, offset)),
    );
  }, 30_000);
});

describe("topUpNonogramBuffer", () => {
  it("T-API-S17: covers a full week with content the strict contract and the validator both accept", async () => {
    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 7, depth: 7, failures: [] });
    const rows = await nonogramRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      const content = nonogramDailyContentSchema.parse(row.content);
      const weekday = weekdayOf(row.date);
      expect(content.weekday).toBe(weekday);
      expect(content.size).toBe(NONOGRAM_WEEKDAY_CRITERIA[weekday].size);
      expect(row.seed).toBe(content.seed);

      expect(validateNonogram({ ...content, weekday }).ok).toBe(true);
    }
  });

  it("T-API-S18: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);

    nonogram.failWeekdays.add(weekdayOf(doomedDate));

    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result.generated).toBe(6);
    expect(result.depth).toBe(6);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(doomedDate);
    expect(result.failures[0]?.reason).toContain("nonogram generation failed");
    const dates = (await nonogramRows()).map((row) => row.date).sort();
    expect(dates).not.toContain(doomedDate);
    expect(dates).toHaveLength(6);

    expect(nonogram.calls).toBe(6 + MAX_NONOGRAM_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S19: the weekday/size cross-check is a TRIPWIRE — it can only fire for a puzzle this loop did not generate", async () => {
    nonogram.forceWeekday = 1;
    const today = await todaySaoPaulo(ctx.db);
    const monday = Array.from({ length: 7 }, (_unused, offset) =>
      addDays(today, offset),
    ).find((date) => isoWeekdayOf(date) === 1);
    if (monday === undefined) {
      throw new Error("unreachable: a 7-day window contains every weekday");
    }

    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result.generated).toBe(1);
    expect(result.failures).toHaveLength(6);
    for (const failure of result.failures) {
      expect(failure.date).not.toBe(monday);
      expect(failure.reason).toContain("weekday/size cross-check failed");
    }
    const rows = await nonogramRows();
    expect(rows.map((row) => row.date)).toEqual([monday]);
    expect(nonogram.calls).toBe(7);

    const rejected = nonogram.lastPuzzle;
    if (rejected === undefined) {
      throw new Error("unreachable: the mock generated at least once");
    }
    expect(rejected.weekday).toBe(1);
    expect(validateNonogram(rejected).ok).toBe(true);
  });

  it("T-API-S20: a second run generates nothing and never touches an existing row", async () => {
    await topUpNonogramBuffer(ctx.db, 7);
    const before = new Map(
      (await nonogramRows()).map((row) => [
        row.date,
        JSON.stringify({ seed: row.seed, content: row.content }),
      ]),
    );
    nonogram.calls = 0;

    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 0, depth: 7, failures: [] });
    expect(nonogram.calls).toBe(0);
    for (const row of await nonogramRows()) {
      expect(JSON.stringify({ seed: row.seed, content: row.content })).toBe(
        before.get(row.date),
      );
    }
  });

  it("T-API-S186: a validator that always rejects retries the full per-date budget", async () => {
    nonogram.rejectValidator = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpNonogramBuffer(ctx.db, 1);

    expect(result.generated).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(today);
    expect(result.failures[0]?.reason).toMatch(/^validator rejected:/);
    expect(nonogram.calls).toBe(MAX_NONOGRAM_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S187: a schema rejection stops the date after one attempt", async () => {
    nonogram.injectStrayKey = true;
    const today = await todaySaoPaulo(ctx.db);

    const result = await topUpNonogramBuffer(ctx.db, 1);

    expect(result.generated).toBe(0);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]?.date).toBe(today);
    expect(result.failures[0]?.reason).toMatch(/^content schema rejected:/);
    expect(nonogram.calls).toBe(1);
  });
});

describe("topUpTermoBuffer", () => {
  let poolWarnings: string[] = [];

  beforeEach(() => {
    poolWarnings = [];
    vi.spyOn(console, "error").mockImplementation((...data: unknown[]) => {
      for (const entry of data) {
        if (typeof entry === "string") {
          poolWarnings.push(entry);
        }
      }
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function termoRows(): Promise<
    { date: string; seed: number; content: unknown }[]
  > {
    const rows = await ctx.db.select().from(dailyPuzzles);
    return rows
      .filter((row) => row.game === "termo")
      .map((row) => ({ date: row.date, seed: row.seed, content: row.content }));
  }

  function answersOf(rows: { content: unknown }[]): string[] {
    return rows.map(
      (row) => termoDailyContentSchema.parse(row.content).normalized,
    );
  }

  it("T-API-S29: a cold depth-30 run writes 30 rows with 30 DISTINCT curated answers", async () => {
    const result = await topUpTermoBuffer(ctx.db, 30);

    expect(result).toEqual({ generated: 30, depth: 30, failures: [] });
    const rows = await termoRows();
    expect(rows).toHaveLength(30);

    const today = await todaySaoPaulo(ctx.db);
    expect(rows.map((row) => row.date).sort()).toEqual(
      Array.from({ length: 30 }, (_, offset) => addDays(today, offset)),
    );

    const eligible = new Map(
      TERMO_ANSWERS.map((answer) => [answer.normalized, answer.canonical]),
    );
    const drawn = answersOf(rows);

    expect(new Set(drawn).size).toBe(30);
    for (const row of rows) {
      const content = termoDailyContentSchema.parse(row.content);

      expect(eligible.get(content.normalized)).toBe(content.canonical);

      expect(Object.keys(content).sort()).toEqual(["canonical", "normalized"]);

      expect(Number.isInteger(row.seed)).toBe(true);
      expect(row.seed).toBeGreaterThanOrEqual(0);
      expect(row.seed).toBeLessThan(2 ** 32);
    }

    expect(poolWarnings).toEqual([]);
  });

  it("T-API-S30: a second run generates nothing and changes no stored content", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const before = new Map(
      (await termoRows()).map((row) => [row.date, JSON.stringify(row)]),
    );

    const result = await topUpTermoBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 0, depth: 7, failures: [] });
    const after = await termoRows();
    expect(after).toHaveLength(7);
    for (const row of after) {
      expect(JSON.stringify(row)).toBe(before.get(row.date));
    }
  });

  it("T-API-S31: a KILLED row's answer is never drawn again", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const killedDates = Array.from({ length: 5 }, (_, offset) =>
      addDays(today, offset),
    );

    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'termo' and date <= ${killedDates[4] ?? today}`,
    );
    const killedAnswers = new Set(
      answersOf(
        (await termoRows()).filter((row) => killedDates.includes(row.date)),
      ),
    );
    expect(killedAnswers.size).toBe(5);

    const result = await topUpTermoBuffer(ctx.db, 14);

    expect(result.generated).toBe(7);
    expect(result.failures).toEqual([]);

    expect(result.depth).toBe(9);
    const fresh = (await termoRows()).filter(
      (row) => !killedDates.includes(row.date),
    );
    for (const answer of answersOf(fresh)) {
      expect(killedAnswers.has(answer)).toBe(false);
    }

    const all = answersOf(await termoRows());
    expect(new Set(all).size).toBe(all.length);
  });

  it("T-API-S32: exhaustion FAILS CLOSED — uncovered dates carry the exhaustion reason", async () => {
    const spent = TERMO_ANSWERS.slice(0, 395);
    await ctx.db.insert(dailyPuzzles).values(
      spent.map((answer, index) => ({
        game: "termo" as const,
        date: addDays("2020-01-01", index),
        seed: index,
        content: { canonical: answer.canonical, normalized: answer.normalized },
        publishedAt: sql`now() - interval '1 year'`,
      })),
    );

    const result = await topUpTermoBuffer(ctx.db, 10);

    expect(result.generated).toBe(5);
    expect(result.depth).toBe(5);
    expect(result.failures).toHaveLength(5);
    for (const failure of result.failures) {
      expect(failure.reason).toBe(
        "answer list exhausted: every curated Termo answer is already used",
      );
    }
    const today = await todaySaoPaulo(ctx.db);

    expect(result.failures.map((failure) => failure.date)).toEqual(
      Array.from({ length: 5 }, (_, offset) => addDays(today, offset + 5)),
    );
    const fresh = (await termoRows()).filter((row) => row.date >= today);
    expect(fresh).toHaveLength(5);
    const spentSet = new Set(spent.map((answer) => answer.normalized));
    for (const answer of answersOf(fresh)) {
      expect(spentSet.has(answer)).toBe(false);
    }

    expect(poolWarnings).toHaveLength(1);
    expect(JSON.parse(poolWarnings[0] ?? "null")).toEqual({
      event: "termo-answer-pool-low",
      remaining: 5,
      total: 400,
    });
  });

  it("T-API-S44: the low-pool warning fires AT 30 remaining, and is silent at 31", async () => {
    const spendAnswers = async (count: number): Promise<void> => {
      await ctx.db.insert(dailyPuzzles).values(
        TERMO_ANSWERS.slice(0, count).map((answer, index) => ({
          game: "termo" as const,
          date: addDays("2020-01-01", index),
          seed: index,
          content: {
            canonical: answer.canonical,
            normalized: answer.normalized,
          },
          publishedAt: sql`now() - interval '1 year'`,
        })),
      );
    };

    await spendAnswers(369);
    await topUpTermoBuffer(ctx.db, 1);
    expect(poolWarnings).toEqual([]);

    await topUpTermoBuffer(ctx.db, 2);
    expect(poolWarnings).toHaveLength(1);
    expect(JSON.parse(poolWarnings[0] ?? "null")).toEqual({
      event: "termo-answer-pool-low",
      remaining: 30,
      total: 400,
    });
  });

  it("T-API-S32: an already-covered date is skipped before the pool is consulted", async () => {
    await topUpTermoBuffer(ctx.db, 7);
    const today = await todaySaoPaulo(ctx.db);
    const hole = addDays(today, 5);
    await ctx.db.execute(
      sql`delete from daily_puzzles where game = 'termo' and date = ${hole}`,
    );

    const result = await topUpTermoBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 1, depth: 7, failures: [] });
    const all = answersOf(await termoRows());
    expect(new Set(all).size).toBe(7);
  });

  it("T-API-S188: a throw mid-run aborts with the partial count and failures gathered so far", async () => {
    insertControl.throwOnCall = 4;

    let caught: unknown;
    try {
      await topUpTermoBuffer(ctx.db, 7);
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(TopUpAbortedError);
    const aborted = caught as TopUpAbortedError;
    expect(aborted.partial.generated).toBe(3);
    expect(aborted.partial.failures).toEqual([]);
  }, 30_000);
});

describe("drawUniformIndex", () => {
  const UINT32_MAX = 2 ** 32 - 1;

  it("T-API-S33: a draw one below the limit is ACCEPTED and maps to the last index", () => {
    for (const n of [1, 2, 399, 400]) {
      const limit = uniformDrawLimit(n);
      const draws: number[] = [];
      const result = drawUniformIndex(n, () => {
        draws.push(limit - 1);
        return limit - 1;
      });
      expect(draws).toHaveLength(1);
      expect(result).toEqual({ index: (limit - 1) % n, draw: limit - 1 });

      expect(result.index).toBe(n - 1);
    }
  });

  it("T-API-S33: draws AT or ABOVE the limit are rejected and force a redraw", () => {
    for (const n of [3, 399, 400]) {
      const limit = uniformDrawLimit(n);

      expect(limit).toBeLessThanOrEqual(UINT32_MAX);
      expect(limit % n).toBe(0);

      for (const rejected of [limit, limit + 1, UINT32_MAX]) {
        const draws: number[] = [];
        const result = drawUniformIndex(n, () => {
          draws.push(rejected);

          return draws.length === 1 ? rejected : 0;
        });
        expect(draws).toEqual([rejected, rejected]);
        expect(result).toEqual({ index: 0, draw: 0 });
      }
    }
  });

  it("T-API-S33: a pool size that DIVIDES 2**32 has an empty reject region", () => {
    for (const n of [1, 2, 4, 256]) {
      expect(uniformDrawLimit(n)).toBe(2 ** 32);
      for (const draw of [0, 1, UINT32_MAX]) {
        expect(drawUniformIndex(n, () => draw)).toEqual({
          index: draw % n,
          draw,
        });
      }
    }
  });

  it("T-API-S33: every accepted index lies in [0, n), for every draw the stub can make", () => {
    for (const n of [1, 2, 7, 399, 400]) {
      const limit = uniformDrawLimit(n);
      for (const draw of [0, 1, n - 1, n, limit - 1, Math.floor(limit / 2)]) {
        const { index } = drawUniformIndex(n, () => draw);
        expect(index).toBeGreaterThanOrEqual(0);
        expect(index).toBeLessThan(n);
      }
    }
  });

  it("T-API-S33: a draw that never converges throws, and the loop runs exactly the bound it names", () => {
    const limit = uniformDrawLimit(400);
    let calls = 0;
    expect(() =>
      drawUniformIndex(400, () => {
        calls += 1;
        return limit;
      }),
    ).toThrow(/uniform draw did not converge in \d+ attempts/);

    let bound = 0;
    try {
      drawUniformIndex(400, () => limit);
    } catch (thrown) {
      const message = thrown instanceof Error ? thrown.message : "";
      bound = Number(/in (\d+) attempts/.exec(message)?.[1] ?? 0);
    }
    expect(bound).toBeGreaterThan(0);
    expect(calls).toBe(bound);
  });

  it("T-API-S33: a non-positive or non-integer bound is a RangeError", () => {
    for (const bad of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => drawUniformIndex(bad, () => 0)).toThrow(RangeError);
    }
  });
});
