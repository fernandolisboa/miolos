import { eq, sql } from "drizzle-orm";
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
import {
  getCompletion,
  grantHints,
  grantedHintsToday,
  listCompletionsForStreak,
  recordCompletion,
} from "../src/completions";
import { completions, hintGrants, users } from "../src/schema";
import { createTestDb } from "../src/testing";

// The user-scoped suite (issue #18, ADR-0026/ADR-0027, plan 017 §6).
// Two things are proved here and nowhere else: a completion is written
// EXACTLY ONCE and never reopened (D15), and `on_time` is DERIVED in SQL
// from the DB clock (D16) — no JS timezone arithmetic exists in the path.
// The hint-grant half proves the day key IS the expiry (D22), with no
// runtime consumer in v1.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower;
// 1.2 s × 4 + margin puts the ceiling well above vitest's 10 s default,
// which would otherwise flake this file on CI alone (plan 017 §15).
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` because sessions references users; completions and
  // hint_grants are children of users too.
  await ctx.db.execute(
    sql`truncate table users, completions, hint_grants cascade`,
  );
});

afterEach(() => {
  // T-DB-14 is the only faker; restoring unconditionally keeps a failure
  // there from poisoning every test after it.
  vi.useRealTimers();
});

afterAll(async () => {
  await ctx.close();
});

/** A fresh anonymous identity — the FK parent every row below needs. */
async function createUser(): Promise<string> {
  const inserted = await ctx.db.insert(users).values({}).returning();
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

/** Drizzle wraps the driver error; the constraint name lives down the cause chain. */
function messages(error: unknown): string {
  let out = "";
  let current: unknown = error;
  while (current instanceof Error) {
    out += current.message;
    current = current.cause;
  }
  return out;
}

/** Runs `statement` and returns whatever it threw (undefined when it did not). */
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
      "attachTokens", // #21 (ADR-0050): widened in the same commit as the export
      "completions",
      "getCompletion",
      "getUserSince", // #29 (plan 033): widened in the same commit as the export
      "grantHints",
      "grantedHintsToday",
      "hintGrants",
      "isWinnerLivenessError", // #21 step 7 finding C: the guard's discriminant
      "listCompletionsForMerge",
      "listCompletionsForStats", // #29 (plan 033): the unfiltered stats projection
      "listCompletionsForStreak",
      "mergeAccounts",
      "recordCompletion",
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
    });
    const firstRows = await ctx.db
      .select()
      .from(completions)
      .where(eq(completions.userId, userId));
    const firstCompletedAt = firstRows[0]?.completedAt;
    expect(firstCompletedAt).toBeInstanceOf(Date);

    // Different statistics on purpose: an ON CONFLICT DO UPDATE would take
    // them, bump completed_at, and silently reclassify an on-time
    // completion as late. DO NOTHING is what makes that impossible.
    const second = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 999_000,
      hintsUsed: 1,
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

  it("T-DB-13: the puzzle's own date carries the on-time case — no clock fake needed", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    const onToday = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });
    const onYesterday = await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: addDaysLocal(today, -1),
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });

    expect(onToday.record.onTime).toBe(true);
    expect(onYesterday.record.onTime).toBe(false);
  });

  it("T-DB-14: the rollover boundary, faked clock, two distinct identities", async () => {
    // Two identities are MANDATORY: a same-user replay hits ON CONFLICT DO
    // NOTHING and re-reads the ORIGINAL completed_at, so a single-identity
    // version would assert `true` twice and prove nothing (plan 017 §19.4).
    // Only `Date` is faked — faking setTimeout/queueMicrotask risks
    // stalling PGlite's async wasm pump.
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z")); // 23:59:59 in SP
    const userA = await createUser();
    const beforeMidnight = await recordCompletion(ctx.db, {
      userId: userA,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z")); // 00:00:01 in SP
    const userB = await createUser();
    const afterMidnight = await recordCompletion(ctx.db, {
      userId: userB,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
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
    });

    const thrown = await thrownBy(
      ctx.db.execute(
        sql`insert into completions (user_id, game, date, outcome, elapsed_ms)
            values (${userId}, 'binairo', '2026-08-01', 'won', 5)`,
      ),
    );

    expect(thrown).toBeInstanceOf(Error);
    expect(messages(thrown)).toContain("completions_user_id_game_date_pk");
    expect(await ctx.db.select().from(completions)).toHaveLength(1);
  });
});

describe("getCompletion", () => {
  it("returns undefined when no row exists, and the SQL-derived record when one does", async () => {
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
    });

    const record = await getCompletion(ctx.db, userId, "binairo", "2026-08-01");
    expect(record).toBeDefined();
    expect(record?.elapsedMs).toBe(42_000);
    // Another user's row is never visible through this reader.
    const otherUserId = await createUser();
    expect(
      await getCompletion(ctx.db, otherUserId, "binairo", "2026-08-01"),
    ).toBeUndefined();
  });
});

describe("listCompletionsForStreak (plan 027 D3, ADR-0009)", () => {
  it("T-DB-S13: returns every row of the user — lost and late included — with the SQL-derived onTime, date descending", async () => {
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDaysLocal(today, -1);

    // An on-time win: written on its own SP day (T-DB-13's construction).
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });
    // A LATE win: dated yesterday, completed_at is now — outside its day.
    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 2_000,
      hintsUsed: 0,
    });
    // A lost Termo, on time: the row the reader must NOT filter — the pure
    // function in packages/core is the only place it is excluded (D3).
    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      elapsedMs: 3_000,
      hintsUsed: 0,
      guesses: 6,
    });

    const rows = await listCompletionsForStreak(ctx.db, userId);
    // Date descending; within a date the order is not part of the contract,
    // so the today pair is compared as a set.
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
    // The projection is exactly the StreakRow shape — no completedAt leaks.
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
    });

    expect(await listCompletionsForStreak(ctx.db, userId)).toEqual([]);
    expect(await listCompletionsForStreak(ctx.db, otherUserId)).toHaveLength(1);
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
    // Another user's grants are never counted.
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

    // Moving the day key back IS the rollover: nothing decrements, nothing
    // is deleted, and the grant is simply gone from "today".
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
    // A future `hints_remaining`/`balance`/`credits` column is exactly the
    // accumulable balance ADR-0006 forbids; this tripwire makes adding one
    // fail the suite rather than pass review.
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
        sql`insert into completions (user_id, game, date, outcome, elapsed_ms)
            values (${userId}, 'binairo', '2026-08-01', 'draw', 5)`,
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

  /**
   * T-DB-S11 (plan 022 §19.4) — `completions_guesses_check`, the #27
   * migration. The CHECK is an EQUALITY between two booleans, deliberately
   * stronger than a permissive `is null or …`: it makes a termo row WITHOUT a
   * count and a grid row WITH one both impossible. The ten cases below are
   * the whole truth table that matters.
   */
  it("T-DB-S11: `guesses` is required for termo, forbidden for the grid games, and bounded 1..6", async () => {
    const userId = await createUser();

    async function insert(
      game: string,
      date: string,
      guesses: number | null,
    ): Promise<unknown> {
      return thrownBy(
        ctx.db.execute(
          sql`insert into completions (user_id, game, date, outcome, elapsed_ms, guesses)
              values (${userId}, ${game}, ${date}, 'won', 5, ${guesses})`,
        ),
      );
    }

    // A termo row without a count: the write-once row (ADR-0026 decision 1)
    // could never be backfilled, so the column is not allowed to be optional
    // for the one game that owes it.
    expect(messages(await insert("termo", "2026-08-01", null))).toContain(
      "completions_guesses_check",
    );
    // A grid row WITH one: the count has no meaning there and a future reader
    // of the distribution must not have to ask which rows are honest.
    expect(messages(await insert("binairo", "2026-08-02", 3))).toContain(
      "completions_guesses_check",
    );
    // The range, at both ends. 0 is not a game (a board with no guess is not
    // a completion) and 7 is past MAX_GUESSES.
    for (const guesses of [0, 7, -1]) {
      expect(
        messages(await insert("termo", "2026-08-03", guesses)),
        `guesses = ${String(guesses)} must be rejected`,
      ).toContain("completions_guesses_check");
    }
    expect(await ctx.db.select().from(completions)).toHaveLength(0);

    // 1..6 accept, one row each — and a grid row with NULL accepts, which is
    // the pre-existing shape every row on `main` already has.
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
    });
    // Omitted entirely for a grid game — drizzle emits the SQL keyword
    // `default` for an un-supplied column, which is NULL here. That is also
    // why this column's migration had to reach Neon BEFORE any deploy: the
    // column appears in the INSERT list for all four games (ADR-0038 (h)).
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
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
    // WRITE-ONLY in #27, and the omission is load-bearing: widening
    // `CompletionRecord` would make `completionResponseSchema.parse({
    // ...record, recorded })` — a `z.strictObject` at the route — throw on
    // EVERY completion in the app. The statistics ticket adds the projection
    // when it needs it.
    const userId = await createUser();
    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: "2026-08-01",
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 4,
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
