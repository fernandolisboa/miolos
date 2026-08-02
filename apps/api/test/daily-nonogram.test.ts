import { dailyNonogramResponseSchema } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sql } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/nonogram/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

// Seam 4: the real route over PGlite; the ONLY mock is src/db. Seeding goes
// through insertDailyPuzzle — the same write the cron uses, so published_at
// derivation is the production one.
//
// No per-`it` timeout anywhere below (landmine 25): nonogram generation
// measures 0.0354 ms (Mon 5x5) to 0.1902 ms (Sun 15x15), three orders of
// magnitude under the sudoku boards that made daily-sudoku.test.ts carry
// 30_000, so copying that constant here would be a number with no reason to
// exist. The PGlite boot hook keeps its own, which is what it is for.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

async function seedDate(date: string, seed = 7): Promise<void> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  await insertDailyPuzzle(ctx.db, {
    game: "nonogram",
    date,
    seed,
    content: generateNonogram(seed, weekday),
  });
}

describe("GET /daily/nonogram", () => {
  it("T-API-S26: 200 with today's puzzle; body strict-parses the nonogram MEMBER contract", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    expect(response.status).toBe(200);
    // The member, never the union: a union parse would accept a mismatched
    // row on this path and lose the assertion (plan 018 §7.4, plan 020 §9.4).
    const body = dailyNonogramResponseSchema.parse(await response.json());
    expect(body.game).toBe("nonogram");
    expect(body.date).toBe(today);
    expect(Object.keys(body).sort()).toEqual(["clues", "date", "game", "size"]);
    // The clue rails are the whole playable projection: one line list per row
    // and per column, and `size` agreeing with the nested `clues.size` is
    // what the response schema's refine exists to hold.
    expect(body.clues.size).toBe(body.size);
    expect(body.clues.rows).toHaveLength(body.size);
    expect(body.clues.cols).toHaveLength(body.size);
  });

  it("carries no reveal/motifId/name/mirrored/solution/seed key at any depth (leak scan, not just parse success)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    const raw: unknown = await response.json();
    const keys = collectKeys(raw);
    // Anti-vacuity: the scan is worthless if it walked nothing.
    // `collectKeys` returns an EMPTY set for any non-object input — an HTML
    // error page, `undefined`, a number — so without a positive assertion
    // every `has(forbidden)` below passes trivially. The web page suites have
    // carried this line since #23; the four apps/api scans did not, and this
    // is the only machine check that the wall's nonogram projection is
    // reveal-free on the wire (step-6 round-4 finding
    // `api-leak-scans-have-no-anti-vacuity-assertion`).
    expect(keys.has("clues")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("404 when only future rows exist", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(addDays(today, 1));
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  });

  it("404 when today's row is killed — no replacement puzzle (ADR-0024)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, today));
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  });

  it("future rows never appear regardless of offset (+1, +2, +30)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    for (const offset of [1, 2, 30]) {
      await seedDate(addDays(today, offset), 100 + offset);
    }
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  });

  it("a BINAIRO row published for today never answers this path", async () => {
    // The wall read is game-scoped and the HTTP boundary parses against
    // dailyNonogramResponseSchema rather than the union, so a mismatched row
    // can neither be found nor be serialized — two independent gates.
    const today = await todaySaoPaulo(ctx.db);
    const weekday = isoWeekdayOf(today);
    if (!isWeekday(weekday)) {
      throw new Error(`unreachable: bad weekday for ${today}`);
    }
    await insertDailyPuzzle(ctx.db, {
      game: "binairo",
      date: today,
      seed: 3,
      content: generateBinairo({ seed: 3, weekday }),
    });
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  });

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/nonogram/route");
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("T-API-S27: is PUBLIC CORS — an origin echo, never credentials", async () => {
    // The route's own TSDoc asserts "no auth, no cookies, no credentialed
    // CORS" (ADR-0005), and until this test nothing held it: the two
    // credentialed routes assert their headers, all three public daily routes
    // asserted none of theirs. A one-character edit —
    // `corsHeaders({ credentials: true })`, plausibly pasted from
    // /completions when a fourth game's route is written — would grant a
    // credentialed cross-origin read of the daily with every suite green.
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    await seedDate(await todaySaoPaulo(ctx.db));

    for (const response of [await GET(), await GET()]) {
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://miolos.app",
      );
      expect(response.headers.has("access-control-allow-credentials")).toBe(
        false,
      );
      // `Vary: Origin` is the credentialed branch's tell — a public response
      // is identical for every origin and must stay cacheable as one.
      expect(response.headers.has("vary")).toBe(false);
    }

    // And the 404 branch takes the same headers, so a miss cannot be the way
    // in.
    await ctx.db.execute(sql`truncate table daily_puzzles`);
    const missing = await GET();
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(missing.headers.has("access-control-allow-credentials")).toBe(false);

    vi.stubEnv("WEB_ORIGIN", undefined);
    const unset = await GET();
    expect(unset.headers.has("access-control-allow-origin")).toBe(false);
  });
});
