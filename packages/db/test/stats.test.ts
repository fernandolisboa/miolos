import { sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { todaySaoPaulo } from "../src/buffer";
import { recordCompletion } from "../src/completions";
import { getUserSince, listCompletionsForStats } from "../src/stats";
import { users } from "../src/schema";
import { createTestDb } from "../src/testing";

// The #29 statistics readers (plan 033 §3.1, ADR-0051). What is pinned
// here and nowhere else: `listCompletionsForStats` projects EVERY row of
// one user, unfiltered, with all seven facts — the pure functions in
// packages/core are the only place lost and late rows are excluded (D3) —
// and `getUserSince` derives the account's SP birth day from `created_at`
// (D2's calendar anchor). On-time still has exactly one producer,
// `onTimeSql()` (ADR-0026 decision 2): this suite manufactures a late row
// through the same write path T-DB-13 uses, no clock fake needed.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower;
// 1.2 s × 4 + margin puts the ceiling well above vitest's 10 s default,
// which would otherwise flake this file on CI alone (plan 017 §15).
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, completions cascade`);
});

afterAll(async () => {
  await ctx.close();
});

/** A fresh anonymous identity — the FK parent every row below needs. */
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

/** Pure date math for seeding relative to SP-today (buffer.test.ts precedent). */
function addDaysLocal(date: string, days: number): string {
  // Runtime-guarded parse (apps/api partsOf pattern) — no bare tuple cast.
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

    // An on-time win: written on its own SP day (T-DB-13's construction).
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 272_000,
      hintsUsed: 1,
    });
    // A LATE win: dated yesterday, completed_at is now — outside its day.
    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 480_000,
      hintsUsed: 0,
    });
    // A lost Termo with its guess count — the rows the reader must NOT
    // filter, and the projection #29 finally adds (T-DB-S11 pinned the
    // `getCompletion` omission; it stays pinned — this reader is the one
    // the statistics ticket was told to add instead).
    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 6,
    });

    const rows = await listCompletionsForStats(ctx.db, userId);
    expect(rows).toHaveLength(3);
    // Date descending; within a date the order is not part of the contract,
    // so the today pair is compared as a set.
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
    // The projection is exactly the StatsRow shape — no completedAt leaks.
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "guesses",
      "hintsUsed",
      "onTime",
      "outcome",
    ]);

    // Another user's rows never appear through this reader.
    const otherUserId = await createUser();
    expect(await listCompletionsForStats(ctx.db, otherUserId)).toEqual([]);
  });
});

describe("getUserSince (plan 033 D2 — the calendar's birth anchor)", () => {
  it("T-DB-S35: returns the SP calendar day of created_at — a UTC T01:00:00Z instant is the PREVIOUS SP date", async () => {
    // 01:00 UTC is 22:00 of the previous day in São Paulo (UTC−3): the SP
    // day, not the UTC day, is the account's birth day.
    const userId = await createUser(new Date("2026-08-01T01:00:00Z"));
    expect(await getUserSince(ctx.db, userId)).toBe("2026-07-31");

    // A midday-UTC instant sits inside its own SP day.
    const middayUser = await createUser(new Date("2026-08-01T15:00:00Z"));
    expect(await getUserSince(ctx.db, middayUser)).toBe("2026-08-01");

    // A vanished user row (the deletion race) reads undefined — callers
    // throw, landing in the route's catch-all 500 (plan 033 §3.1).
    expect(
      await getUserSince(ctx.db, "00000000-0000-4000-8000-000000000000"),
    ).toBeUndefined();
  });
});

describe("surface tripwire (ADR-0026 decision 5, plan 033 §3.1)", () => {
  it("T-DB-S36: the stats module exports exactly the two readers", async () => {
    // The per-entry pin (user.test.ts T-DB-9e) and the cross-entry pin
    // (published.test.ts T-DB-S5, 30 → 32) widen in the same commit as
    // the barrel — this pin covers the module itself.
    const stats = await import("../src/stats");
    expect(Object.keys(stats).sort()).toEqual([
      "getUserSince",
      "listCompletionsForStats",
    ]);
  });
});
