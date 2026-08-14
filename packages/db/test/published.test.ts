import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listUsedTermoAnswers } from "../src/buffer";
import {
  getPublishedDaily,
  getPublishedDailyWithSolution,
  getTodayDaily,
} from "../src/published";
import { dailyPuzzles } from "../src/schema";
import { createTestDb } from "../src/testing";
import {
  binairoContentFixture,
  nonogramContentFixture,
  sudokuContentFixture,
  termoContentFixture,
} from "./fixtures";

// THE AC-1 WALL SUITE (issue #17, seam 3, ADR-0004/0010/0024). Future
// rows invisible through every reader, kill switch respected, boundary
// instants exact, and the package surface pinned by tripwires. No later
// PR may weaken this suite.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// PGlite boot + real-migration replay: ~1.2s locally, CI runners 3-4x
// slower — over vitest's 10s hook default on a starved runner (it fired
// on a docs-only PR). Same 30s the sibling suites carry.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

/** The projected games, each with the content fixture the wall parses. */
const CONTENT_FIXTURES: Readonly<
  Record<
    "binairo" | "nonogram" | "sudoku" | "termo",
    () => Record<string, unknown>
  >
> = {
  binairo: binairoContentFixture,
  nonogram: nonogramContentFixture,
  sudoku: sudokuContentFixture,
  termo: termoContentFixture,
};

/**
 * Raw seeding writes on purpose: the wall under test must not seed itself.
 * `game` defaults to binairo so every #17 test above reads unchanged; #23
 * passes "sudoku" and #25 "nonogram", each getting the matching content
 * fixture (plan 018 §15, plan 020 §8). The two-game ternary became a
 * lookup at #25 — a third arm would have been the point where the ternary
 * stopped being readable.
 */
async function insertRow(options: {
  date: string;
  publishedAt: ReturnType<typeof sql>;
  killedAt?: ReturnType<typeof sql>;
  seed?: number;
  game?: keyof typeof CONTENT_FIXTURES;
}): Promise<void> {
  const game = options.game ?? "binairo";
  await ctx.db.insert(dailyPuzzles).values({
    game,
    date: options.date,
    seed: options.seed ?? 1,
    content: CONTENT_FIXTURES[game](),
    publishedAt: options.publishedAt,
    killedAt: options.killedAt,
  });
}

/**
 * The DB clock's America/Sao_Paulo calendar day — the same expression
 * `wallPredicate` uses when `date` is omitted, so a `getTodayDaily` test
 * can name the date it seeded without consulting the JS clock (ADR-0010).
 */
async function saoPauloToday(): Promise<string> {
  const rows = await ctx.db.execute(
    sql`select ((now() at time zone 'America/Sao_Paulo')::date)::text as today`,
  );
  return String(rows.rows[0]?.["today"]);
}

describe("the published-predicate wall", () => {
  it("T-DB-1: getPublishedDaily returns undefined for a future-dated row", async () => {
    await insertRow({
      date: "2026-08-02",
      publishedAt: sql`now() + interval '1 day'`,
    });
    expect(
      await getPublishedDaily(ctx.db, "binairo", "2026-08-02"),
    ).toBeUndefined();
  });

  it("T-DB-2: getTodayDaily returns undefined when only future rows exist", async () => {
    // Today's SP date with a future publication instant, plus genuinely
    // future dates — nothing satisfies the wall.
    const todayRows = await ctx.db.execute(
      sql`select ((now() at time zone 'America/Sao_Paulo')::date)::text as today`,
    );
    const today = String(todayRows.rows[0]?.["today"]);
    await insertRow({
      date: today,
      publishedAt: sql`now() + interval '1 day'`,
    });
    await insertRow({
      date: "2126-01-01",
      publishedAt: sql`now() + interval '100 years'`,
    });
    expect(await getTodayDaily(ctx.db, "binairo")).toBeUndefined();
  });

  it("T-DB-3: a row published exactly at now() is visible (<= boundary)", async () => {
    await insertRow({ date: "2026-08-01", publishedAt: sql`now()` });
    const daily = await getPublishedDaily(ctx.db, "binairo", "2026-08-01");
    expect(daily).toBeDefined();
    expect(daily?.game).toBe("binairo");
    expect(daily?.date).toBe("2026-08-01");
  });

  it("T-DB-4: a row published one second in the future is invisible", async () => {
    await insertRow({
      date: "2026-08-01",
      publishedAt: sql`now() + interval '1 second'`,
    });
    expect(
      await getPublishedDaily(ctx.db, "binairo", "2026-08-01"),
    ).toBeUndefined();
  });

  it("T-DB-5: the kill switch hides an already-published row; its unkilled twin stays visible", async () => {
    await insertRow({
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
    });
    await insertRow({
      date: "2026-07-31",
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 2,
    });
    expect(
      await getPublishedDaily(ctx.db, "binairo", "2026-08-01"),
    ).toBeUndefined();
    expect(
      await getPublishedDaily(ctx.db, "binairo", "2026-07-31"),
    ).toBeDefined();
  });

  it("T-DB-6: getPublishedDailyWithSolution enforces the same predicate", async () => {
    await insertRow({
      date: "2026-08-02",
      publishedAt: sql`now() + interval '1 day'`,
    });
    await insertRow({
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 2,
    });
    await insertRow({
      date: "2026-07-31",
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 3,
    });
    expect(
      await getPublishedDailyWithSolution(ctx.db, "binairo", "2026-08-02"),
    ).toBeUndefined();
    expect(
      await getPublishedDailyWithSolution(ctx.db, "binairo", "2026-08-01"),
    ).toBeUndefined();
    const row = await getPublishedDailyWithSolution(
      ctx.db,
      "binairo",
      "2026-07-31",
    );
    expect(row).toBeDefined();
    // The named-for-danger accessor DOES carry the solution — that is its
    // one job, behind the same wall.
    expect(collectKeys(row?.content).has("solution")).toBe(true);
  });

  it("T-DB-7: the default projection strict-parses and contains no forbidden key at any depth", async () => {
    await insertRow({
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    const daily = await getPublishedDaily(ctx.db, "binairo", "2026-08-01");
    expect(daily).toBeDefined();
    const keys = collectKeys(daily);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("T-DB-8 (property): published_at <= now() ⇔ visibility, over arbitrary offsets", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: -1_000_000, max: 1_000_000 }),
        async (offsetSeconds) => {
          await ctx.db.execute(sql`truncate table daily_puzzles`);
          await insertRow({
            date: "2026-08-01",
            publishedAt: sql`now() + ${offsetSeconds} * interval '1 second'`,
          });
          const visible =
            (await getPublishedDaily(ctx.db, "binairo", "2026-08-01")) !==
            undefined;
          // Named intermediate: Prettier strips the clarifying parens from
          // `visible === (offsetSeconds <= 0)`, so spell the biconditional out.
          const shouldBeVisible = offsetSeconds <= 0;
          return visible === shouldBeVisible;
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe("the wall holds for the second game (#23, plan 018 §6.5)", () => {
  it("T-DB-S1: a future-dated sudoku row is invisible, and so is a killed one", async () => {
    const today = await saoPauloToday();
    await insertRow({
      game: "sudoku",
      date: today,
      publishedAt: sql`now() + interval '1 day'`,
    });
    await insertRow({
      game: "sudoku",
      date: "2026-07-31",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 2,
    });
    expect(await getTodayDaily(ctx.db, "sudoku")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "sudoku", today)).toBeUndefined();
    expect(
      await getPublishedDaily(ctx.db, "sudoku", "2026-07-31"),
    ).toBeUndefined();
    // Same predicate, same answer for the solution-bearing reader.
    expect(
      await getPublishedDailyWithSolution(ctx.db, "sudoku", today),
    ).toBeUndefined();
  });

  it("T-DB-S2: a published sudoku row projects to exactly {game,date,givens,tier}", async () => {
    await insertRow({
      game: "sudoku",
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    const daily = await getPublishedDaily(ctx.db, "sudoku", "2026-08-01");
    expect(daily).toBeDefined();
    expect(Object.keys(daily ?? {}).sort()).toEqual([
      "date",
      "game",
      "givens",
      "tier",
    ]);
    expect(daily?.date).toBe("2026-08-01");
    // `tier` only type-checks because the reader is narrowed to the game it
    // was asked for — on the un-narrowed union this line is a compile error,
    // which is what made this test red before src/published.ts changed.
    expect(daily?.tier).toBe(3);
    expect(daily?.givens).toHaveLength(81);
    const keys = collectKeys(daily);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("T-DB-S3: a game-scoped read never returns another game's row for the same date", async () => {
    const today = await saoPauloToday();
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    expect(await getTodayDaily(ctx.db, "sudoku")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "sudoku", today)).toBeUndefined();

    await insertRow({
      game: "sudoku",
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 2,
    });
    expect((await getTodayDaily(ctx.db, "sudoku"))?.game).toBe("sudoku");
    expect((await getTodayDaily(ctx.db, "binairo"))?.game).toBe("binairo");
    expect((await getPublishedDaily(ctx.db, "sudoku", today))?.game).toBe(
      "sudoku",
    );
    expect((await getPublishedDaily(ctx.db, "binairo", today))?.game).toBe(
      "binairo",
    );
  });

  it("T-DB-S4: the narrowing is machine-checked — every seeded shape returns sudoku at runtime", async () => {
    const today = await saoPauloToday();
    // The enumerated row shapes a sudoku read can meet. The src narrowing
    // is an `as` restating what stripDailyContent already proved; this loop
    // is the proof, taken on the real value rather than on the type.
    const companions: readonly (readonly [string, () => Promise<void>])[] = [
      ["no companion row", () => Promise.resolve()],
      [
        "a live binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() - interval '1 hour'`,
            seed: 2,
          }),
      ],
      [
        "a killed binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() - interval '1 hour'`,
            killedAt: sql`now()`,
            seed: 3,
          }),
      ],
      [
        "a future-dated binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() + interval '1 day'`,
            seed: 4,
          }),
      ],
    ];

    for (const [shape, seedCompanion] of companions) {
      await ctx.db.execute(sql`truncate table daily_puzzles`);
      // The companion goes in FIRST, deliberately: the readers take
      // `limit(1)` with no ORDER BY, so a game-blind predicate would hand
      // back the binairo row by insertion order and the assertions below
      // would go red. Seeding sudoku first made this test pass under a
      // mutation that deleted `eq(dailyPuzzles.game, game)`.
      await seedCompanion();
      await insertRow({
        game: "sudoku",
        date: today,
        publishedAt: sql`now() - interval '1 hour'`,
      });
      const fromToday = await getTodayDaily(ctx.db, "sudoku");
      const fromDate = await getPublishedDaily(ctx.db, "sudoku", today);
      expect(fromToday?.game, shape).toBe("sudoku");
      expect(fromDate?.game, shape).toBe("sudoku");
      expect(fromToday?.tier, shape).toBe(3);
      expect(fromDate?.tier, shape).toBe(3);
    }
  });
});

describe("the wall holds for the third game (#25, plan 020 §8)", () => {
  it("T-DB-S6: a future-dated nonogram row is invisible, and so is a killed one", async () => {
    const today = await saoPauloToday();
    await insertRow({
      game: "nonogram",
      date: today,
      publishedAt: sql`now() + interval '1 day'`,
    });
    await insertRow({
      game: "nonogram",
      date: "2026-07-31",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 2,
    });
    expect(await getTodayDaily(ctx.db, "nonogram")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "nonogram", today)).toBeUndefined();
    expect(
      await getPublishedDaily(ctx.db, "nonogram", "2026-07-31"),
    ).toBeUndefined();
    // Same predicate, same answer for the solution-bearing reader.
    expect(
      await getPublishedDailyWithSolution(ctx.db, "nonogram", today),
    ).toBeUndefined();
  });

  it("T-DB-S7: a published nonogram row projects to exactly {game,date,size,clues}", async () => {
    await insertRow({
      game: "nonogram",
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    const daily = await getPublishedDaily(ctx.db, "nonogram", "2026-08-01");
    expect(daily).toBeDefined();
    expect(Object.keys(daily ?? {}).sort()).toEqual([
      "clues",
      "date",
      "game",
      "size",
    ]);
    expect(daily?.date).toBe("2026-08-01");
    // `clues` only type-checks because the reader is narrowed to the game it
    // was asked for — on the un-narrowed union this line is a compile error.
    expect(daily?.size).toBe(5);
    expect(daily?.clues.rows).toHaveLength(5);
    expect(daily?.clues.cols).toHaveLength(5);
    // ADR-0033: the whole reveal is withheld, so the identity keys the strip
    // drops are the ones FORBIDDEN_DAILY_KEYS now names.
    const keys = collectKeys(daily);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("T-DB-S8: a game-scoped read never returns another game's row for the same date", async () => {
    const today = await saoPauloToday();
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertRow({
      game: "sudoku",
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 2,
    });
    expect(await getTodayDaily(ctx.db, "nonogram")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "nonogram", today)).toBeUndefined();

    await insertRow({
      game: "nonogram",
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 3,
    });
    // All three games live on the same date: each read answers with its own.
    expect((await getTodayDaily(ctx.db, "nonogram"))?.game).toBe("nonogram");
    expect((await getTodayDaily(ctx.db, "binairo"))?.game).toBe("binairo");
    expect((await getTodayDaily(ctx.db, "sudoku"))?.game).toBe("sudoku");
    expect((await getPublishedDaily(ctx.db, "nonogram", today))?.game).toBe(
      "nonogram",
    );
    expect((await getPublishedDaily(ctx.db, "binairo", today))?.game).toBe(
      "binairo",
    );
    expect((await getPublishedDaily(ctx.db, "sudoku", today))?.game).toBe(
      "sudoku",
    );
  });

  it("T-DB-S9: the narrowing is machine-checked — every seeded shape returns nonogram at runtime", async () => {
    const today = await saoPauloToday();
    const companions: readonly (readonly [string, () => Promise<void>])[] = [
      ["no companion row", () => Promise.resolve()],
      [
        "a live binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() - interval '1 hour'`,
            seed: 2,
          }),
      ],
      [
        "a killed binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() - interval '1 hour'`,
            killedAt: sql`now()`,
            seed: 3,
          }),
      ],
      [
        "a future-dated binairo row for the same date",
        () =>
          insertRow({
            date: today,
            publishedAt: sql`now() + interval '1 day'`,
            seed: 4,
          }),
      ],
    ];

    for (const [shape, seedCompanion] of companions) {
      await ctx.db.execute(sql`truncate table daily_puzzles`);
      // The companion goes in FIRST, deliberately — same reason as T-DB-S4:
      // the readers take `limit(1)` with no ORDER BY, so a game-blind
      // predicate would hand back the binairo row by insertion order.
      await seedCompanion();
      await insertRow({
        game: "nonogram",
        date: today,
        publishedAt: sql`now() - interval '1 hour'`,
      });
      const fromToday = await getTodayDaily(ctx.db, "nonogram");
      const fromDate = await getPublishedDaily(ctx.db, "nonogram", today);
      expect(fromToday?.game, shape).toBe("nonogram");
      expect(fromDate?.game, shape).toBe("nonogram");
      expect(fromToday?.clues.size, shape).toBe(5);
      expect(fromDate?.clues.size, shape).toBe(5);
    }
  });
});

describe("the wall holds for the fourth game (#27, plan 022 §9)", () => {
  // T-DB-S12. Termo's projection is EMPTY — `{game, date}` and nothing else
  // — so the wall's job here is entirely about which rows are visible. That
  // makes this the sharpest of the four wall suites, not the slackest: with
  // no payload to inspect, "the row is invisible" is the only property left,
  // and a leaked FUTURE date is the whole of ADR-0004 for this game.
  it("T-DB-S12: a published termo row projects to exactly {game,date}", async () => {
    await insertRow({
      game: "termo",
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    const daily = await getPublishedDaily(ctx.db, "termo", "2026-08-01");
    expect(daily).toBeDefined();
    expect(Object.keys(daily ?? {}).sort()).toEqual(["date", "game"]);
    expect(daily?.date).toBe("2026-08-01");
    expect(daily?.game).toBe("termo");
    // The answer word is in the ROW and must be in nothing the wall returns.
    const keys = collectKeys(daily);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
    expect(JSON.stringify(daily)).not.toContain("pombo");
  });

  it("T-DB-S12: future-dated and killed termo rows are invisible through every reader", async () => {
    const today = await saoPauloToday();
    await insertRow({
      game: "termo",
      date: today,
      publishedAt: sql`now() + interval '1 day'`,
    });
    expect(await getTodayDaily(ctx.db, "termo")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "termo", today)).toBeUndefined();
    expect(
      await getPublishedDailyWithSolution(ctx.db, "termo", today),
    ).toBeUndefined();

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await insertRow({
      game: "termo",
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
    });
    expect(await getTodayDaily(ctx.db, "termo")).toBeUndefined();
    expect(await getPublishedDaily(ctx.db, "termo", today)).toBeUndefined();
    expect(
      await getPublishedDailyWithSolution(ctx.db, "termo", today),
    ).toBeUndefined();
  });

  it("T-DB-S12: a game-scoped read never answers with another game's row", async () => {
    const today = await saoPauloToday();
    for (const game of ["binairo", "nonogram", "sudoku"] as const) {
      await insertRow({
        game,
        date: today,
        publishedAt: sql`now() - interval '1 hour'`,
      });
    }
    expect(await getTodayDaily(ctx.db, "termo")).toBeUndefined();

    await insertRow({
      game: "termo",
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 4,
    });
    // All four games live on the same date: each read answers with its own.
    expect((await getTodayDaily(ctx.db, "termo"))?.game).toBe("termo");
    expect((await getTodayDaily(ctx.db, "binairo"))?.game).toBe("binairo");
    expect((await getTodayDaily(ctx.db, "nonogram"))?.game).toBe("nonogram");
    expect((await getTodayDaily(ctx.db, "sudoku"))?.game).toBe("sudoku");
  });

  it("T-DB-S12: a drifted termo row THROWS rather than serving an unplayable date", async () => {
    // The empty projection means a 200 carries no evidence of anything, so
    // the strict content parse inside the wall is what makes it mean
    // "playable" (plan 022 §8.3). `getTodayDaily` does not catch.
    await ctx.db.insert(dailyPuzzles).values({
      game: "termo",
      date: "2026-08-01",
      seed: 1,
      content: { canonical: "pombo" },
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await expect(
      getPublishedDaily(ctx.db, "termo", "2026-08-01"),
    ).rejects.toThrow();
  });
});

describe("listUsedTermoAnswers (#27, ADR-0040's no-repeat rule)", () => {
  /**
   * Raw seeding with a CHOSEN answer — `insertRow` above always writes the
   * one fixture word, and this suite is entirely about telling several
   * answers apart.
   */
  async function insertTermoRow(options: {
    date: string;
    normalized: string;
    publishedAt: ReturnType<typeof sql>;
    killedAt?: ReturnType<typeof sql>;
  }): Promise<void> {
    await ctx.db.insert(dailyPuzzles).values({
      game: "termo",
      date: options.date,
      seed: 1,
      content: {
        canonical: options.normalized,
        normalized: options.normalized,
      },
      publishedAt: options.publishedAt,
      killedAt: options.killedAt,
    });
  }

  it("T-DB-S10: returns killed AND unpublished AND past answers — an answer is spent forever", async () => {
    // The three row states a date filter or a `killed_at` filter would drop,
    // and each one has already reached a player or may yet: a killed date's
    // answer may have been served before the kill, and a past date's
    // certainly was. This is a STRONGER rule than `listBufferedDates`'
    // (ADR-0024 D14) — that one is about coverage, this one about spend.
    await insertTermoRow({
      date: "2026-07-01",
      normalized: "passe",
      publishedAt: sql`now() - interval '30 days'`,
    });
    await insertTermoRow({
      date: "2026-08-01",
      normalized: "morto",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
    });
    await insertTermoRow({
      date: "2126-01-01",
      normalized: "adiar",
      publishedAt: sql`now() + interval '100 years'`,
    });

    const used = await listUsedTermoAnswers(ctx.db);
    expect([...used].sort()).toEqual(["adiar", "morto", "passe"]);
  });

  it("T-DB-S10: a binairo row is NOT returned (the anti-vacuity half)", async () => {
    // Without this the query could be reading every row in the table and the
    // assertion above would still pass. The other three games' content has no
    // `normalized` key at all, so a game-blind read would return nulls rather
    // than words — and dropping nulls silently would look identical.
    await insertRow({
      game: "binairo",
      date: "2026-08-01",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertRow({
      game: "nonogram",
      date: "2026-08-02",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertTermoRow({
      date: "2026-08-03",
      normalized: "sarau",
      publishedAt: sql`now() - interval '1 hour'`,
    });

    expect(await listUsedTermoAnswers(ctx.db)).toEqual(["sarau"]);
  });

  it("T-DB-S10: an empty table returns an empty list, never a null", async () => {
    expect(await listUsedTermoAnswers(ctx.db)).toEqual([]);
  });

  it("T-DB-S10: reads `normalized` and not `canonical` — the ASCII form is the key", async () => {
    // `normalized` is `^[a-z]{5}$` by the word-list harness, so the
    // comparison cannot be defeated by a jsonb round-trip that composes a
    // diacritic differently. A read of `canonical` would hand the top-up an
    // accented string to compare against `TermoAnswer.normalized`, and every
    // accented answer would then be eligible twice.
    await ctx.db.insert(dailyPuzzles).values({
      game: "termo",
      date: "2026-08-01",
      seed: 1,
      content: { canonical: "então", normalized: "entao" },
      publishedAt: sql`now() - interval '1 hour'`,
    });
    expect(await listUsedTermoAnswers(ctx.db)).toEqual(["entao"]);
  });
});

describe("surface tripwires (ADR-0024, plan 014 D16 — the mechanical wall)", () => {
  it("T-DB-9a: the wall module exports exactly the audited set", async () => {
    const published = await import("../src/published");
    expect(Object.keys(published).sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "getPublishedDaily",
      "getPublishedDailyWithSolution",
      "getTodayDaily",
    ]);
  });

  it("T-DB-9b: the root barrel exports exactly the wall-only set", async () => {
    const root = await import("../src/index");
    expect(Object.keys(root).sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "createDb",
      "eq",
      "getPublishedDaily",
      "getTodayDaily",
      "sessions",
      "sql",
      "users",
    ]);
  });

  it("T-DB-9c: the publishing entry exports exactly the audited dangerous set", async () => {
    const publishing = await import("../src/publishing");
    expect(Object.keys(publishing).sort()).toEqual([
      "bufferDepth",
      "createPublishingDb",
      "dailyPuzzles",
      "getPublishedDailyWithSolution",
      "getRemoteConfig",
      "insertDailyPuzzle",
      "listBufferedDates",
      // #27's ONE addition to this entry: `listUsedTermoAnswers`, the first
      // top-up read-back of stored `content` in the package (plan 022 §9.2).
      // 9 names became 10; if any other line in this block needed editing,
      // something was added to the wrong surface (landmine L5).
      "listUsedTermoAnswers",
      "remoteConfig",
      "todaySaoPaulo",
    ]);
  });

  it("T-DB-9d: the root client's relational-query surface is the wall-safe subset", async () => {
    // The wall must hold for QUERY CAPABILITY, not just named exports:
    // `db.query.dailyPuzzles.findMany()` on a root-entry client would read
    // solution-bearing unpublished rows without any /publishing import.
    // neon() performs no I/O at construction — the URL is a dummy.
    const { createDb } = await import("../src/client");
    const db = createDb("postgresql://tripwire:tripwire@localhost:5432/x");
    expect(Object.keys(db.query).sort()).toEqual(["sessions", "users"]);
  });

  it("T-DB-S5: #23 added no runtime export to any package entry", async () => {
    // The generic wall (plan 018 S11) is a SIGNATURE change: two readers
    // become generic in `game` and nothing is added to the surface. T-DB-9a
    // through T-DB-9e compare Object.keys() per module and are blind to a
    // signature, which is the point — they come out of this ticket
    // byte-identical (plan 018 §19.5). This asserts the same property once
    // across every package.json subpath, so a sudoku-specific helper added
    // to ANY entry fails here even if someone "fixed" a per-module list.
    const entries = await Promise.all([
      import("../src/index"),
      import("../src/publishing"),
      import("../src/testing"),
      import("../src/user"),
    ]);
    const surface = entries.flatMap((entry) => Object.keys(entry));
    expect([...new Set(surface)].sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "attachTokens", // #21 (ADR-0050): widened in the same commit as the export
      "bufferDepth",
      "completions",
      "countLateCompletionsWrittenOn", // #31 (ADR-0053 decision 13): the user entry, never the root
      "createDb",
      "createPublishingDb",
      "createTestDb",
      "dailyPuzzles",
      "eq",
      "getCompletion",
      "getPublishedDaily",
      "getPublishedDailyWithSolution",
      "getRemoteConfig",
      "getTodayDaily",
      "getUserSince", // #29 (plan 033): widened in the same commit as the export
      "grantHints",
      "grantedHintsToday",
      "hintGrants",
      "insertDailyPuzzle",
      "isWinnerLivenessError", // #21 step 7 finding C: the guard's discriminant
      "listBufferedDates",
      "listCompletionsForMerge",
      "listCompletionsForStats", // #29 (plan 033): the unfiltered stats projection
      "listCompletionsForStreak",
      "listMedalGrants", // #30 (ADR-0052): widened in the same commit as the export
      "listUsedTermoAnswers",
      "medalGrants", // #30 (ADR-0052): the curated-grant table, user entry only
      "mergeAccounts",
      "recordCompletion",
      "remoteConfig",
      "sessions",
      "sql",
      "todaySaoPaulo",
      "users",
    ]);
    // A duplicate across two entries would be hidden by the Set above, so
    // pin the count too: 35 distinct names, 35 exports. #27 moved it by
    // exactly one — `listUsedTermoAnswers` on the publishing entry — #19 by
    // one more: `listCompletionsForStreak` on the user entry (plan 027 §6),
    // #20 by two: `listCompletionsForMerge` and `mergeAccounts` on the
    // user entry (plan 029 §6), #21 by one: `attachTokens` on the user
    // entry (ADR-0050, ADR-0026 decision 5), never the root, #21's
    // step 7 by one more: `isWinnerLivenessError` on the user entry
    // (finding C — the confirm route's retry discriminant), #29 by
    // exactly two: `listCompletionsForStats` and `getUserSince` on the
    // user entry (plan 033 §3.1), never the root, and #30 by exactly
    // two: `listMedalGrants` and `medalGrants` on the user entry
    // (ADR-0052), never the root. #31 moves it by exactly five across two
    // PRs: `countLateCompletionsWrittenOn` on the user entry here (the
    // archive write ceiling's counter, ADR-0053 decision 13), then the
    // three archive readers and the date classifier on the root entry.
    expect(surface).toHaveLength(35);
  });
});
