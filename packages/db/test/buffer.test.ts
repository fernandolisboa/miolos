import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  bufferDepth,
  insertDailyPuzzle,
  listBufferedDates,
  todaySaoPaulo,
} from "../src/buffer";
import { dailyPuzzles } from "../src/schema";
import { createTestDb } from "../src/testing";
import { binairoContentFixture } from "./fixtures";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

function addDaysLocal(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

describe("insertDailyPuzzle", () => {
  it("is idempotent on (game, date): second insert returns false, row unchanged", async () => {
    const first = await insertDailyPuzzle(ctx.db, {
      game: "binairo",
      date: "2026-08-01",
      seed: 111,
      content: binairoContentFixture(),
    });
    expect(first).toBe(true);

    const second = await insertDailyPuzzle(ctx.db, {
      game: "binairo",
      date: "2026-08-01",
      seed: 999,
      content: { ...binairoContentFixture(), seed: 999 },
    });
    expect(second).toBe(false);

    const rows = await ctx.db
      .select()
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.date, "2026-08-01"));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.seed).toBe(111);
    expect(rows[0]?.content).toEqual(binairoContentFixture());
  });

  it("derives published_at for 2026-08-01 as exactly 2026-08-01T03:00:00Z (AT TIME ZONE pin)", async () => {
    await insertDailyPuzzle(ctx.db, {
      game: "binairo",
      date: "2026-08-01",
      seed: 1,
      content: binairoContentFixture(),
    });
    const rows = await ctx.db
      .select()
      .from(dailyPuzzles)
      .where(eq(dailyPuzzles.date, "2026-08-01"));
    expect(rows[0]?.publishedAt.toISOString()).toBe("2026-08-01T03:00:00.000Z");
  });
});

describe("bufferDepth", () => {
  it("counts only alive rows with date >= SP-today", async () => {
    const today = await todaySaoPaulo(ctx.db);
    for (const [offset, seed] of [
      [-1, 1],
      [0, 2],
      [1, 3],
      [2, 4],
    ] as const) {
      await insertDailyPuzzle(ctx.db, {
        game: "binairo",
        date: addDaysLocal(today, offset),
        seed,
        content: binairoContentFixture(),
      });
    }

    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, addDaysLocal(today, 1)));

    expect(await bufferDepth(ctx.db, "binairo")).toBe(2);
    expect(await bufferDepth(ctx.db, "sudoku")).toBe(0);
  });
});

describe("listBufferedDates", () => {
  it("returns only dates >= fromDate for the game", async () => {
    for (const date of ["2026-08-01", "2026-08-02", "2026-08-03"]) {
      await insertDailyPuzzle(ctx.db, {
        game: "binairo",
        date,
        seed: 1,
        content: binairoContentFixture(),
      });
    }
    await insertDailyPuzzle(ctx.db, {
      game: "sudoku",
      date: "2026-08-02",
      seed: 1,
      content: { other: "game" },
    });

    const dates = await listBufferedDates(ctx.db, "binairo", "2026-08-02");
    expect(dates.sort()).toEqual(["2026-08-02", "2026-08-03"]);
  });
});

describe("the migration's CHECK constraint", () => {
  it("rejects an unknown game value on a raw insert", async () => {
    const messages = (error: unknown): string => {
      let out = "";
      let current: unknown = error;
      while (current instanceof Error) {
        out += current.message;
        current = current.cause;
      }
      return out;
    };
    let thrown: unknown;
    try {
      await ctx.db.execute(
        sql`insert into daily_puzzles (game, date, seed, content, published_at)
            values ('chess', '2026-08-01', 1, '{}'::jsonb, now())`,
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect(messages(thrown)).toContain("daily_puzzles_game_check");
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(0);
  });
});
