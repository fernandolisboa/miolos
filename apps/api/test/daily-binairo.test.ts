import { dailyPuzzleResponseSchema } from "@miolos/core";
import { eq, sql } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/binairo/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

// Seam 4: the real route over PGlite; the ONLY mock is src/db. Seeding
// goes through insertDailyPuzzle — the same write the cron uses, so
// published_at derivation is the production one.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
});

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

/** Every key at any depth of a JSON-shaped value (the leak-scan probe). */
function collectKeys(
  value: unknown,
  into: Set<string> = new Set(),
): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) {
      collectKeys(item, into);
    }
  } else if (value !== null && typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      into.add(key);
      collectKeys(nested, into);
    }
  }
  return into;
}

async function seedDate(date: string, seed = 7): Promise<void> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  await insertDailyPuzzle(ctx.db, {
    game: "binairo",
    date,
    seed,
    content: generateBinairo({ seed, weekday }),
  });
}

describe("GET /daily/binairo", () => {
  it("200 with today's puzzle; body strict-parses the response contract", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = dailyPuzzleResponseSchema.parse(await response.json());
    expect(body.game).toBe("binairo");
    expect(body.date).toBe(today);
    expect(body.size).toBe(8);
  });

  it("carries no solution/seed/reveal/answer key at any depth (leak scan, not just parse success)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    const raw: unknown = await response.json();
    const keys = collectKeys(raw);
    for (const forbidden of ["solution", "seed", "reveal", "answer"]) {
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

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/binairo/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
