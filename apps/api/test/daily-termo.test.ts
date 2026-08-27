import { dailyTermoResponseSchema } from "@miolos/core";
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
import { TERMO_ANSWERS } from "@miolos/games/termo";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/daily/termo/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

//

//

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

const ANSWER = TERMO_ANSWERS.find(
  (answer) => answer.canonical !== answer.normalized,
);

async function seedDate(date: string, seed = 7): Promise<void> {
  if (ANSWER === undefined) {
    throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
  }
  await insertDailyPuzzle(ctx.db, {
    game: "termo",
    date,
    seed,
    content: { canonical: ANSWER.canonical, normalized: ANSWER.normalized },
  });
}

describe("GET /daily/termo", () => {
  it("T-API-S35: 200 with a TWO-KEY body; the termo MEMBER contract, never the union", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    expect(response.status).toBe(200);

    const body = dailyTermoResponseSchema.parse(await response.json());
    expect(body).toEqual({ game: "termo", date: today });
    expect(Object.keys(body).sort()).toEqual(["date", "game"]);
  });

  it("T-API-S35: carries no answer key or answer VALUE at any depth (leak scan)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDate(today);
    const response = await GET();
    const raw: unknown = await response.json();
    const keys = collectKeys(raw);

    expect(keys.has("game")).toBe(true);
    expect(keys.has("date")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }

    if (ANSWER === undefined) {
      throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
    }
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain(ANSWER.canonical);
    expect(serialized).not.toContain(ANSWER.normalized);

    expect(await (await GET()).text()).not.toContain(ANSWER.normalized);
  });

  it("T-API-S35: 404 when nothing is published for today", async () => {
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});
  });

  it("T-API-S35: 404 when only future rows exist, at every offset (+1, +2, +30)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    for (const offset of [1, 2, 30]) {
      await seedDate(addDays(today, offset), 100 + offset);
    }
    const response = await GET();
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({});

    if (ANSWER === undefined) {
      throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
    }
    const raw = await (await GET()).text();
    expect(raw).toBe("{}");
    expect(raw).not.toContain(ANSWER.normalized);
  });

  it("T-API-S35: 404 when today's row is killed — no replacement puzzle (ADR-0024)", async () => {
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

  it("T-API-S35: a BINAIRO row published for today never answers this path", async () => {
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

  it("T-API-S35: a drifted content 500s rather than serving an unplayable date", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await insertDailyPuzzle(ctx.db, {
      game: "termo",
      date: today,
      seed: 1,
      content: { canonical: "cafe" },
    });
    await expect(GET()).rejects.toThrow();
  });

  it("T-API-S35: is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/termo/route");
    expect(route.dynamic).toBe("force-dynamic");
  });

  it("T-API-S35: is PUBLIC CORS — an origin echo, never credentials", async () => {
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    await seedDate(await todaySaoPaulo(ctx.db));

    for (const response of [await GET(), await GET()]) {
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://miolos.app",
      );
      expect(response.headers.has("access-control-allow-credentials")).toBe(
        false,
      );

      expect(response.headers.has("vary")).toBe(false);
    }

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
