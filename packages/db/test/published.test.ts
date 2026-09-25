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
  getPublishedNonogramMotifName,
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

    expect(daily?.size).toBe(5);
    expect(daily?.clues.rows).toHaveLength(5);
    expect(daily?.clues.cols).toHaveLength(5);

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

    expect((await getTodayDaily(ctx.db, "termo"))?.game).toBe("termo");
    expect((await getTodayDaily(ctx.db, "binairo"))?.game).toBe("binairo");
    expect((await getTodayDaily(ctx.db, "nonogram"))?.game).toBe("nonogram");
    expect((await getTodayDaily(ctx.db, "sudoku"))?.game).toBe("sudoku");
  });

  it("T-DB-S12: a drifted termo row THROWS rather than serving an unplayable date", async () => {
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

    expect(archived).toEqual(await getPublishedDaily(ctx.db, "binairo", date));
  });

  it("T-DB-S45: getArchivedDaily returns undefined for TODAY's published row — the past-only conjunct, asserted positively", async () => {
    const today = await spDate(0);
    await insertRow({
      date: today,
      publishedAt: sql`now() - interval '1 hour'`,
    });

    expect(await getPublishedDaily(ctx.db, "binairo", today)).toBeDefined();

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

    const ranged = await listArchivedDays(ctx.db, {
      from: dates[1],
      to: dates[2],
    });
    expect(ranged.map((row) => row.date)).toEqual([dates[2], dates[1]]);

    const limited = await listArchivedDays(ctx.db, { limit: 2 });
    expect(limited.map((row) => row.date)).toEqual([dates[3], dates[2]]);
  });

  it("T-DB-S51: listArchivedMonths returns YYYY-MM newest-first, one entry per month, and its last element is min(date)'s month — the archive's floor", async () => {
    const oldest = await spDate(-70);
    const middle = await spDate(-35);
    const newest = await spDate(-1);
    for (const [index, date] of [oldest, middle, newest].entries()) {
      await insertRow({
        date,
        publishedAt: sql`now() - interval '100 days'`,
        seed: index + 1,
      });

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

    expect((await getTodayDaily(ctx.db, "binairo"))?.date).toBe(today);
    expect((await getPublishedDaily(ctx.db, "binairo", today))?.date).toBe(
      today,
    );

    expect((await getPublishedDaily(ctx.db, "binairo", past))?.date).toBe(past);
    expect((await getPublishedDaily(ctx.db, "binairo", future))?.date).toBe(
      future,
    );
    expect(
      (await getPublishedDailyWithSolution(ctx.db, "binairo", future))?.date,
    ).toBe(future);

    expect(
      await getPublishedDaily(ctx.db, "binairo", await spDate(-2)),
    ).toBeUndefined();
  });

  it("T-DB-S53b: the wall is ONE wall — one spelling, by source scan with comments stripped first", async () => {
    const source = await readFile(
      new URL("../src/published.ts", import.meta.url),
      "utf8",
    );

    const code = source
      .replaceAll(/\/\*[\s\S]*?\*\//g, "")
      .replaceAll(/^[ \t]*\/\/.*$/gm, "");
    const occurrences = (needle: RegExp): number =>
      [...code.matchAll(needle)].length;

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

    expect(logged).toHaveLength(1);
    expect(String(logged[0]?.[0])).toContain("binairo");
    expect(String(logged[0]?.[0])).toContain(date);

    await expect(getPublishedDaily(ctx.db, "binairo", date)).rejects.toThrow();
  });

  it("T-DB-S57: archiveDateClass answers past/today/future against the DB clock, reads no table, and never contradicts the archive readers", async () => {
    const past = await spDate(-1);
    const today = await spDate(0);
    const future = await spDate(1);

    expect(await archiveDateClass(ctx.db, past)).toBe("past");
    expect(await archiveDateClass(ctx.db, today)).toBe("today");
    expect(await archiveDateClass(ctx.db, future)).toBe("future");

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

describe("the motif-name read (#64, ADR-0070)", () => {
  async function insertNamed(options: {
    date: string;
    name: string;
    publishedAt: ReturnType<typeof sql>;
    killedAt?: ReturnType<typeof sql>;
  }): Promise<void> {
    const content = nonogramContentFixture();
    const reveal = content["reveal"] as Record<string, unknown>;
    await ctx.db.insert(dailyPuzzles).values({
      game: "nonogram",
      date: options.date,
      seed: 4242,
      content: { ...content, reveal: { ...reveal, name: options.name } },
      publishedAt: options.publishedAt,
      killedAt: options.killedAt,
    });
  }

  it("T-DB-S85: a published row yields its stored `reveal.name`, and nothing else from the row", async () => {
    await insertNamed({
      date: "2026-08-01",
      name: "Âncora",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    expect(await getPublishedNonogramMotifName(ctx.db, "2026-08-01")).toBe(
      "Âncora",
    );

    const value = await getPublishedNonogramMotifName(ctx.db, "2026-08-01");
    expect(typeof value).toBe("string");
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect([...collectKeys(value)], forbidden).not.toContain(forbidden);
    }
  });

  it("T-DB-S86: the wall holds — a future-dated row, a killed row and a missing date all yield `undefined`", async () => {
    const today = await saoPauloToday();

    await insertNamed({
      date: today,
      name: "Amanhã",
      publishedAt: sql`now() + interval '1 day'`,
    });
    expect(await getPublishedNonogramMotifName(ctx.db, today)).toBeUndefined();

    await insertNamed({
      date: "2026-07-31",
      name: "Morto",
      publishedAt: sql`now() - interval '1 hour'`,
      killedAt: sql`now()`,
    });
    expect(
      await getPublishedNonogramMotifName(ctx.db, "2026-07-31"),
    ).toBeUndefined();

    expect(
      await getPublishedNonogramMotifName(ctx.db, "2026-06-15"),
    ).toBeUndefined();

    await ctx.db.insert(dailyPuzzles).values({
      game: "binairo",
      date: "2026-06-20",
      seed: 99,
      content: nonogramContentFixture(),
      publishedAt: sql`now() - interval '1 hour'`,
    });
    expect(
      await getPublishedNonogramMotifName(ctx.db, "2026-06-20"),
    ).toBeUndefined();
  });

  it("T-DB-S87: an EMPTY or whitespace-only stored name normalises to `undefined` — the read that would otherwise 500 the whole day payload", async () => {
    const cases: readonly [string, string][] = [
      ["2026-08-02", ""],
      ["2026-08-03", "   "],
      ["2026-08-04", "\t\n "],

      ["2026-08-06", "​"],
      ["2026-08-07", "﻿​ "],
    ];
    for (const [date, name] of cases) {
      await insertNamed({
        date,
        name,
        publishedAt: sql`now() - interval '1 hour'`,
      });
      expect(
        await getPublishedNonogramMotifName(ctx.db, date),
        JSON.stringify(name),
      ).toBeUndefined();
    }

    await insertNamed({
      date: "2026-08-05",
      name: " Âncora ",
      publishedAt: sql`now() - interval '1 hour'`,
    });
    expect(await getPublishedNonogramMotifName(ctx.db, "2026-08-05")).toBe(
      " Âncora ",
    );
  });
});

describe("surface tripwires (ADR-0024, plan 014 D16 — the mechanical wall)", () => {
  it("T-DB-9a: the wall module exports exactly the audited set", async () => {
    const published = await import("../src/published");

    expect(Object.keys(published).sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "archiveDateClass",
      "getArchivedDaily",
      "getPublishedDaily",
      "getPublishedDailyWithSolution",
      "getPublishedNonogramMotifName",
      "getTodayDaily",
      "listArchivedDays",
      "listArchivedMonths",
    ]);
  });

  it("T-DB-9b: the root barrel exports exactly the wall-only set", async () => {
    const root = await import("../src/index");

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
      "pushSubscriptions",
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

      "getPublishedNonogramMotifName",
      "getRemoteConfig",
      "insertDailyPuzzle",
      "listBufferedDates",

      "listUsedTermoAnswers",
      "remoteConfig",
      "todaySaoPaulo",
    ]);
  });

  it("T-DB-9d: the root client's relational-query surface is the wall-safe subset", async () => {
    const { createDb } = await import("../src/client");
    const db = createDb("postgresql://tripwire:tripwire@localhost:5432/x");
    expect(Object.keys(db.query).sort()).toEqual(["sessions", "users"]);
  });

  it("T-DB-S5: #23 added no runtime export to any package entry", async () => {
    const entries = await Promise.all([
      import("../src/index"),
      import("../src/publishing"),
      import("../src/testing"),
      import("../src/user"),
    ]);
    const surface = entries.flatMap((entry) => Object.keys(entry));
    expect([...new Set(surface)].sort()).toEqual([
      "SAO_PAULO_TIME_ZONE",
      "archiveDateClass",
      "attachTokens",
      "bufferDepth",
      "claimNudgeSend",
      "completions",
      "createDb",
      "createPublishingDb",
      "createTestDb",
      "dailyPuzzles",
      "eq",
      "getArchivedDaily",
      "getCompletion",
      "getPublishedDaily",
      "getPublishedDailyWithSolution",

      "getPublishedNonogramMotifName",
      "getRemoteConfig",
      "getTodayDaily",
      "getUserSince",
      "grantHints",
      "grantedHintsToday",
      "hasCreditedPastDateToday",
      "hintGrants",
      "insertDailyPuzzle",
      "isWinnerLivenessError",
      "listArchivedDays",
      "listArchivedMonths",
      "listBufferedDates",

      "listCompletionsForDay",
      "listCompletionsForMerge",
      "listCompletionsForStats",
      "listCompletionsForStreak",
      "listEmailNudgeCandidates",
      "listMedalGrants",
      "listPushNudgeCandidates",
      "listUsedTermoAnswers",
      "medalGrants",
      "mergeAccounts",

      "notificationSends",
      "pruneSeenDays",

      "pushSubscriptions",
      "readTickInstant",
      "recordCompletion",
      "recordSeenDay",
      "remoteConfig",
      "sessions",
      "sql",
      "todaySaoPaulo",
      "users",
      "wasSeenOn",
    ]);

    expect(surface).toHaveLength(50);
  });
});
