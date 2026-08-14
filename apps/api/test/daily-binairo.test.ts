import { dailyBinairoResponseSchema } from "@miolos/core";
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

// PGlite boot measures ~1.2 s locally, CI runners are ~3-4x slower, and
// worker contention adds to both: 1.2 s x 4 + margin is the ceiling every
// other PGlite file in this suite already carries (plan 017 SS15). This one
// and session.test.ts were the last two riding vitest's 10 s default, and
// #31's added PGlite work is what finally tipped them over it under
// parallel fan-out (napkin item 3).
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
    // Narrowed from the union deliberately: with `sudoku` in
    // `dailyPuzzleResponseSchema` a union parse would ACCEPT a mismatched row
    // on this path and lose a defence-in-depth assertion (plan 018 §7.4).
    const body = dailyBinairoResponseSchema.parse(await response.json());
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
    // Anti-vacuity: `collectKeys` returns an empty set for any non-object
    // input, so without this the forbidden loop passes trivially on an HTML
    // error page (finding `api-leak-scans-have-no-anti-vacuity-assertion`).
    expect(keys.has("givens")).toBe(true);
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

  it("is force-dynamic (a cached daily would serve yesterday's today)", async () => {
    const route = await import("../app/daily/binairo/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
  it("T-API-S27a: is PUBLIC CORS — an origin echo, never credentials", async () => {
    // The sibling of `daily-nonogram.test.ts`'s T-API-S27, landed with it:
    // all three public daily routes carried the TSDoc claim "no auth, no
    // cookies, no credentialed CORS" (ADR-0005) with nothing holding it,
    // while the two credentialed routes asserted theirs. A one-character
    // edit — `corsHeaders({ credentials: true })` — would grant a
    // credentialed cross-origin read with every suite green.
    vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
    await seedDate(await todaySaoPaulo(ctx.db));

    const found = await GET();
    expect(found.headers.get("access-control-allow-origin")).toBe(
      "https://miolos.app",
    );
    expect(found.headers.has("access-control-allow-credentials")).toBe(false);
    // `Vary: Origin` is the credentialed branch's tell — a public response is
    // identical for every origin and must stay cacheable as one.
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
