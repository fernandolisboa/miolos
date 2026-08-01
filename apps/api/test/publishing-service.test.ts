import { sudokuDailyContentSchema } from "@miolos/core";
import { sql } from "@miolos/db";
import { dailyPuzzles, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
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
  MAX_SUDOKU_SEED_RETRIES_PER_DATE,
  MAX_SUDOKU_SEED_RETRIES_PER_RUN,
  topUpSudokuBuffer,
} from "../src/publishing/service";

// The top-up called directly over PGlite — the route is not in the picture
// here. This file owns the engine mock deliberately (plan 018 T-API-S7): a
// file-wide `vi.mock("@miolos/games/sudoku", …)` must never leak into
// cron-publish.test.ts, which needs the real generator end to end.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { generation } = vi.hoisted(() => ({
  generation: { failWeekdays: new Set<number>(), calls: 0 },
}));

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
