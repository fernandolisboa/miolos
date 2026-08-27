import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { todaySaoPaulo } from "../src/buffer";
import { recordCompletion } from "../src/completions";
import { getUserSince, listCompletionsForStats } from "../src/stats";
import { users } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, completions cascade`);
});

afterAll(async () => {
  await ctx.close();
});

async function createUser(createdAt?: Date): Promise<string> {
  const inserted = await ctx.db
    .insert(users)
    .values(createdAt === undefined ? {} : { createdAt })
    .returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  return user.id;
}

function addDaysLocal(date: string, days: number): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

describe("listCompletionsForStats (plan 033 D3, ADR-0049 decision 6)", () => {
  it("T-DB-S34: returns every row unfiltered with all seven facts — SQL-derived onTime, guesses projected, date descending, other users absent", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 272_000,
      hintsUsed: 1,
      onTime: true,
    });

    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 480_000,
      hintsUsed: 0,
      onTime: false,
    });

    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 6,
      onTime: true,
    });

    const rows = await listCompletionsForStats(ctx.db, userId);
    expect(rows).toHaveLength(3);

    expect(rows[2]).toEqual({
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      onTime: false,
      elapsedMs: 480_000,
      hintsUsed: 0,
      guesses: null,
    });
    expect(
      [rows[0], rows[1]].sort((a, b) =>
        (a?.game ?? "").localeCompare(b?.game ?? ""),
      ),
    ).toEqual([
      {
        game: "binairo",
        date: today,
        outcome: "won",
        onTime: true,
        elapsedMs: 272_000,
        hintsUsed: 1,
        guesses: null,
      },
      {
        game: "termo",
        date: today,
        outcome: "lost",
        onTime: true,
        elapsedMs: 61_000,
        hintsUsed: 0,
        guesses: 6,
      },
    ]);

    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "guesses",
      "hintsUsed",
      "onTime",
      "outcome",
    ]);

    const otherUserId = await createUser();
    expect(await listCompletionsForStats(ctx.db, otherUserId)).toEqual([]);
  });
});

describe("getUserSince (plan 033 D2 — the calendar's birth anchor)", () => {
  it("T-DB-S35: returns the SP calendar day of created_at — a UTC T01:00:00Z instant is the PREVIOUS SP date", async () => {
    const userId = await createUser(new Date("2026-08-01T01:00:00Z"));
    expect(await getUserSince(ctx.db, userId)).toBe("2026-07-31");

    const middayUser = await createUser(new Date("2026-08-01T15:00:00Z"));
    expect(await getUserSince(ctx.db, middayUser)).toBe("2026-08-01");

    expect(
      await getUserSince(ctx.db, "00000000-0000-4000-8000-000000000000"),
    ).toBeUndefined();
  });
});

describe("surface tripwire (ADR-0026 decision 5, plan 033 §3.1)", () => {
  it("T-DB-S36: the stats module exports exactly the two readers", async () => {
    const stats = await import("../src/stats");
    expect(Object.keys(stats).sort()).toEqual([
      "getUserSince",
      "listCompletionsForStats",
    ]);
  });
});
