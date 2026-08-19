import { readFile } from "node:fs/promises";

import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { listUsedTermoAnswers } from "../src/buffer";
import {
  archiveDateClass,
  getArchivedDaily,
  getPublishedDaily,
  getPublishedDailyWithSolution,
  getTodayDaily,
  listArchivedDays,
  listArchivedMonths,
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

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
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

describe("the ARCHIVE wall (#31, ADR-0053 decision 4)", () => {
  /**
   * Every date this suite uses is derived from the DATABASE's São Paulo day,
   * never from a JS clock and never hardcoded: `archivedWallPredicate`'s
   * bound is `date < (the DB clock's SP day)`, so a literal date would pin
   * "past" to whenever the file was written. `offsetDays` is negative for
   * the past and positive for the future.
   */
  async function spDate(offsetDays: number): Promise<string> {
    const rows = await ctx.db.execute(
      sql`select (((now() at time zone 'America/Sao_Paulo')::date) + ${offsetDays}::int)::text as d`,
    );
    return String(rows.rows[0]?.["d"]);
  }

  it("T-DB-S44: getArchivedDaily returns the stripped projection for a published past day", async () => {
    const date = await spDate(-3);
    await insertRow({ date, publishedAt: sql`now() - interval '3 days'` });
    const archived = await getArchivedDaily(ctx.db, "binairo", date);
    expect(archived).toBeDefined();
    expect(archived?.game).toBe("binairo");
    expect(archived?.date).toBe(date);
    // The same row shape `getPublishedDaily` would answer with: one wall,
    // one projection, one extra conjunct.
    expect(archived).toEqual(await getPublishedDaily(ctx.db, "binairo", date));
  });

  it("T-DB-S45: getArchivedDaily returns undefined for TODAY's published row — the past-only conjunct, asserted positively", async () => {
    const today = await spDate(0);
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    // The row is genuinely readable through the shipped wall...
    expect(await getPublishedDaily(ctx.db, "binairo", today)).toBeDefined();
    // ...and invisible to the archive, which is the whole difference.
    expect(await getArchivedDaily(ctx.db, "binairo", today)).toBeUndefined();
  });

  it("T-DB-S46: AC 1's teeth — a future-dated, an unpublished and a killed row are each invisible to getArchivedDaily", async () => {
    const future = await spDate(5);
    const unpublished = await spDate(-4);
    const killed = await spDate(-5);
    await insertRow({
      date: future,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertRow({
      date: unpublished,
      publishedAt: sql`now() + interval '1 day'`,
      seed: 2,
    });
    await insertRow({
      date: killed,
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 3,
    });
    expect(await getArchivedDaily(ctx.db, "binairo", future)).toBeUndefined();
    expect(
      await getArchivedDaily(ctx.db, "binairo", unpublished),
    ).toBeUndefined();
    expect(await getArchivedDaily(ctx.db, "binairo", killed)).toBeUndefined();
  });

  it("T-DB-S47: getArchivedDaily never returns another game's row, and never a solution, a seed or a clue count", async () => {
    const date = await spDate(-2);
    await insertRow({
      date,
      game: "sudoku",
      publishedAt: sql`now() - interval '2 days'`,
    });
    expect(await getArchivedDaily(ctx.db, "binairo", date)).toBeUndefined();
    const archived = await getArchivedDaily(ctx.db, "sudoku", date);
    expect(archived?.game).toBe("sudoku");
    const keys = collectKeys(archived);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("T-DB-S48: listArchivedDays returns (date, game) pairs only, ordered date DESC then game ASC, deterministically", async () => {
    const older = await spDate(-4);
    const newer = await spDate(-2);
    await insertRow({
      date: newer,
      game: "sudoku",
      publishedAt: sql`now() - interval '2 days'`,
    });
    await insertRow({
      date: newer,
      game: "binairo",
      publishedAt: sql`now() - interval '2 days'`,
    });
    await insertRow({
      date: older,
      game: "termo",
      publishedAt: sql`now() - interval '4 days'`,
    });
    const days = await listArchivedDays(ctx.db);
    expect(days).toEqual([
      { date: newer, game: "binairo" },
      { date: newer, game: "sudoku" },
      { date: older, game: "termo" },
    ]);
    // Deterministic across repeated calls: the order is the reader's, not
    // the planner's.
    expect(await listArchivedDays(ctx.db)).toEqual(days);
  });

  it("T-DB-S49: listArchivedDays excludes today, future, unpublished and killed rows — the same four-case wall suite, at the enumeration reader", async () => {
    const past = await spDate(-1);
    const today = await spDate(0);
    const future = await spDate(3);
    const unpublished = await spDate(-6);
    const killed = await spDate(-7);
    await insertRow({ date: past, publishedAt: sql`now() - interval '1 day'` });
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 2,
    });
    await insertRow({
      date: future,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 3,
    });
    await insertRow({
      date: unpublished,
      publishedAt: sql`now() + interval '1 day'`,
      seed: 4,
    });
    await insertRow({
      date: killed,
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 5,
    });
    expect(await listArchivedDays(ctx.db)).toEqual([
      { date: past, game: "binairo" },
    ]);
  });

  it("T-DB-S50: listArchivedDays' from/to bounds are inclusive and compared in SQL; limit caps the rows and never changes the ordering", async () => {
    const dates = [
      await spDate(-5),
      await spDate(-4),
      await spDate(-3),
      await spDate(-2),
    ];
    for (const [index, date] of dates.entries()) {
      await insertRow({
        date,
        publishedAt: sql`now() - interval '10 days'`,
        seed: index + 1,
      });
    }
    // Inclusive at BOTH edges.
    const ranged = await listArchivedDays(ctx.db, {
      from: dates[1],
      to: dates[2],
    });
    expect(ranged.map((row) => row.date)).toEqual([dates[2], dates[1]]);
    // `limit` truncates the same descending order rather than reordering it.
    const limited = await listArchivedDays(ctx.db, { limit: 2 });
    expect(limited.map((row) => row.date)).toEqual([dates[3], dates[2]]);
  });

  it("T-DB-S51: listArchivedMonths returns YYYY-MM newest-first, one entry per month, and its last element is min(date)'s month — the archive's floor", async () => {
    // Three dates spanning at least two calendar months, derived from the DB
    // clock so the assertion never depends on when the suite runs.
    const oldest = await spDate(-70);
    const middle = await spDate(-35);
    const newest = await spDate(-1);
    for (const [index, date] of [oldest, middle, newest].entries()) {
      await insertRow({
        date,
        publishedAt: sql`now() - interval '100 days'`,
        seed: index + 1,
      });
      // A second game on the same date must NOT produce a second month entry.
      await insertRow({
        date,
        game: "sudoku",
        publishedAt: sql`now() - interval '100 days'`,
        seed: index + 10,
      });
    }
    const months = await listArchivedMonths(ctx.db);
    const expected = [
      ...new Set([newest, middle, oldest].map((d) => d.slice(0, 7))),
    ];
    expect(months).toEqual(expected);
    expect(months.at(-1)).toBe(oldest.slice(0, 7));
  });

  it("T-DB-S52: listArchivedMonths excludes a month whose only rows are today's, unpublished or killed", async () => {
    const today = await spDate(0);
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertRow({
      date: await spDate(-400),
      publishedAt: sql`now() + interval '1 day'`,
      seed: 2,
    });
    await insertRow({
      date: await spDate(-800),
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
      seed: 3,
    });
    expect(await listArchivedMonths(ctx.db)).toEqual([]);
  });

  it("T-DB-S53a: the wall is ONE wall — the three shipped readers behave exactly as before over the same seeds", async () => {
    const today = await spDate(0);
    const past = await spDate(-1);
    const future = await spDate(2);
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });
    await insertRow({
      date: past,
      publishedAt: sql`now() - interval '1 day'`,
      seed: 2,
    });
    await insertRow({
      date: future,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 3,
    });
    await insertRow({
      date: await spDate(-2),
      publishedAt: sql`now() + interval '1 hour'`,
      seed: 4,
    });
    // Today's row, through the today reader and the dated one.
    expect((await getTodayDaily(ctx.db, "binairo"))?.date).toBe(today);
    expect((await getPublishedDaily(ctx.db, "binairo", today))?.date).toBe(
      today,
    );
    // A dated past row, and a FUTURE-dated row that is published: the shipped
    // wall carries no date bound at all, and #31 did not give it one.
    expect((await getPublishedDaily(ctx.db, "binairo", past))?.date).toBe(past);
    expect((await getPublishedDaily(ctx.db, "binairo", future))?.date).toBe(
      future,
    );
    expect(
      (await getPublishedDailyWithSolution(ctx.db, "binairo", future))?.date,
    ).toBe(future);
    // An unpublished row stays invisible through both.
    expect(
      await getPublishedDaily(ctx.db, "binairo", await spDate(-2)),
    ).toBeUndefined();
  });

  it("T-DB-S53b: the wall is ONE wall — one spelling, by source scan with comments stripped first", async () => {
    const source = await readFile(
      new URL("../src/published.ts", import.meta.url),
      "utf8",
    );
    // Comment-stripping is LOAD-BEARING, not hygiene: this module's doc
    // blocks discuss the very expressions counted below, so a scan over the
    // raw file would count its own prose and red on a correct module.
    const code = source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^[ \t]*\/\/.*$/gm, "");
    const occurrences = (needle: RegExp): number =>
      [...code.matchAll(needle)].length;
    // ADR-0004's guarantee has ONE enforcement point (ADR-0010 :20,
    // ADR-0014 :16). A second copy of any of the three reds here even when
    // it behaves identically — which behaviour tests cannot catch, and which
    // no test can reach through an export, because the helpers are private.
    expect(occurrences(/dailyPuzzles\.publishedAt/g)).toBe(1);
    expect(occurrences(/isNull\(dailyPuzzles\.killedAt\)/g)).toBe(1);
    expect(occurrences(/killedAt/g)).toBe(1);
    expect(occurrences(/now\(\) at time zone/g)).toBe(1);
  });

  it("T-DB-S54: the archive's list readers hold no content at all — asserted on the returned key sets", async () => {
    const date = await spDate(-1);
    await insertRow({ date, publishedAt: sql`now() - interval '1 day'` });
    const days = await listArchivedDays(ctx.db);
    expect(days).toHaveLength(1);
    for (const row of days) {
      expect(Object.keys(row).sort()).toEqual(["date", "game"]);
    }
    const months = await listArchivedMonths(ctx.db);
    expect(months.every((month) => typeof month === "string")).toBe(true);
  });

  it("T-DB-S55: a row whose content fails to parse makes getArchivedDaily return undefined and log — the two shipped readers still throw", async () => {
    const date = await spDate(-1);
    await ctx.db.insert(dailyPuzzles).values({
      game: "binairo",
      date,
      seed: 1,
      content: { nonsense: true },
      publishedAt: sql`now() - interval '1 day'`,
    });
    const logged: unknown[][] = [];
    const original = console.error;
    console.error = (...args: unknown[]): void => {
      logged.push(args);
    };
    try {
      expect(await getArchivedDaily(ctx.db, "binairo", date)).toBeUndefined();
    } finally {
      console.error = original;
    }
    // The log line IS the alarm (ADR-0053 decision 4), so it names the row.
    expect(logged).toHaveLength(1);
    expect(String(logged[0]?.[0])).toContain("binairo");
    expect(String(logged[0]?.[0])).toContain(date);
    // A bad row on the LIVE readers is an incident, not a 404.
    await expect(getPublishedDaily(ctx.db, "binairo", date)).rejects.toThrow();
  });

  it("T-DB-S57: archiveDateClass answers past/today/future against the DB clock, reads no table, and never contradicts the archive readers", async () => {
    const past = await spDate(-1);
    const today = await spDate(0);
    const future = await spDate(1);
    // It reads no table: the three dates below have no daily_puzzles row at
    // all, and it still answers.
    expect(await archiveDateClass(ctx.db, past)).toBe("past");
    expect(await archiveDateClass(ctx.db, today)).toBe("today");
    expect(await archiveDateClass(ctx.db, future)).toBe("future");
    // And it agrees with the wall: a date the archive readers return is
    // never classified anything but "past" (ADR-0053 decision 1's ordering
    // rests on exactly this).
    await insertRow({ date: past, publishedAt: sql`now() - interval '1 day'` });
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
      seed: 2,
    });
    for (const row of await listArchivedDays(ctx.db)) {
      expect(await archiveDateClass(ctx.db, row.date)).toBe("past");
    }
  });
});

describe("surface tripwires (ADR-0024, plan 014 D16 — the mechanical wall)", () => {
  it("T-DB-9a: the wall module exports exactly the audited set", async () => {
    const published = await import("../src/published");
    // #31 added exactly four (ADR-0053 decision 4): three archive readers,
    // all wall-carrying, plus `archiveDateClass`, which carries no wall
    // because it reads no table — it answers a question about the clock,
    // and every caller has already been through the wall. 4 names became 8.
    expect(Object.keys(published).sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "archiveDateClass",
      "getArchivedDaily",
      "getPublishedDaily",
      "getPublishedDailyWithSolution",
      "getTodayDaily",
      "listArchivedDays",
      "listArchivedMonths",
    ]);
  });

  it("T-DB-9b: the root barrel exports exactly the wall-only set", async () => {
    const root = await import("../src/index");
    // #31: the three archive readers and the date classifier join the root
    // entry — `apps/web` is their only consumer and may hold nothing else.
    // The publishing and user entries are untouched by this row. 8 → 12.
    expect(Object.keys(root).sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "archiveDateClass",
      "createDb",
      "eq",
      "getArchivedDaily",
      "getPublishedDaily",
      "getTodayDaily",
      "listArchivedDays",
      "listArchivedMonths",
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
      "archiveDateClass", // #31 (ADR-0053): the four archive names, root entry
      "attachTokens", // #21 (ADR-0050): widened in the same commit as the export
      "bufferDepth",
      "completions",
      "createDb",
      "createPublishingDb",
      "createTestDb",
      "dailyPuzzles",
      "eq",
      "getArchivedDaily", // #31 (ADR-0053 decision 4)
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
      "listArchivedDays", // #31 (ADR-0053 decision 4)
      "listArchivedMonths", // #31 (ADR-0053 decision 4)
      "listBufferedDates",
      // #83 (ADR-0060): the day-truth reader, user entry only. Widened in
      // place beside `T-DB-9e`, in the same commit as the export.
      "listCompletionsForDay",
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
    // pin the count too: 38 distinct names, 38 exports. #27 moved it by
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
    // (ADR-0052), never the root. #31's write-window PR moved it by
    // ZERO — the late-write ceiling is a guard inside
    // `recordCompletion`'s own INSERT, not a new export (step-6 finding
    // F1) — and its archive PR moves it by exactly four: the three
    // archive readers and the date classifier, on the root entry. #83 moves
    // it by exactly one: `listCompletionsForDay` on the USER entry
    // (ADR-0060 decision 1), never the root — apps/web must stay unable to
    // name it.
    expect(surface).toHaveLength(39);
  });
});
