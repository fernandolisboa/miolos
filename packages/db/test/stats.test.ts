import { sql, type SQL } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { todaySaoPaulo } from "../src/buffer";
import { recordCompletion } from "../src/completions";
import { listPublishedDailiesOnWonDates } from "../src/published";
import { getUserSince, listCompletionsForStats } from "../src/stats";
import { completions, dailyPuzzles, users } from "../src/schema";
import { createTestDb } from "../src/testing";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(
    sql`truncate table users, completions, daily_puzzles cascade`,
  );
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

function messages(error: unknown): string {
  let out = "";
  let current: unknown = error;
  while (current instanceof Error) {
    out += current.message;
    current = current.cause;
  }
  return out;
}

async function thrownBy(statement: Promise<unknown>): Promise<unknown> {
  try {
    await statement;
    return undefined;
  } catch (error) {
    return error;
  }
}

describe("migration 0014 admits the crossword (ADR-0086)", () => {
  it("T-DB-S99: 'crossword' inserts into daily_puzzles and completions, and an unknown game is still rejected by name", async () => {
    const userId = await createUser();

    await ctx.db.execute(
      sql`insert into daily_puzzles (game, date, seed, content, published_at)
          values ('crossword', '2026-09-28', 1, '{}'::jsonb, now())`,
    );
    await ctx.db.execute(
      sql`insert into completions (user_id, game, date, outcome, elapsed_ms, on_time)
          values (${userId}, 'crossword', '2026-09-28', 'won', 5, true)`,
    );
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(1);
    expect(await ctx.db.select().from(completions)).toHaveLength(1);

    const chessDaily = await thrownBy(
      ctx.db.execute(
        sql`insert into daily_puzzles (game, date, seed, content, published_at)
            values ('chess', '2026-09-28', 1, '{}'::jsonb, now())`,
      ),
    );
    expect(messages(chessDaily)).toContain("daily_puzzles_game_check");

    const chessCompletion = await thrownBy(
      ctx.db.execute(
        sql`insert into completions (user_id, game, date, outcome, elapsed_ms, on_time)
            values (${userId}, 'chess', '2026-09-28', 'won', 5, true)`,
      ),
    );
    expect(messages(chessCompletion)).toContain("completions_game_check");
  });
});

describe("listPublishedDailiesOnWonDates (ADR-0087)", () => {
  function midnightOf(date: string): SQL {
    return sql`(${date}::timestamp at time zone 'America/Sao_Paulo')`;
  }

  async function publish(
    game: "binairo" | "sudoku" | "nonogram" | "termo" | "crossword",
    date: string,
    options: { insertedAfterMidnight?: boolean; killed?: boolean } = {},
  ): Promise<void> {
    await ctx.db.insert(dailyPuzzles).values({
      game,
      date,
      seed: 1,
      content: {},
      publishedAt: midnightOf(date),
      createdAt: options.insertedAfterMidnight
        ? sql`${midnightOf(date)} + interval '1 hour'`
        : sql`${midnightOf(date)} - interval '2 days'`,
      killedAt: options.killed ? sql`now()` : undefined,
    });
  }

  async function complete(
    userId: string,
    game: "binairo" | "sudoku" | "nonogram" | "termo" | "crossword",
    date: string,
    init: { outcome?: "won" | "lost"; onTime?: boolean } = {},
  ): Promise<void> {
    await ctx.db.insert(completions).values({
      userId,
      game,
      date,
      outcome: init.outcome ?? "won",
      elapsedMs: 1_000,
      guesses: game === "termo" ? 3 : null,
      onTime: init.onTime ?? true,
    });
  }

  it("T-DB-S100: returns the published, un-killed, buffered lineup of exactly the user's on-time-won dates, ordered by date then game", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const [lost, late, other, buffered, launch] = [5, 4, 3, 2, 1].map((n) =>
      addDaysLocal(today, -n),
    );
    const tomorrow = addDaysLocal(today, 1);
    if (!lost || !late || !other || !buffered || !launch) {
      throw new Error("date fixture");
    }

    await publish("termo", lost);
    await complete(userId, "termo", lost, { outcome: "lost" });

    await publish("binairo", late);
    await complete(userId, "binairo", late, { onTime: false });

    await publish("sudoku", other);
    await complete(otherUserId, "sudoku", other);

    await publish("binairo", buffered);
    await publish("termo", buffered);
    await publish("crossword", buffered, { killed: true });
    await complete(userId, "binairo", buffered);

    await publish("nonogram", launch);
    await publish("crossword", launch, { insertedAfterMidnight: true });
    await complete(userId, "nonogram", launch);

    await publish("sudoku", today);
    await complete(userId, "sudoku", today);

    await publish("binairo", tomorrow);
    await complete(userId, "binairo", tomorrow);

    expect(await listPublishedDailiesOnWonDates(ctx.db, userId)).toEqual([
      { date: buffered, game: "binairo" },
      { date: buffered, game: "termo" },
      { date: launch, game: "nonogram" },
      { date: today, game: "sudoku" },
    ]);
    expect(await listPublishedDailiesOnWonDates(ctx.db, otherUserId)).toEqual([
      { date: other, game: "sudoku" },
    ]);
    expect(
      await listPublishedDailiesOnWonDates(ctx.db, await createUser()),
    ).toEqual([]);
  });
});
