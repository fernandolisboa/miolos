import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sql } from "drizzle-orm";
import fc from "fast-check";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  getPublishedDaily,
  getPublishedDailyWithSolution,
  getTodayDaily,
} from "../src/published";
import { dailyPuzzles } from "../src/schema";
import { createTestDb } from "../src/testing";
import { binairoContentFixture } from "./fixtures";

// THE AC-1 WALL SUITE (issue #17, seam 3, ADR-0004/0010/0024). Future
// rows invisible through every reader, kill switch respected, boundary
// instants exact, and the package surface pinned by tripwires. No later
// PR may weaken this suite.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

beforeAll(async () => {
  ctx = await createTestDb();
});

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

/** Raw seeding writes on purpose: the wall under test must not seed itself. */
async function insertRow(options: {
  date: string;
  publishedAt: ReturnType<typeof sql>;
  killedAt?: ReturnType<typeof sql>;
  seed?: number;
}): Promise<void> {
  await ctx.db.insert(dailyPuzzles).values({
    game: "binairo",
    date: options.date,
    seed: options.seed ?? 1,
    content: binairoContentFixture(),
    publishedAt: options.publishedAt,
    killedAt: options.killedAt,
  });
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
          return visible === offsetSeconds <= 0;
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe("surface tripwires (ADR-0024 D16 — the mechanical wall)", () => {
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
});
