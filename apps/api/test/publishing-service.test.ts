import {
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
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
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import {
  MAX_NONOGRAM_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_RUN,
  topUpNonogramBuffer,
  topUpSudokuBuffer,
} from "../src/publishing/service";

// The top-up called directly over PGlite — the route is not in the picture
// here. This file owns the engine mocks deliberately (plan 018 T-API-S7): a
// file-wide `vi.mock("@miolos/games/sudoku", …)` must never leak into
// cron-publish.test.ts, which needs the real generators end to end.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { generation } = vi.hoisted(() => ({
  generation: { failWeekdays: new Set<number>(), calls: 0 },
}));

const { nonogram } = vi.hoisted(() => {
  const state: {
    failWeekdays: Set<number>;
    calls: number;
    /**
     * When set, every call generates for THIS weekday whatever the target —
     * the only way to reach the top-up's weekday/size cross-check, which real
     * generator output can never fail (T-API-S19).
     */
    forceWeekday: Weekday | undefined;
    /** The last puzzle handed to the top-up — T-API-S19's anti-vacuity subject. */
    lastPuzzle: NonogramPuzzle | undefined;
  } = {
    failWeekdays: new Set(),
    calls: 0,
    forceWeekday: undefined,
    lastPuzzle: undefined,
  };
  return { nonogram: state };
});

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
        // The REAL class, taken from the spread original, so the service's
        // `instanceof NonogramGenerationError` branch is the one under test.
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
      return puzzle;
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
        // The REAL class, taken from the spread original, so the service's
        // `instanceof SudokuGenerationError` branch is the one under test —
        // a look-alike would fall through to the rethrow and abort the run,
        // which is exactly the behaviour these tests deny.
        throw new actual.SudokuGenerationError(
          options.seed,
          actual.sudokuCriteriaForWeekday(options.weekday),
          actual.SUDOKU_MAX_GENERATION_ATTEMPTS,
        );
      }
      return actual.generateDailySudoku(options);
    },
  };
});

// PGlite boot measures ~1.2 s locally and CI runners are ~3-4x slower;
// 1.2 s x 4 + margin puts the ceiling well above vitest's default, which
// would otherwise flake this file on CI alone (plan 018 §15).
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  generation.failWeekdays.clear();
  generation.calls = 0;
  nonogram.failWeekdays.clear();
  nonogram.calls = 0;
  nonogram.forceWeekday = undefined;
  nonogram.lastPuzzle = undefined;
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

function weekdayOf(date: string): Weekday {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  return weekday;
}

describe("topUpSudokuBuffer", () => {
  it("covers a full week with content the strict contract and the weekday criteria both accept", async () => {
    // Anti-vacuity for the two failure tests below: the spread mock must
    // reach the REAL generator whenever the weekday is not forced to fail.
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
    // Every weekday appears exactly once in a 7-day window, so failing one
    // weekday fails exactly one date.
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
    // The doomed date spent its whole per-date budget; the other six were
    // covered on their first seed.
    expect(generation.calls).toBe(6 + MAX_SUDOKU_SEED_RETRIES_PER_DATE);
  }, 30_000);

  it("T-API-S16: the RUN-scoped budget bounds total attempts, not depth x per-date", async () => {
    // Force every weekday to fail: without a run budget a depth-7 run would
    // spend 7 x MAX_SUDOKU_SEED_RETRIES_PER_DATE seeds, and a depth-30 run
    // (remoteConfigSchema's clamp ceiling) 30 x — the ~8 s bound in plan
    // 018 S13 is a property of the code only if this holds.
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
    // Dates already in the buffer are skipped BEFORE the budget check, so a
    // healthy buffer with one hole still gets its hole filled.
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
});

/**
 * Deliberately WITHOUT a per-`it` timeout, unlike every sudoku case above
 * (landmine 25). Nonogram generate+validate measures 0.0354 ms (Mon 5x5) to
 * 0.1902 ms (Sun 15x15) with warm pools, plus ~34 ms once to build all seven
 * memoized pools — three orders of magnitude under `topUpSudokuBuffer`'s
 * ~834 ms week, so vitest's 5 000 ms default is ample and a copied 30_000
 * would be a number with no reason to exist.
 */
describe("topUpNonogramBuffer", () => {
  it("T-API-S17: covers a full week with content the strict contract and the validator both accept", async () => {
    const result = await topUpNonogramBuffer(ctx.db, 7);

    expect(result).toEqual({ generated: 7, depth: 7, failures: [] });
    const rows = await nonogramRows();
    expect(rows).toHaveLength(7);
    for (const row of rows) {
      // Every stored row re-passes the strict contract AND the engine's own
      // approval gate — the mapping proven end to end, not asserted.
      const content = nonogramDailyContentSchema.parse(row.content);
      const weekday = weekdayOf(row.date);
      expect(content.weekday).toBe(weekday);
      expect(content.size).toBe(NONOGRAM_WEEKDAY_CRITERIA[weekday].size);
      expect(row.seed).toBe(content.seed);
      // `validateNonogram` takes ONE argument and derives its criteria from
      // the puzzle's own weekday, so the narrowing above is what makes this
      // a check against the DATE rather than against the puzzle itself.
      expect(validateNonogram({ ...content, weekday }).ok).toBe(true);
    }
  });

  it("T-API-S18: a date whose generation always fails lands in failures and the run continues", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const doomedDate = addDays(today, 3);
    // Every weekday appears exactly once in a 7-day window, so failing one
    // weekday fails exactly one date.
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
    // The doomed date spent its whole per-date budget; the other six were
    // covered on their first seed.
    expect(nonogram.calls).toBe(6 + MAX_NONOGRAM_SEED_RETRIES_PER_DATE);
  });

  it("T-API-S19: the weekday/size cross-check is a TRIPWIRE — it can only fire for a puzzle this loop did not generate", async () => {
    // `generateNonogram` writes `weekday` and `size` from the same criteria
    // table the assertion reads, so real generator output can NEVER fail it.
    // Forcing every call to generate Monday's board is the only way to reach
    // the branch, and this comment exists so a later reader does not mistake
    // the case for coverage of a production path.
    nonogram.forceWeekday = 1;
    const today = await todaySaoPaulo(ctx.db);
    const monday = Array.from({ length: 7 }, (_unused, offset) =>
      addDays(today, offset),
    ).find((date) => isoWeekdayOf(date) === 1);
    if (monday === undefined) {
      throw new Error("unreachable: a 7-day window contains every weekday");
    }

    const result = await topUpNonogramBuffer(ctx.db, 7);

    // Only the date that really IS a Monday survives; the other six are
    // failed closed for the date, one seed each — a mismatch is code drift,
    // and every other seed would reproduce it.
    expect(result.generated).toBe(1);
    expect(result.failures).toHaveLength(6);
    for (const failure of result.failures) {
      expect(failure.date).not.toBe(monday);
      expect(failure.reason).toContain("weekday/size cross-check failed");
    }
    const rows = await nonogramRows();
    expect(rows.map((row) => row.date)).toEqual([monday]);
    expect(nonogram.calls).toBe(7);

    // The anti-vacuity half: the very puzzle the cross-check rejected is one
    // the VALIDATOR approves, so this proves the ASSERTION rejected it and
    // not `validateNonogram` (plan 020 P6/TR-11).
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
});
