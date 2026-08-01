import { dailySudokuResponseSchema } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sql } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday, type Weekday } from "@miolos/games";
import { generateDailySudoku, type SudokuPuzzle } from "@miolos/games/sudoku";
import { generateBinairo } from "@miolos/games/binairo";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/sudoku/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

// Seam 4: the real route over PGlite; the ONLY mock is src/db. Seeding goes
// through insertDailyPuzzle — the same write the cron uses, so published_at
// derivation is the production one.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

// Generation is deterministic in (seed, weekday) and a tier-5 Sunday board
// measures ~121 ms mean / 346 ms max locally (plan 018 §19.6, CI ~4x
// slower). Caching by weekday keeps this file from paying for the same
// board six times; it changes nothing about what is asserted.
const puzzleCache = new Map<Weekday, SudokuPuzzle>();

function puzzleForDate(date: string): SudokuPuzzle {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  const cached = puzzleCache.get(weekday);
  if (cached) {
    return cached;
  }
  const puzzle = generateDailySudoku({ seed: 7, weekday });
  puzzleCache.set(weekday, puzzle);
  return puzzle;
}

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

async function seedDate(date: string, seed = 7): Promise<void> {
  await insertDailyPuzzle(ctx.db, {
    game: "sudoku",
    date,
    seed,
    content: puzzleForDate(date),
  });
}

describe("GET /daily/sudoku", () => {
  it("T-API-S6: 200 with today's puzzle; body strict-parses the sudoku response contract", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = dailySudokuResponseSchema.parse(await response.json());
    expect(body.game).toBe("sudoku");
    expect(body.date).toBe(today);
    expect(body.givens).toHaveLength(81);
    expect(Object.keys(body).sort()).toEqual([
      "date",
      "game",
      "givens",
      "tier",
    ]);
  }, 30_000);

  it("carries no solution/seed/reveal/answer/clueCount key at any depth (leak scan, not just parse success)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    const raw: unknown = await response.json();
    const keys = collectKeys(raw);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  }, 30_000);

  it("404 when only future rows exist", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(addDays(today, 1));
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("404 when today's row is killed — no replacement puzzle (ADR-0024)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, today));
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("future rows never appear regardless of offset (+1, +2, +30)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    for (const offset of [1, 2, 30]) {
      await seedDate(addDays(today, offset), 100 + offset);
    }
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("T-API-S6: a BINAIRO row published for today never answers this path", async () => {
    // The wall read is game-scoped and the HTTP boundary parses against
    // dailySudokuResponseSchema rather than the union, so a mismatched row
    // can neither be found nor be serialized — two independent gates.
    const today = await todaySaoPaulo(ctx.db);
    const weekday = isoWeekdayOf(today);
    if (!isWeekday(weekday)) {
      throw new Error(`unreachable: bad weekday for ${today}`);
    }
    await insertDailyPuzzle(ctx.db, {
      game: "binairo",
      date: today,
      seed: 3,
      content: generateBinairo({ seed: 3, weekday }),
    });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/sudoku/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
