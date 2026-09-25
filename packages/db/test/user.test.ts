import { eq, sql } from "drizzle-orm";
import { drizzle as drizzleNeonHttp } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
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

import { todaySaoPaulo } from "../src/buffer";
import type { Db } from "../src/client";
import {
  getCompletion,
  grantHints,
  grantedHintsToday,
  listCompletionsForDay,
  listCompletionsForStreak,
  recordCompletion,
} from "../src/completions";
import * as schema from "../src/schema";
import { completions, hintGrants, userSeenDays, users } from "../src/schema";
import { pruneSeenDays, recordSeenDay, wasSeenOn } from "../src/seen-days";
import { createTestDb } from "../src/testing";

type Dialect = "neonHttp" | "pglite";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(
    sql`truncate table users, completions, hint_grants, medal_grants cascade`,
  );
});

afterEach(() => {
  vi.useRealTimers();
});

afterAll(async () => {
  await ctx.close();
});

async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
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

describe("surface tripwire (ADR-0026, plan 017 D17)", () => {
  it("T-DB-9e: the user entry exports exactly the audited set", async () => {
    const user = await import("../src/user");
    expect(Object.keys(user).sort()).toEqual([
      "attachTokens",

      "claimNudgeSend",
      "completions",
      "consentEvents",

      "getCompletion",
      "getUserSince",
      "grantHints",
      "grantedHintsToday",

      "hasCreditedPastDateToday",
      "hintGrants",
      "isWinnerLivenessError",

      "listCompletionsForDay",
      "listCompletionsForMerge",
      "listCompletionsForStats",
      "listCompletionsForStreak",
      "listEmailNudgeCandidates",
      "listMedalGrants",

      "listPushNudgeCandidates",
      "medalGrants",
      "mergeAccounts",

      "notificationSends",

      "pruneSeenDays",

      "readTickInstant",
      "recordCompletion",
      "recordSeenDay",
      "wasSeenOn",
    ]);
  });
});

describe("recordCompletion (write-once, plan 017 D15)", () => {
  it("T-DB-11: writes the row and reports it wrote it", async () => {
    const userId = await createUser();
    const { record, recorded } = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 272_000,
      hintsUsed: 1,
      onTime: true,
    });

    expect(recorded).toBe(true);
    expect(record.game).toBe("binairo");
    expect(record.date).toBe("2026-08-01");
    expect(record.outcome).toBe("won");
    expect(record.elapsedMs).toBe(272_000);
    expect(record.hintsUsed).toBe(1);
    expect(await ctx.db.select().from(completions)).toHaveLength(1);
  });

  it("T-DB-12: a replay never reopens it — recorded false, completed_at unchanged, same record", async () => {
    const userId = await createUser();
    const first = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 272_000,
      hintsUsed: 0,
      onTime: true,
    });
    const firstRows = await ctx.db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId));
    const firstCompletedAt = firstRows[0]?.completedAt;
    expect(firstCompletedAt).toBeInstanceOf(Date);

    const second = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 999_000,
      hintsUsed: 1,
      onTime: true,
    });

    expect(second.recorded).toBe(false);
    expect(second.record).toEqual(first.record);
    const secondRows = await ctx.db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId));
    expect(secondRows).toHaveLength(1);
    expect(secondRows[0]?.completedAt.toISOString()).toBe(
      firstCompletedAt?.toISOString(),
    );
    expect(secondRows[0]?.elapsedMs).toBe(272_000);
    expect(secondRows[0]?.hintsUsed).toBe(0);
  });

  it("T-DB-13: the stored verdict travels — a today-dated true and a yesterday-dated false read back exactly (re-aimed at #58: the write-time rule itself is T-CORE-S105's claim)", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    const onToday = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });
    const onYesterday = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: addDaysLocal(today, -1),
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: false,
    });

    expect(onToday.record.onTime).toBe(true);
    expect(onYesterday.record.onTime).toBe(false);
  });

  it("T-DB-14: the rollover boundary, faked clock, two distinct identities — the stored verdict is the caller's at both sides (re-aimed at #58: the instant no longer decides)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z"));
    const userA = await createUser();
    const beforeMidnight = await recordCompletion(ctx.db, {
      userId: userA,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z"));
    const userB = await createUser();
    const afterMidnight = await recordCompletion(ctx.db, {
      userId: userB,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: false,
    });

    expect(beforeMidnight.record.onTime).toBe(true);
    expect(afterMidnight.record.onTime).toBe(false);
  });

  it("T-DB-15: the primary key rejects a duplicate even when the writer is bypassed", async () => {
    const userId = await createUser();
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    const thrown = await thrownBy(
      ctx.db.execute(
        sql`insert into completions (user_id, game, date, outcome, elapsed_ms, on_time)
            values (${userId}, 'binairo', '2026-08-01', 'won', 5, true)`,
      ),
    );

    expect(thrown).toBeInstanceOf(Error);
    expect(messages(thrown)).toContain("completions_user_id_game_date_pk");
    expect(await ctx.db.select().from(completions)).toHaveLength(1);
  });
});

describe("getCompletion", () => {
  it("returns undefined when no row exists, and the stored record when one does", async () => {
    const userId = await createUser();
    expect(
      await getCompletion(ctx.db, userId, "binairo", "2026-08-01"),
    ).toBeUndefined();

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 42_000,
      hintsUsed: 0,
      onTime: true,
    });

    const record = await getCompletion(ctx.db, userId, "binairo", "2026-08-01");
    expect(record).toBeDefined();
    expect(record?.elapsedMs).toBe(42_000);

    const otherUserId = await createUser();
    expect(
      await getCompletion(ctx.db, otherUserId, "binairo", "2026-08-01"),
    ).toBeUndefined();
  });
});

describe("listCompletionsForStreak (plan 027 D3, ADR-0009)", () => {
  it("T-DB-S13: returns every row of the user — lost and late included — with the STORED onTime (#58), date descending", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 2_000,
      hintsUsed: 0,
      onTime: false,
    });

    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      elapsedMs: 3_000,
      hintsUsed: 0,
      guesses: 6,
      onTime: true,
    });

    const rows = await listCompletionsForStreak(ctx.db, userId);

    expect(rows).toHaveLength(3);
    expect(rows[2]).toEqual({ date: yesterday, outcome: "won", onTime: false });
    expect(
      [rows[0], rows[1]].sort((a, b) =>
        (a?.outcome ?? "").localeCompare(b?.outcome ?? ""),
      ),
    ).toEqual([
      { date: today, outcome: "lost", onTime: true },
      { date: today, outcome: "won", onTime: true },
    ]);

    expect(Object.keys(rows[0] ?? {}).sort()).toEqual([
      "date",
      "onTime",
      "outcome",
    ]);
  });

  it("T-DB-S14: another user's rows never appear — the first user-scoped list read", async () => {
    const userId = await createUser();
    const otherUserId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await recordCompletion(ctx.db, {
      userId: otherUserId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    expect(await listCompletionsForStreak(ctx.db, userId)).toEqual([]);
    expect(await listCompletionsForStreak(ctx.db, otherUserId)).toHaveLength(1);
  });
});

describe("the late-write ceiling (#31, ADR-0053 decision 13)", () => {
  function lateWrite(
    userId: string,
    date: string,
    ceiling: { day: string; max: number },
  ) {
    return recordCompletion(
      ctx.db,
      {
        userId,
        game: "binairo",
        date,
        outcome: "won",
        elapsedMs: 1_000,
        hintsUsed: 0,

        onTime: false,
      },
      ceiling,
    );
  }

  it("T-DB-S56: the ceiling counts LATE rows by the WRITE instant's São Paulo day, and 49/50/51 is where it bites", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z"));

    const userId = await createUser();
    const otherUserId = await createUser();

    await ctx.db.insert(completions).values([
      ...Array.from({ length: 49 }, (_unused, index) => ({
        userId,
        game: "binairo" as const,
        date: addDaysLocal("2026-01-01", index),
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      })),
      {
        userId,
        game: "sudoku" as const,
        date: "2026-08-10",
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: true,
      },
      {
        userId: otherUserId,
        game: "binairo" as const,
        date: "2026-06-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      },
    ]);

    const fiftieth = await lateWrite(userId, "2026-06-10", {
      day: "2026-08-10",
      max: 50,
    });
    expect(fiftieth).toMatchObject({ capped: false, recorded: true });

    const before = await listCompletionsForStreak(ctx.db, userId);
    const fiftyFirst = await lateWrite(userId, "2026-06-11", {
      day: "2026-08-10",
      max: 50,
    });
    expect(fiftyFirst).toEqual({ capped: true });
    expect(await listCompletionsForStreak(ctx.db, userId)).toHaveLength(
      before.length,
    );

    const replay = await lateWrite(userId, "2026-06-10", {
      day: "2026-08-10",
      max: 50,
    });
    expect(replay).toMatchObject({ capped: false, recorded: false });

    vi.setSystemTime(new Date("2026-08-12T02:00:00Z"));
    const straddler = await createUser();
    const first = await lateWrite(straddler, "2026-05-01", {
      day: "2026-08-11",
      max: 1,
    });
    expect(first).toMatchObject({ capped: false, recorded: true });

    expect(
      await lateWrite(straddler, "2026-05-02", { day: "2026-08-11", max: 1 }),
    ).toEqual({ capped: true });

    expect(
      await lateWrite(straddler, "2026-05-02", { day: "2026-08-12", max: 1 }),
    ).toMatchObject({ capped: false, recorded: true });

    const late = (await listCompletionsForStreak(ctx.db, userId)).filter(
      (row) => !row.onTime,
    );
    expect(late).toHaveLength(50);
  }, 30_000);

  it("T-DB-S56a: the ceiling is enforced INSIDE the insert — twenty concurrent late writes against a ceiling of ten write ten rows", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    const results = await Promise.all(
      Array.from({ length: 20 }, (_unused, index) =>
        lateWrite(userId, addDaysLocal("2026-04-01", index), {
          day: today,
          max: 10,
        }),
      ),
    );

    expect(results.filter((result) => !result.capped)).toHaveLength(10);
    expect(results.filter((result) => result.capped)).toHaveLength(10);
    expect(await listCompletionsForStreak(ctx.db, userId)).toHaveLength(10);
  }, 30_000);

  it("T-DB-S58: the guarded INSERT renders byte-identically through the neon-http and PGlite dialects, as ONE statement", async () => {
    const logged: Record<Dialect, string[]> = { neonHttp: [], pglite: [] };
    const loggerFor = (dialect: Dialect) => ({
      logQuery: (query: string) => {
        logged[dialect].push(query);
      },
    });
    const dialects: Record<Dialect, Db> = {
      neonHttp: drizzleNeonHttp.mock({
        schema,
        logger: loggerFor("neonHttp"),
      }),
      pglite: drizzlePglite.mock({ schema, logger: loggerFor("pglite") }),
    };

    for (const db of Object.values(dialects)) {
      await expect(
        recordCompletion(
          db,
          {
            userId: "00000000-0000-4000-8000-000000000001",
            game: "binairo",
            date: "2026-01-01",
            outcome: "won",
            elapsedMs: 1_000,
            hintsUsed: 0,
            onTime: false,
          },
          { day: "2026-08-10", max: 50 },
        ),
      ).rejects.toThrow();
    }

    const [guardedInsert] = logged.neonHttp;
    if (guardedInsert === undefined) {
      throw new Error("the neon-http dialect logged no statement");
    }

    expect(logged.pglite).toEqual([guardedInsert]);

    expect(guardedInsert.match(/insert into/g)).toHaveLength(1);
    expect(guardedInsert).toContain("select count(*)");
    expect(guardedInsert).not.toContain(";");
  });
});

describe("grantedHintsToday (DORMANT, plan 017 D22)", () => {
  it("T-DB-16: sums only rows dated SP-today", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await grantHints(ctx.db, {
      userId,
      date: today,
      source: "rewarded-ad",
      hints: 2,
    });
    await grantHints(ctx.db, {
      userId,
      date: today,
      source: "rewarded-ad",
      hints: 3,
    });

    expect(await grantedHintsToday(ctx.db, userId)).toBe(5);

    expect(await grantedHintsToday(ctx.db, await createUser())).toBe(0);
  });

  it("T-DB-17: a grant dated SP-yesterday counts 0 — expiry with no job, no TTL, no update", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await grantHints(ctx.db, {
      userId,
      date: today,
      source: "rewarded-ad",
      hints: 3,
    });
    expect(await grantedHintsToday(ctx.db, userId)).toBe(3);

    await ctx.db
      .update(hintGrants)
      .set({ date: addDaysLocal(today, -1) })
      .where(eq(hintGrants.userId, userId));

    expect(await grantedHintsToday(ctx.db, userId)).toBe(0);
    expect(await ctx.db.select().from(hintGrants)).toHaveLength(1);
  });

  it("T-DB-18: a grant dated SP-tomorrow counts 0", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await grantHints(ctx.db, {
      userId,
      date: addDaysLocal(today, 1),
      source: "rewarded-ad",
      hints: 4,
    });

    expect(await grantedHintsToday(ctx.db, userId)).toBe(0);
  });

  it("T-DB-19: grants never accumulate across days", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await grantHints(ctx.db, {
      userId,
      date: today,
      source: "rewarded-ad",
      hints: 3,
    });
    await grantHints(ctx.db, {
      userId,
      date: addDaysLocal(today, -1),
      source: "rewarded-ad",
      hints: 3,
    });

    expect(await grantedHintsToday(ctx.db, userId)).toBe(3);
  });
});

describe("the migration's constraints (ADR-0006 guard, plan 017 §11)", () => {
  it("T-DB-20: hint_grants' column set is exactly the grant-event shape", async () => {
    const result = await ctx.db.execute(
      sql`select column_name from information_schema.columns
           where table_schema = 'public' and table_name = 'hint_grants'
           order by column_name`,
    );
    expect(result.rows.map((row) => row["column_name"])).toEqual([
      "date",
      "granted_at",
      "hints",
      "id",
      "source",
      "user_id",
    ]);
  });

  it("T-DB-21: the CHECK constraints reached the database", async () => {
    const userId = await createUser();

    const badOutcome = await thrownBy(
      ctx.db.execute(
        sql`insert into completions (user_id, game, date, outcome, elapsed_ms, on_time)
            values (${userId}, 'binairo', '2026-08-01', 'draw', 5, true)`,
      ),
    );
    expect(messages(badOutcome)).toContain("completions_outcome_check");

    const zeroHints = await thrownBy(
      ctx.db.execute(
        sql`insert into hint_grants (user_id, date, source, hints)
            values (${userId}, '2026-08-01', 'rewarded-ad', 0)`,
      ),
    );
    expect(messages(zeroHints)).toContain("hint_grants_hints_check");

    const tooManyHints = await thrownBy(
      ctx.db.execute(
        sql`insert into hint_grants (user_id, date, source, hints)
            values (${userId}, '2026-08-01', 'rewarded-ad', 11)`,
      ),
    );
    expect(messages(tooManyHints)).toContain("hint_grants_hints_check");

    const badSource = await thrownBy(
      ctx.db.execute(
        sql`insert into hint_grants (user_id, date, source, hints)
            values (${userId}, '2026-08-01', 'shop', 1)`,
      ),
    );
    expect(messages(badSource)).toContain("hint_grants_source_check");

    expect(await ctx.db.select().from(completions)).toHaveLength(0);
    expect(await ctx.db.select().from(hintGrants)).toHaveLength(0);
  });

  it("T-DB-S11: `guesses` is required for termo, forbidden for the grid games, and bounded 1..6", async () => {
    const userId = await createUser();

    async function insert(
      game: string,
      date: string,
      guesses: number | null,
    ): Promise<unknown> {
      return thrownBy(
        ctx.db.execute(
          sql`insert into completions (user_id, game, date, outcome, elapsed_ms, guesses, on_time)
              values (${userId}, ${game}, ${date}, 'won', 5, ${guesses}, true)`,
        ),
      );
    }

    expect(messages(await insert("termo", "2026-08-01", null))).toContain(
      "completions_guesses_check",
    );

    expect(messages(await insert("binairo", "2026-08-02", 3))).toContain(
      "completions_guesses_check",
    );

    for (const guesses of [0, 7, -1]) {
      expect(
        messages(await insert("termo", "2026-08-03", guesses)),
        `guesses = ${String(guesses)} must be rejected`,
      ).toContain("completions_guesses_check");
    }
    expect(await ctx.db.select().from(completions)).toHaveLength(0);

    for (const guesses of [1, 2, 3, 4, 5, 6]) {
      expect(
        await insert("termo", `2026-07-0${String(guesses)}`, guesses),
        `guesses = ${String(guesses)} must be accepted`,
      ).toBeUndefined();
    }
    expect(await insert("binairo", "2026-07-20", null)).toBeUndefined();
    expect(await ctx.db.select().from(completions)).toHaveLength(7);
  });

  it("T-DB-S11: `recordCompletion` writes the count for termo and NULL for a grid game", async () => {
    const userId = await createUser();

    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: "2026-08-01",
      outcome: "lost",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 6,
      onTime: true,
    });

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      onTime: true,
    });

    const rows = await ctx.db
      .select({ game: completions.game, guesses: completions.guesses })
      .from(completions)
      .orderBy(completions.game);
    expect(rows).toEqual([
      { game: "binairo", guesses: null },
      { game: "termo", guesses: 6 },
    ]);
  });

  it("T-DB-S11: `getCompletion` does NOT project `guesses` — the record is unchanged", async () => {
    const userId = await createUser();
    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 4,
      onTime: true,
    });

    const record = await getCompletion(ctx.db, userId, "termo", "2026-08-01");
    expect(record).toBeDefined();
    expect(Object.keys(record ?? {}).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "hintsUsed",
      "onTime",
      "outcome",
    ]);
  });
});

describe("listCompletionsForDay (#83, ADR-0060)", () => {
  it("T-DB-S59: only that user's rows for exactly that date, with the STORED onTime (#58)", async () => {
    const userId = await createUser();
    const other = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      onTime: true,
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

    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      onTime: false,
    });
    await recordCompletion(ctx.db, {
      userId: other,
      game: "nonogram",
      date: today,
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      onTime: true,
    });

    const rows = await listCompletionsForDay(ctx.db, userId, today);
    expect([...rows].sort((a, b) => a.game.localeCompare(b.game))).toEqual([
      {
        game: "binairo",
        outcome: "won",
        onTime: true,
        elapsedMs: 61_000,
        hintsUsed: 0,
      },
      {
        game: "termo",
        outcome: "lost",
        onTime: true,
        elapsedMs: 61_000,
        hintsUsed: 0,
      },
    ]);

    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "elapsedMs",
        "game",
        "hintsUsed",
        "onTime",
        "outcome",
      ]);
    }

    expect(await listCompletionsForDay(ctx.db, other, today)).toEqual([
      {
        game: "nonogram",
        outcome: "won",
        onTime: true,
        elapsedMs: 61_000,
        hintsUsed: 0,
      },
    ]);

    expect(await listCompletionsForDay(ctx.db, userId, yesterday)).toEqual([
      {
        game: "sudoku",
        outcome: "won",
        onTime: false,
        elapsedMs: 61_000,
        hintsUsed: 0,
      },
    ]);
  });

  it("T-DB-S65: the stored duration and hint count are projected back exactly, per row (#141, widened at #142)", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: today,
      outcome: "won",
      elapsedMs: 512_000,
      hintsUsed: 1,
      onTime: true,
    });
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 0,
      hintsUsed: 0,
      onTime: true,
    });

    const rows = await listCompletionsForDay(ctx.db, userId, today);
    expect([...rows].sort((a, b) => a.game.localeCompare(b.game))).toEqual([
      {
        game: "binairo",
        outcome: "won",
        onTime: true,
        elapsedMs: 0,
        hintsUsed: 0,
      },
      {
        game: "sudoku",
        outcome: "won",
        onTime: true,
        elapsedMs: 512_000,
        hintsUsed: 1,
      },
    ]);
  });

  it("T-DB-S60: the rollover pair reads back the stored verdicts — a post-rollover unseen flush stays false (#58)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z"));
    const onTimeUser = await createUser();
    await recordCompletion(ctx.db, {
      userId: onTimeUser,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z"));
    const lateUser = await createUser();
    await recordCompletion(ctx.db, {
      userId: lateUser,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: false,
    });

    expect(
      await listCompletionsForDay(ctx.db, onTimeUser, "2026-07-31"),
    ).toEqual([
      {
        game: "binairo",
        outcome: "won",
        onTime: true,
        elapsedMs: 1_000,
        hintsUsed: 0,
      },
    ]);

    expect(await listCompletionsForDay(ctx.db, lateUser, "2026-07-31")).toEqual(
      [
        {
          game: "binairo",
          outcome: "won",
          onTime: false,
          elapsedMs: 1_000,
          hintsUsed: 0,
        },
      ],
    );
  });
});

describe("users.onboarding_seen_at (migration 0006, #35, ADR-0061)", () => {
  it("T-DB-S62: the column exists on users, is nullable with no default, and a freshly minted user has it NULL", async () => {
    const catalog = await ctx.db.execute(sql`
      select is_nullable, column_default, data_type
        from information_schema.columns
       where table_name = 'users' and column_name = 'onboarding_seen_at'
    `);
    expect(catalog.rows).toEqual([
      {
        is_nullable: "YES",
        column_default: null,
        data_type: "timestamp with time zone",
      },
    ]);

    const userId = await createUser();
    const rows = await ctx.db
      .select({ onboardingSeenAt: users.onboardingSeenAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(rows).toEqual([{ onboardingSeenAt: null }]);
  });
});

describe("seen days (#58, ADR-0066)", () => {
  it("T-DB-S71: recordSeenDay is idempotent — called twice on one SP day it leaves exactly one row, dated by the DB clock", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    await recordSeenDay(ctx.db, userId);
    await recordSeenDay(ctx.db, userId);

    const rows = await ctx.db
      .select({ userId: userSeenDays.userId, date: userSeenDays.date })
      .from(userSeenDays);
    expect(rows).toEqual([{ userId, date: today }]);

    expect(await wasSeenOn(ctx.db, userId, today)).toBe(true);
    expect(await wasSeenOn(ctx.db, userId, addDaysLocal(today, -1))).toBe(
      false,
    );
    const other = await createUser();
    expect(await wasSeenOn(ctx.db, other, today)).toBe(false);
  });

  it("T-DB-S76: pruneSeenDays deletes only rows older than yesterday — today and yesterday survive, and a re-run is a no-op", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.insert(userSeenDays).values([
      { userId, date: today },
      { userId, date: addDaysLocal(today, -1) },
      { userId, date: addDaysLocal(today, -2) },
      { userId, date: addDaysLocal(today, -40) },
    ]);

    await pruneSeenDays(ctx.db);
    const survivorDates = (
      await ctx.db.select({ date: userSeenDays.date }).from(userSeenDays)
    )
      .map((row) => row.date)
      .sort();
    expect(survivorDates).toEqual([addDaysLocal(today, -1), today].sort());

    await pruneSeenDays(ctx.db);
    expect(await ctx.db.select().from(userSeenDays)).toHaveLength(2);
  });

  it("T-DB-S72: both arms store the supplied onTime VERBATIM and every reader projects the stored value — pinned by rows whose stored value contradicts the old derivation", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: yesterday,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    const guarded = await recordCompletion(
      ctx.db,
      {
        userId,
        game: "sudoku",
        date: yesterday,
        outcome: "won",
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: true,
      },
      { day: today, max: 50 },
    );
    expect(guarded).toMatchObject({ capped: false, recorded: true });

    const record = await getCompletion(ctx.db, userId, "binairo", yesterday);
    expect(record?.onTime).toBe(true);
    const streakRows = await listCompletionsForStreak(ctx.db, userId);
    expect(streakRows.map((row) => row.onTime)).toEqual([true, true]);
    const dayRows = await listCompletionsForDay(ctx.db, userId, yesterday);
    expect(dayRows.map((row) => row.onTime)).toEqual([true, true]);

    const raw = await ctx.db
      .select({ onTime: completions.onTime })
      .from(completions)
      .where(eq(completions.userId, userId));
    expect(raw.map((row) => row.onTime)).toEqual([true, true]);
  });

  it("T-DB-S75: a credited row never consumes the ceiling, and a user AT the ceiling still lands the credited flush — the exemption pinned at the ceiling, not just the count", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    await ctx.db.insert(completions).values(
      Array.from({ length: 3 }, (_unused, index) => ({
        userId,
        game: "binairo" as const,
        date: addDaysLocal(today, -(index + 2)),
        outcome: "won" as const,
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      })),
    );

    const refused = await recordCompletion(
      ctx.db,
      {
        userId,
        game: "sudoku",
        date: addDaysLocal(today, -10),
        outcome: "won",
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      },
      { day: today, max: 3 },
    );
    expect(refused).toEqual({ capped: true });

    const credited = await recordCompletion(ctx.db, {
      userId,
      game: "nonogram",
      date: yesterday,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });
    expect(credited).toMatchObject({ capped: false, recorded: true });
    expect(credited.record.onTime).toBe(true);

    const nextLate = await recordCompletion(
      ctx.db,
      {
        userId,
        game: "termo",
        date: addDaysLocal(today, -20),
        outcome: "lost",
        elapsedMs: 1_000,
        hintsUsed: 0,
        guesses: 6,
        onTime: false,
      },
      { day: today, max: 4 },
    );
    expect(nextLate).toMatchObject({ capped: false, recorded: true });
  });

  it("T-DB-S73: the migration backfill equals the old read-time derivation, promotes only, re-runs as a no-op, and 0009's sweep is the same statement (a pin — ADR-0023's vocabulary)", async () => {
    const { readFileSync } = await import("node:fs");

    const sweepOf = (file: string): string | undefined =>
      readFileSync(new URL(`../migrations/${file}`, import.meta.url), "utf8")
        .split("--> statement-breakpoint")
        .find((statement) => statement.includes('UPDATE "completions"'))
        ?.split("\n")
        .filter((line) => !line.trimStart().startsWith("--"))
        .join("\n")
        .trim();
    const sweep = sweepOf("0008_classy_ink.sql");
    if (sweep === undefined) {
      throw new Error("migration 0008 lost its backfill UPDATE");
    }

    expect(sweepOf("0009_honest_repair.sql")).toBe(sweep);

    const userId = await createUser();

    await ctx.db.insert(completions).values([
      {
        userId,
        game: "binairo" as const,
        date: "2026-08-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-01T15:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      },
      {
        userId,
        game: "sudoku" as const,
        date: "2026-08-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-02T15:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      },
      {
        userId,
        game: "nonogram" as const,
        date: "2026-08-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-02T02:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        onTime: false,
      },
      {
        userId,
        game: "termo" as const,
        date: "2026-08-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-03T15:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
        guesses: 3,
        onTime: true,
      },
    ]);

    await ctx.db.execute(sql.raw(sweep));

    const read = async () =>
      ctx.db
        .select({
          game: completions.game,
          onTime: completions.onTime,
          derivation: sql<boolean>`(${completions.completedAt} at time zone 'America/Sao_Paulo')::date = ${completions.date}`,
        })
        .from(completions)
        .orderBy(completions.game);
    const after = await read();
    expect(after).toEqual([
      { game: "binairo", onTime: true, derivation: true },
      { game: "nonogram", onTime: true, derivation: true },
      { game: "sudoku", onTime: false, derivation: false },

      { game: "termo", onTime: true, derivation: false },
    ]);

    await ctx.db.execute(sql.raw(sweep));
    expect(await read()).toEqual(after);
  });
});
