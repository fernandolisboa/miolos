import {
  binairoDailyContentSchema,
  cronPublishResponseSchema,
  sudokuDailyContentSchema,
} from "@miolos/core";
import { sql } from "@miolos/db";
import {
  dailyPuzzles,
  remoteConfig,
  todaySaoPaulo,
  type DailyPuzzleRow,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { isWeekday } from "@miolos/games";
import { validateBinairo } from "@miolos/games/binairo";
import { sudokuCriteriaForWeekday, validateSudoku } from "@miolos/games/sudoku";
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
// migrations underneath, and the real engines for BOTH games. Raw-table
// seeding imports come from @miolos/db/publishing — the root entry
// deliberately does not export them (ADR-0024, plan 014 D16).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

// Per-game insert sabotage for the fault-isolation test (plan 018 §7.2). A
// Set rather than a mutable string keeps the mock free of `as`, and the
// module is spread from the ACTUAL one so every other export stays real.
const { insertFailures } = vi.hoisted(() => ({
  insertFailures: new Set<string>(),
}));

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

vi.mock("@miolos/db/publishing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/publishing")>();
  return {
    ...actual,
    insertDailyPuzzle: (
      ...args: Parameters<typeof actual.insertDailyPuzzle>
    ) => {
      const [, row] = args;
      if (insertFailures.has(row.game)) {
        return Promise.reject(new Error(`insert sabotaged for ${row.game}`));
      }
      return actual.insertDailyPuzzle(...args);
    },
  };
});

const SECRET = "test-cron-secret";

/** The route emits one structured line per game; captured, not silenced. */
const logLines: string[] = [];

function cronRequest(authorization?: string): NextRequest {
  return new NextRequest("http://localhost:3001/cron/publish", {
    headers: authorization ? { authorization } : undefined,
  });
}

async function authorizedRun(): Promise<Response> {
  return GET(cronRequest(`Bearer ${SECRET}`));
}

async function rowsFor(game: string): Promise<DailyPuzzleRow[]> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows.filter((row) => row.game === game);
}

// PGlite boot measures ~1.2 s locally and CI runners are ~3-4x slower;
// 1.2 s x 4 + margin puts the hook ceiling well above vitest's default
// (plan 018 §15).
//
// Every `it` that triggers a top-up carries its OWN 30_000, and the
// arithmetic is: a run now generates a full week for TWO games, and the
// sudoku week always contains one tier-5 Sunday board (121 ms mean /
// 346 ms max locally, plan 018 §19.6). Measured here, the heaviest test
// (a cold two-game top-up, T-API-S1) costs 1 557 ms locally and the tests
// that run the cron twice cost ~1 100 ms; at CI's ~4x that is ~6.2 s —
// comfortably inside 30_000 and comfortably OUTSIDE vitest's 5 000 ms
// default, which is the flake commit 271a935 already paid for once.
beforeAll(async () => {
  ctx = await createTestDb();
  vi.spyOn(console, "log").mockImplementation((...data: unknown[]) => {
    for (const entry of data) {
      if (typeof entry === "string") {
        logLines.push(entry);
      }
    }
  });
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table daily_puzzles`);
  await ctx.db.execute(sql`truncate table remote_config`);
  insertFailures.clear();
  logLines.length = 0;
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
  it("T-API-S1: tops an empty database up to depth 7 for BOTH games, with validated, correctly-dated content", async () => {
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body).toEqual({
      games: {
        binairo: { generated: 7, depth: 7, failures: [], error: null },
        sudoku: { generated: 7, depth: 7, failures: [], error: null },
      },
    });

    const today = await todaySaoPaulo(ctx.db);
    const expectedDates = Array.from({ length: 7 }, (_, offset) =>
      addDays(today, offset),
    );

    const binairoRows = await rowsFor("binairo");
    expect(binairoRows.map((row) => row.date).sort()).toEqual(expectedDates);
    for (const row of binairoRows) {
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

    const sudokuRows = await rowsFor("sudoku");
    expect(sudokuRows.map((row) => row.date).sort()).toEqual(expectedDates);
    for (const row of sudokuRows) {
      const content = sudokuDailyContentSchema.parse(row.content);
      const weekday = isoWeekdayOf(row.date);
      if (!isWeekday(weekday)) {
        throw new Error(`unreachable: bad weekday for ${row.date}`);
      }
      // validateSudoku takes CRITERIA, not a weekday — the criteria table
      // lookup is the mapping under test.
      const verdict = validateSudoku(
        content,
        sudokuCriteriaForWeekday(weekday),
      );
      expect(verdict.approved).toBe(true);
      expect(row.seed).toBe(content.seed);
    }
  }, 30_000);

  it("T-API-S2: a second run generates nothing for either game (idempotent reconciliation)", async () => {
    await authorizedRun();
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.generated).toBe(0);
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.sudoku.generated).toBe(0);
    expect(body.games.sudoku.depth).toBe(7);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(14);
  }, 30_000);

  it("T-API-S3: tops up a partial buffer of both games, existing rows untouched (D14)", async () => {
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    const removed = [addDays(today, 2), addDays(today, 5)];
    await ctx.db.execute(
      sql`delete from daily_puzzles where date in (${removed[0]}, ${removed[1]})`,
    );
    const before = new Map(
      (await ctx.db.select().from(dailyPuzzles)).map((row) => [
        `${row.game}:${row.date}`,
        JSON.stringify({ seed: row.seed, content: row.content }),
      ]),
    );

    const response = await authorizedRun();
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.generated).toBe(2);
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.sudoku.generated).toBe(2);
    expect(body.games.sudoku.depth).toBe(7);

    const after = await ctx.db.select().from(dailyPuzzles);
    expect(after).toHaveLength(14);
    for (const row of after) {
      const snapshot = before.get(`${row.game}:${row.date}`);
      if (snapshot !== undefined) {
        // Byte-identical: the pre-existing rows were never regenerated.
        expect(JSON.stringify({ seed: row.seed, content: row.content })).toBe(
          snapshot,
        );
      }
    }
  }, 30_000);

  it("T-API-S4: 500 when BINAIRO alone sits below the effective threshold", async () => {
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    // Kill four of binairo's seven days (the one sanctioned mutation):
    // killed dates stay covered (never regenerated) but stop counting
    // toward depth, so the re-run honestly lands at 3 < min(4, 7) for
    // binairo while sudoku stays at 7.
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'binairo' and date <= ${addDays(today, 3)}`,
    );
    const response = await authorizedRun();
    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.depth).toBe(3);
    expect(body.games.sudoku.depth).toBe(7);
  }, 30_000);

  it("T-API-S4: 500 when SUDOKU alone sits below the effective threshold", async () => {
    // The named failure mode of a per-game buffer: a healthy binairo must
    // never mask a drained sudoku.
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'sudoku' and date <= ${addDays(today, 3)}`,
    );
    const response = await authorizedRun();
    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.sudoku.depth).toBe(3);
  }, 30_000);

  it("T-API-S4: a tuned-low depth is healthy for both games, not alarming (A3)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 2 });
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    // 2 >= min(4, 2) — healthy by design, for every game.
    expect(body.games.binairo).toEqual({
      generated: 2,
      depth: 2,
      failures: [],
      error: null,
    });
    expect(body.games.sudoku).toEqual({
      generated: 2,
      depth: 2,
      failures: [],
      error: null,
    });
  }, 30_000);

  it("remote_config bufferDepth=3 generates exactly 3 rows per game (AC 4)", async () => {
    await ctx.db.insert(remoteConfig).values({ key: "bufferDepth", value: 3 });
    await authorizedRun();
    expect(await rowsFor("binairo")).toHaveLength(3);
    expect(await rowsFor("sudoku")).toHaveLength(3);
  }, 30_000);

  it("T-API-S15: one game throwing never drains the other's top-up", async () => {
    // Nothing in either top-up catches an insert failure — it propagates
    // out of topUpBinairoBuffer. Without the per-game try/catch in the
    // route, sudoku would simply never run (plan 018 §7.2).
    insertFailures.add("binairo");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.error).not.toBeNull();
    expect(body.games.binairo.error).toContain("insert sabotaged for binairo");
    expect(body.games.binairo).toMatchObject({
      generated: 0,
      depth: 0,
      failures: [],
    });
    expect(body.games.sudoku).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(await rowsFor("binairo")).toHaveLength(0);
    expect(await rowsFor("sudoku")).toHaveLength(7);
  }, 30_000);

  it("T-API-S8: one structured log line per game, in the shape the log query reads", async () => {
    await authorizedRun();

    const logged: unknown[] = [];
    for (const line of logLines) {
      const parsed: unknown = JSON.parse(line);
      logged.push(parsed);
    }
    expect(logged).toHaveLength(2);
    // Order is fixed: the cheap game first, so a sudoku CPU overrun can
    // never starve binairo (plan 018 §7.2).
    expect(logged[0]).toMatchObject({
      event: "cron-publish",
      game: "binairo",
      generated: 7,
      depth: 7,
      failures: [],
    });
    expect(logged[1]).toMatchObject({
      event: "cron-publish",
      game: "sudoku",
      generated: 7,
      depth: 7,
      failures: [],
    });
  }, 30_000);
});

describe("route config", () => {
  it("is force-dynamic (never statically cached)", async () => {
    const route = await import("../app/cron/publish/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
