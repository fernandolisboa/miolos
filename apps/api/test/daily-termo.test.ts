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

// Seam 4: the real route over PGlite; the ONLY mock is src/db. Seeding goes
// through insertDailyPuzzle — the same write the cron uses, so published_at
// derivation is the production one.
//
// The FOURTH literal route, and the one whose body carries no puzzle at all
// (ADR-0038, ADR-0040): a Termo player needs the date and nothing else,
// because the board starts empty and every guess is judged server-side. That
// makes the leak scan below the whole of this file's ADR-0004 duty — there is
// no payload to inspect, only keys that must not be there.
//
// No per-`it` timeout anywhere (landmine 25): there is no engine to run at
// all — the seed is an array element — so every case here is a PGlite round
// trip and nothing else. The boot hook keeps its own, which is what it is
// for — on evidence the comment beside `beforeAll` points at.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

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

/**
 * The answer this file seeds, taken from the curated list by INDEX rather
 * than by the top-up's rejection draw: the route is under test, not the
 * publication, and a fixed word is what lets the assertions below name the
 * exact string that must not appear on the wire. An accented one, so
 * `canonical` and `normalized` differ and both are checked.
 */
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
    // The member, never the union: a union parse would accept a mismatched
    // row on this path and lose the assertion (plan 018 §7.4, plan 020 §9.4).
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
    // Anti-vacuity: `collectKeys` returns an EMPTY set for any non-object
    // input, so without a positive assertion every `has(forbidden)` below
    // passes trivially (step-6 round-4 finding
    // `api-leak-scans-have-no-anti-vacuity-assertion`).
    expect(keys.has("game")).toBe(true);
    expect(keys.has("date")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
    // The KEY scan is not enough for this game: the thing withheld is a
    // VALUE, and a projection that shipped it under an innocuous key would
    // pass every assertion above. So the serialized body is searched for the
    // word itself, in both spellings.
    if (ANSWER === undefined) {
      throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
    }
    const serialized = JSON.stringify(raw);
    expect(serialized).not.toContain(ANSWER.canonical);
    expect(serialized).not.toContain(ANSWER.normalized);
    // And the raw response text, in case a future body is not JSON at all.
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
    // The buffer is up to 30 days deep, so a future answer is the one thing
    // this route may never expose (ADR-0004, CLAUDE.md's "Never" list). The
    // 404 body is the empty object, and it stays empty in its RAW text — a
    // key scan on `{}` would pass no matter what the string held.
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
    // The wall read is game-scoped and the HTTP boundary parses against
    // dailyTermoResponseSchema rather than the union, so a mismatched row can
    // neither be found nor be serialized — two independent gates.
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
    // With an empty projection a 200 carries no evidence of anything, so the
    // strict content parse inside the wall is what makes it mean "playable"
    // (plan 022 §8.3). `getTodayDaily` does not catch.
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
    // The route's own TSDoc asserts "no auth, no cookies, no credentialed
    // CORS" (ADR-0005). A one-character edit — `corsHeaders({ credentials:
    // true })`, plausibly pasted from /completions — would grant a
    // credentialed cross-origin read with every other suite green
    // (T-API-S27's argument, instantiated for the fourth route).
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
