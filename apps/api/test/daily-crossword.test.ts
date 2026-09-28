import { dailyCrosswordResponseSchema } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sql } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import {
  generateCrossword,
  type CrosswordPuzzle,
} from "@miolos/games/crossword";
import { generateBinairo } from "@miolos/games/binairo";
import { isWeekday } from "@miolos/games";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/crossword/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

const puzzle: CrosswordPuzzle = generateCrossword(7);

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
});

afterAll(async () => {
  await ctx.close();
});

async function seedDate(date: string): Promise<void> {
  await insertDailyPuzzle(ctx.db, {
    game: "crossword",
    date,
    seed: puzzle.seed,
    content: puzzle,
  });
}

describe("GET /daily/crossword", () => {
  it("T-API-S220: 200 with today's puzzle; body strict-parses the crossword response contract", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    expect(response.status).toBe(200);
    const body = dailyCrosswordResponseSchema.parse(await response.json());
    expect(body.game).toBe("crossword");
    expect(body.date).toBe(today);
    expect(body.grid).toHaveLength(5);
    expect(body.clues.length).toBeGreaterThan(0);
    expect(Object.keys(body).sort()).toEqual(["clues", "date", "game", "grid"]);
  }, 30_000);

  it("T-API-S220: carries no seed/canonical/normalized key at any depth (leak scan, not just parse success)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    const raw: unknown = await response.json();
    const keys = collectKeys(raw);

    expect(keys.has("grid")).toBe(true);
    expect(keys.has("clues")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  }, 30_000);

  it("404 when only future rows exist", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(addDays(today, 1));
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

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
  }, 30_000);

  it("future rows never appear regardless of offset (+1, +2, +30)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    for (const offset of [1, 2, 30]) {
      await seedDate(addDays(today, offset));
    }
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  }, 30_000);

  it("a BINAIRO row published for today never answers this path", async () => {
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
  }, 30_000);

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/crossword/route");
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("is PUBLIC CORS — an origin echo, never credentials", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    await seedDate(await todaySaoPaulo(ctx.db));

    const found = await GET();
    expect(found.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(found.headers.has("access-control-allow-credentials")).toBe(false);

    expect(found.headers.has("vary")).toBe(false);

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    const missing = await GET();
    expect(missing.status).toBe(404);
    expect(missing.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(missing.headers.has("access-control-allow-credentials")).toBe(false);

    vi.stubEnv("WEB_ORIGIN", undefined);
    expect((await GET()).headers.has("access-control-allow-origin")).toBe(
      false,
    );
  });
});
