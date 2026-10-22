import { addDays, dailyQueensResponseSchema, isoWeekdayOf } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sql } from "@miolos/db";
import { insertDailyPuzzle, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { generateQueens } from "@miolos/games/queens";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/queens/route";

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

async function seedDate(date: string) {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  const puzzle = generateQueens({ seed: 11, weekday });
  await insertDailyPuzzle(ctx.db, {
    game: "queens",
    date,
    seed: puzzle.seed,
    content: puzzle,
  });
  return puzzle;
}

describe("GET /daily/queens", () => {
  it("T-API-S236: 200 with today's region map, strict-parsed, and no withheld key or weekday at any depth", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const puzzle = await seedDate(today);

    const response = await GET();
    expect(response.status).toBe(200);
    const raw: unknown = await response.json();
    expect(dailyQueensResponseSchema.parse(raw)).toEqual({
      game: "queens",
      date: today,
      size: puzzle.size,
      regions: puzzle.regions,
    });

    const keys = collectKeys(raw);
    for (const forbidden of [...FORBIDDEN_DAILY_KEYS, "weekday"]) {
      expect(keys.has(forbidden), forbidden).toBe(false);
    }
  }, 30_000);

  it("T-API-S236: 404 when only future rows exist", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(addDays(today, 1));

    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/queens/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
