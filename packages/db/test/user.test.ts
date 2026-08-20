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
import { completions, hintGrants, users } from "../src/schema";
import { createTestDb } from "../src/testing";

/** The two dialects `Db` unions, named so T-DB-S58 can compare them. */
type Dialect = "neonHttp" | "pglite";

// The user-scoped suite (issue #18, ADR-0026/ADR-0027, plan 017 §6).
// Two things are proved here and nowhere else: a completion is written
// EXACTLY ONCE and never reopened (D15), and `on_time` is DERIVED in SQL
// from the DB clock (D16) — no JS timezone arithmetic exists in the path.
// The hint-grant half proves the day key IS the expiry (D22), with no
// runtime consumer in v1.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` because sessions references users; completions, hint_grants
  // and medal_grants are children of users too.
  await ctx.db.execute(
    sql`truncate table users, completions, hint_grants, medal_grants cascade`,
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
      // #31 adds NOTHING here. The late-write ceiling (ADR-0053
      // decision 13) is a guard folded into `recordCompletion`'s own
      // INSERT, not a second exported statement — step-6 finding F1. A
      // standalone counter would be both a second round trip and an
      // export with no consumer.
      "getCompletion",
      "getUserSince", // #29 (plan 033): widened in the same commit as the export
      "grantHints",
      "grantedHintsToday",
      "hintGrants",
      "isWinnerLivenessError", // #21 step 7 finding C: the guard's discriminant
      // #83 (ADR-0060): the day-truth reader. This tripwire is WIDENED IN
      // PLACE and gains no new id — a tripwire that counts one more export
      // is the same claim (the `T-DB-9a`/`T-DB-S5` precedent).
      "listCompletionsForDay",
      "listCompletionsForMerge",
      "listCompletionsForStats", // #29 (plan 033): the unfiltered stats projection
      "listCompletionsForStreak",
      "listMedalGrants", // #30 (ADR-0052): widened in the same commit as the export
      "medalGrants", // #30 (ADR-0052): the curated-grant table, user entry only
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

describe("the late-write ceiling (#31, ADR-0053 decision 13)", () => {
  /** One late write, guarded by the ceiling. */
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
      },
      ceiling,
    );
  }

  it("T-DB-S56: the ceiling counts LATE rows by the WRITE instant's São Paulo day, and 49/50/51 is where it bites", async () => {
    // ADR-0053 decision 13. Two properties, asserted together because
    // either one alone is satisfiable by the wrong predicate:
    //
    // (a) THE BOUNDARY, from below as well as above. 49 rows held → the
    //     50th is written; 50 held → the 51st is refused. Seeding 50 and
    //     asserting a refusal would pass identically under `>= 50`,
    //     `>= 49` and `> 48` (step-6 finding F12).
    // (b) THE DAY IS SÃO PAULO'S, not UTC's. The straddle is T-DB-14's
    //     instrument at the ceiling: a row written at 02:00:00Z is SP
    //     23:00 the PREVIOUS day, so it must spend the previous day's
    //     budget. Under a UTC spelling of the same predicate every
    //     assertion below flips (step-6 finding F11).
    //
    // Only `Date` is faked, the T-DB-14 register: PGlite's `now()` follows
    // it, which is what lets two São Paulo write-days be seeded.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-10T12:00:00Z")); // 09:00 in SP

    const userId = await createUser();
    const otherUserId = await createUser();

    // 49 late rows written on SP 2026-08-10, plus one ON-TIME row and one
    // other user's late row — neither of which may spend this budget.
    await ctx.db.insert(completions).values([
      ...Array.from({ length: 49 }, (_unused, index) => ({
        userId,
        game: "binairo" as const,
        date: addDaysLocal("2026-01-01", index),
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
      })),
      {
        userId,
        game: "sudoku" as const,
        date: "2026-08-10",
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
      },
      {
        userId: otherUserId,
        game: "binairo" as const,
        date: "2026-06-01",
        outcome: "won" as const,
        completedAt: new Date("2026-08-10T12:00:00Z"),
        elapsedMs: 1_000,
        hintsUsed: 0,
      },
    ]);

    // 49 held: the 50th lands.
    const fiftieth = await lateWrite(userId, "2026-06-10", {
      day: "2026-08-10",
      max: 50,
    });
    expect(fiftieth).toMatchObject({ capped: false, recorded: true });

    // 50 held: the 51st is refused and writes nothing.
    const before = await listCompletionsForStreak(ctx.db, userId);
    const fiftyFirst = await lateWrite(userId, "2026-06-11", {
      day: "2026-08-10",
      max: 50,
    });
    expect(fiftyFirst).toEqual({ capped: true });
    expect(await listCompletionsForStreak(ctx.db, userId)).toHaveLength(
      before.length,
    );

    // A capped caller can still REPLAY a day it already holds: the guard
    // suppresses the insert, the read-back still answers.
    const replay = await lateWrite(userId, "2026-06-10", {
      day: "2026-08-10",
      max: 50,
    });
    expect(replay).toMatchObject({ capped: false, recorded: false });

    // (b) THE STRADDLE. 02:00:00Z is 23:00 in São Paulo on 2026-08-11's
    // EVE, so this row spends 2026-08-11's budget, not 2026-08-12's.
    vi.setSystemTime(new Date("2026-08-12T02:00:00Z"));
    const straddler = await createUser();
    const first = await lateWrite(straddler, "2026-05-01", {
      day: "2026-08-11",
      max: 1,
    });
    expect(first).toMatchObject({ capped: false, recorded: true });

    // Spent against SP 2026-08-11 — a ceiling of one on that day refuses.
    expect(
      await lateWrite(straddler, "2026-05-02", { day: "2026-08-11", max: 1 }),
    ).toEqual({ capped: true });
    // NOT spent against 2026-08-12, which is what a UTC spelling would say.
    expect(
      await lateWrite(straddler, "2026-05-02", { day: "2026-08-12", max: 1 }),
    ).toMatchObject({ capped: false, recorded: true });

    // The ceiling and the shipped flag can never disagree: everything it
    // counted is exactly what the `on_time` projection calls late.
    const late = (await listCompletionsForStreak(ctx.db, userId)).filter(
      (row) => !row.onTime,
    );
    expect(late).toHaveLength(50);
  }, 30_000);

  it("T-DB-S56a: the ceiling is enforced INSIDE the insert — twenty concurrent late writes against a ceiling of ten write ten rows", async () => {
    // Step-6 finding F1. A `count(*)` read followed by an INSERT is
    // check-then-act: every request in a `Promise.all` reads the same
    // snapshot of the count, passes the same comparison and writes. This
    // is the test that separates the two shapes — measured on this stack,
    // the two-statement form writes 20 rows here and the guarded single
    // statement writes 10.
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
    // THE CEILING IS A CORRECTNESS PROPERTY ONLY WHILE IT IS ONE
    // STATEMENT (ADR-0053 decision 13, `guardedInsertSelect`'s doc block).
    // T-DB-S56a measures that through PGlite — and PGlite is not the
    // driver production runs. `neon-http` is, and every other assertion in
    // this repo about the ceiling is blind to it. The claim was verified
    // once at step 7 with a throwaway probe; a claim the shipped bound
    // rests on is owed a tripwire, so this is it.
    //
    // The instrument is drizzle's own `logger` seam: both sessions call
    // `logQuery` with the rendered SQL *before* handing it to the driver.
    // `drizzle.mock()` gives each driver its real dialect and session over
    // an empty client, so the render happens and the driver call then
    // throws — no network, no second PGlite boot, and, decisively, the
    // statement compared is the one the SHIPPED `recordCompletion` built
    // rather than one this test rebuilt from the same parts.
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
          },
          { day: "2026-08-10", max: 50 },
        ),
      ).rejects.toThrow();
    }

    const [guardedInsert] = logged.neonHttp;
    if (guardedInsert === undefined) {
      // Not an assertion but a guard: if the seam ever stops firing, every
      // expectation below would pass vacuously against `undefined`.
      throw new Error("the neon-http dialect logged no statement");
    }
    // Byte-identical, which is the whole claim.
    expect(logged.pglite).toEqual([guardedInsert]);
    // ONE statement, with the count inside it. If a future edit splits the
    // guard back out — or a dialect ever renders a batch — this is what
    // reds, and it reds before the concurrency test does.
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

/**
 * The day-truth reader (#83, ADR-0060 decision 1): one user, one São Paulo
 * day, at most four rows. The two claims that matter are that the SCOPE is
 * in SQL — never another user's rows and never another day's — and that
 * `onTime` is the same `onTimeSql()` derivation every other reader here
 * projects, taken off the DB clock and never off a JS `Date`.
 */
describe("listCompletionsForDay (#83, ADR-0060)", () => {
  it("T-DB-S59: only that user's rows for exactly that date, with the SQL-derived onTime", async () => {
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
    });
    await recordCompletion(ctx.db, {
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      elapsedMs: 61_000,
      hintsUsed: 0,
      guesses: 6,
    });
    // Another DAY for the same user, and the same day for another USER:
    // neither may appear.
    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
    });
    await recordCompletion(ctx.db, {
      userId: other,
      game: "nonogram",
      date: today,
      outcome: "won",
      elapsedMs: 61_000,
      hintsUsed: 0,
    });

    const rows = await listCompletionsForDay(ctx.db, userId, today);
    expect([...rows].sort((a, b) => a.game.localeCompare(b.game))).toEqual([
      { game: "binairo", outcome: "won", onTime: true, elapsedMs: 61_000 },
      { game: "termo", outcome: "lost", onTime: true, elapsedMs: 61_000 },
    ]);
    // The projection is exactly the four fields the day projection reads
    // (`elapsedMs` since #141, for `dayGamesFromRows`) — still no
    // `completedAt` and no `hintsUsed` on this wire path.
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual([
        "elapsedMs",
        "game",
        "onTime",
        "outcome",
      ]);
    }

    // The other user sees only their own row, and the other day only its.
    expect(await listCompletionsForDay(ctx.db, other, today)).toEqual([
      { game: "nonogram", outcome: "won", onTime: true, elapsedMs: 61_000 },
    ]);
    // Yesterday's row was WRITTEN today, so `onTimeSql()` derives false —
    // the reader returns the row and packages/core turns it into `pending`
    // (ADR-0008 rule 2). The reader never filters; that is the point.
    expect(await listCompletionsForDay(ctx.db, userId, yesterday)).toEqual([
      { game: "sudoku", outcome: "won", onTime: false, elapsedMs: 61_000 },
    ]);
  });

  it("T-DB-S65: the stored duration is projected back exactly, per row (#141)", async () => {
    // The projection claim on its own id: the value the write path stored is
    // the value this reader hands `dayGamesFromRows` — no derivation, no
    // rounding, no default. Distinct per game, so a crossed wire cannot pass.
    const userId = await createUser();
    const today = await todaySaoPaulo(ctx.db);

    await recordCompletion(ctx.db, {
      userId,
      game: "sudoku",
      date: today,
      outcome: "won",
      elapsedMs: 512_000,
      hintsUsed: 0,
    });
    await recordCompletion(ctx.db, {
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      elapsedMs: 0, // the CHECK's own lower bound is a legal stored value
      hintsUsed: 0,
    });

    const rows = await listCompletionsForDay(ctx.db, userId, today);
    expect([...rows].sort((a, b) => a.game.localeCompare(b.game))).toEqual([
      { game: "binairo", outcome: "won", onTime: true, elapsedMs: 0 },
      { game: "sudoku", outcome: "won", onTime: true, elapsedMs: 512_000 },
    ]);
  });

  it("T-DB-S60: the rollover boundary, faked clock — a write instant on the NEXT SP day reads onTime false", async () => {
    // The T-DB-14 idiom: only `Date` is faked, and two identities are
    // mandatory because a same-user replay hits ON CONFLICT DO NOTHING and
    // re-reads the ORIGINAL completed_at.
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z")); // 23:59:59 in SP
    const onTimeUser = await createUser();
    await recordCompletion(ctx.db, {
      userId: onTimeUser,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z")); // 00:00:01 in SP
    const lateUser = await createUser();
    await recordCompletion(ctx.db, {
      userId: lateUser,
      game: "binairo",
      date: "2026-07-31",
      outcome: "won",
      elapsedMs: 1_000,
      hintsUsed: 0,
    });

    expect(
      await listCompletionsForDay(ctx.db, onTimeUser, "2026-07-31"),
    ).toEqual([
      { game: "binairo", outcome: "won", onTime: true, elapsedMs: 1_000 },
    ]);
    // A late win is still a ROW of that day — the reader returns it and the
    // `pending` verdict is packages/core's, in one place (ADR-0026
    // decision 2, ADR-0008 rule 2).
    expect(await listCompletionsForDay(ctx.db, lateUser, "2026-07-31")).toEqual(
      [{ game: "binairo", outcome: "won", onTime: false, elapsedMs: 1_000 }],
    );
  });
});

describe("users.onboarding_seen_at (migration 0006, #35, ADR-0061)", () => {
  it("T-DB-S62: the column exists on users, is nullable with no default, and a freshly minted user has it NULL", async () => {
    // The migration's own shape, read from the live catalog: nullable, no
    // default — every existing row satisfies it instantly, which is what
    // made applying 0006 ahead of the deploy a provable non-event.
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

    // A mint-shaped insert (`values({})` — mintSession's own statement):
    // the fact starts NULL, i.e. "never seen", for every new identity.
    const userId = await createUser();
    const rows = await ctx.db
      .select({ onboardingSeenAt: users.onboardingSeenAt })
      .from(users)
      .where(eq(users.id, userId));
    expect(rows).toEqual([{ onboardingSeenAt: null }]);
  });
});
