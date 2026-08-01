import {
  binairoDailyContentSchema,
  cronPublishResponseSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import {
  dailyPuzzles,
  remoteConfig,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { validateBinairo } from "@miolos/games/binairo";
import { NextRequest } from "next/server";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/cron/publish/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";

// Seam 4: the route invoked as a function, PGlite running the committed
// migrations underneath, and the ONLY mock is src/db. Raw-table seeding
// imports come from @miolos/db/publishing — the root entry deliberately
// does not export them (ADR-0024 D16).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

const SECRET = "test-cron-secret";

function cronRequest(authorization?: string): NextRequest {
  return new NextRequest("http://localhost:3001/cron/publish", {
    headers: authorization ? { authorization } : undefined,
  });
}

async function authorizedRun(): Promise<Response> {
  return GET(cronRequest(`Bearer ${SECRET}`));
}

beforeAll(async () => {
  ctx = await createTestDb();
  // The route emits one structured log line per run; keep test output clean.
  vi.spyOn(console, "log").mockImplementation(() => undefined);
});

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  await ctx.db.execute(sql`truncate table remote_config`);
  vi.stubEnv("CRON_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
  vi.restoreAllMocks();
});

describe("GET /cron/publish auth (fail-closed, D15)", () => {
  it("401 without Authorization, and no rows are written", async () => {
    const response = await GET(cronRequest());
    expect(response.status).toBe(401);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(0);
  });

  it("401 with a wrong bearer", async () => {
    const response = await GET(cronRequest("Bearer not-the-secret"));
    expect(response.status).toBe(401);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(0);
  });

  it("401 when CRON_SECRET is unset, even with a bearer", async () => {
    vi.stubEnv("CRON_SECRET", undefined);
    const response = await GET(cronRequest(`Bearer ${SECRET}`));
    expect(response.status).toBe(401);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(0);
  });
});

describe("GET /cron/publish top-up", () => {
  it("tops up an empty database to depth 7 with validated, correctly-dated content", async () => {
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body).toEqual({
      game: "binairo",
      generated: 7,
      depth: 7,
      failures: [],
    });

    const today = await todaySaoPaulo(ctx.db);
    const rows = await ctx.db.select().from(dailyPuzzles);
    const dates = rows.map((row) => row.date).sort();
    expect(dates).toEqual(
      Array.from({ length: 7 }, (_, offset) => addDays(today, offset)),
    );
    for (const row of rows) {
      // Every stored row re-passes the strict contract AND the engine's
      // approval gate for its date's weekday — the mapping proven end to end.
      const content = binairoDailyContentSchema.parse(row.content);
      const weekday = isoWeekdayOf(row.date);
      expect(content.weekday).toBe(weekday);
      if (!isWeekday(weekday)) {
        throw new Error(`unreachable: bad weekday for ${row.date}`);
      }
      const verdict = validateBinairo(content, weekday);
      expect(verdict.approved).toBe(true);
      expect(row.seed).toBe(content.seed);
    }
  });

  it("a second run generates nothing (idempotent reconciliation)", async () => {
    await authorizedRun();
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.generated).toBe(0);
    expect(body.depth).toBe(7);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(7);
  });

  it("tops up a partial buffer, existing rows untouched (D14)", async () => {
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    const removed = [addDays(today, 2), addDays(today, 5)];
    await ctx.db.execute(
      sql`delete from daily_puzzles where date in (${removed[0]}, ${removed[1]})`,
    );
    const before = new Map(
      (await ctx.db.select().from(dailyPuzzles)).map((row) => [
        row.date,
        JSON.stringify({ seed: row.seed, content: row.content }),
      ]),
    );

    const response = await authorizedRun();
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.generated).toBe(2);
    expect(body.depth).toBe(7);

    const after = await ctx.db.select().from(dailyPuzzles);
    expect(after).toHaveLength(7);
    for (const row of after) {
      const snapshot = before.get(row.date);
      if (snapshot !== undefined) {
        // Byte-identical: the pre-existing rows were never regenerated.
        expect(JSON.stringify({ seed: row.seed, content: row.content })).toBe(
          snapshot,
        );
      }
    }
  });

  it("returns 500 when post-run depth sits below the effective threshold", async () => {
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    // Kill four of seven days (the one sanctioned mutation): killed dates
    // stay covered (never regenerated) but stop counting toward depth,
    // so the re-run honestly lands at 3 < min(4, 7).
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where date <= ${addDays(today, 3)}`,
    );
    const response = await authorizedRun();
    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.generated).toBe(0);
    expect(body.depth).toBe(3);
  });

  it("a tuned-low depth is healthy, not alarming (A3)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 2 });
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.generated).toBe(2);
    expect(body.depth).toBe(2); // 2 >= min(4, 2) — healthy by design
  });

  it("remote_config bufferDepth=3 generates exactly 3 rows (AC 4)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 3 });
    await authorizedRun();
    const rows = await ctx.db.select().from(dailyPuzzles);
    expect(rows).toHaveLength(3);
  });
});

describe("route config", () => {
  it("is force-dynamic (never statically cached)", async () => {
    const route = await import("../app/cron/publish/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
