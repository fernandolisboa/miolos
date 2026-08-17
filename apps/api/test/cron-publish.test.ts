import {
  binairoDailyContentSchema,
  cronPublishResponseSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
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
import { validateNonogram } from "@miolos/games/nonogram";
import { sudokuCriteriaForWeekday, validateSudoku } from "@miolos/games/sudoku";
import { TERMO_ANSWERS } from "@miolos/games/termo";
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
const { insertFailures, insertFailAfter, insertBadDate, boundContent } =
  vi.hoisted(() => ({
    insertFailures: new Set<string>(),
    // The PARTIAL sabotage: this many inserts succeed for that game, every one
    // after it rejects — the only way to reach a run that wrote durable rows
    // and then threw (T-API-S15b).
    insertFailAfter: new Map<string, number>(),
    // T-API-S41's sabotage, and the only one that must produce a REAL
    // `DrizzleQueryError`: the insert is handed an unparseable date so
    // Postgres rejects the statement with the row's `content` already bound
    // into it. Hand-rolling the message would test the test.
    insertBadDate: new Set<string>(),
    // What that statement bound, so the assertion can name the exact string
    // that must not appear in the response.
    boundContent: new Map<string, string>(),
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
      const [db, row] = args;
      if (insertFailures.has(row.game)) {
        return Promise.reject(new Error(`insert sabotaged for ${row.game}`));
      }
      if (insertBadDate.has(row.game)) {
        boundContent.set(row.game, JSON.stringify(row.content));
        // The real statement, the real driver, the real error class — only
        // the date is poisoned, so `content` is bound exactly as it would be
        // on a genuine constraint violation in production.
        return actual.insertDailyPuzzle(db, { ...row, date: "not-a-date" });
      }
      const budget = insertFailAfter.get(row.game);
      if (budget !== undefined) {
        if (budget <= 0) {
          return Promise.reject(new Error(`insert sabotaged for ${row.game}`));
        }
        insertFailAfter.set(row.game, budget - 1);
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

// Hook budget 30_000 ms. The arithmetic, both measured figures, the uncapped
// worst case and the re-derivation tripwire live once, beside `createTestDb`
// in `@miolos/db/testing` (ADR-0055 decision 1 as amended by #114; ADR-0057).
// Do not restate them here — 26 copies rot 26 ways.
//
// Every `it` that triggers a top-up carries its OWN 30_000, and the
// arithmetic is: a run now generates a full week for FOUR games, and the
// sudoku week always contains one tier-5 Sunday board (121 ms mean /
// 346 ms max locally, plan 018 §19.6). Nonogram adds ~34 ms once to build
// all seven memoized pools plus well under 1 ms of generation per week
// (0.0354 ms Mon 5x5 to 0.1902 ms Sun 15x15), and TERMO adds 0.0193 ms for
// a cold week (`service.ts`'s `topUpTermoBuffer` header, measured) plus one
// extra Neon round trip for `listUsedTermoAnswers` — so neither the third
// nor the fourth game moves the total by more than a rounding error and the
// sudoku week still dominates, which is why the constants below are
// unchanged rather than raised. Measured on this branch with four games:
// the heaviest `it` is 970 ms and its siblings 728/708 ms, i.e. ~3 % of the
// ceiling locally and ~13 % at CI's 4x. Re-measured at
// #25: run alone, three times, the heaviest `it` landed at 436, 620 and
// 1 572 ms and the file at 9.6 s; run inside the full parallel `pnpm test`
// the heaviest was 2 789 ms and the file 16.0 s. The spread is sudoku's
// fresh random seeds and runner contention, not nonogram. At CI's ~4x the
// worst of those is ~11 s — inside 30_000 and far OUTSIDE vitest's 5 000 ms
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
  insertFailAfter.clear();
  insertBadDate.clear();
  boundContent.clear();
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
  it("T-API-S1: tops an empty database up to depth 7 for ALL FOUR games, with validated, correctly-dated content", async () => {
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body).toEqual({
      games: {
        termo: { generated: 7, depth: 7, failures: [], error: null },
        binairo: { generated: 7, depth: 7, failures: [], error: null },
        nonogram: { generated: 7, depth: 7, failures: [], error: null },
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

    const nonogramRows = await rowsFor("nonogram");
    expect(nonogramRows.map((row) => row.date).sort()).toEqual(expectedDates);
    for (const row of nonogramRows) {
      const content = nonogramDailyContentSchema.parse(row.content);
      const weekday = isoWeekdayOf(row.date);
      expect(content.weekday).toBe(weekday);
      if (!isWeekday(weekday)) {
        throw new Error(`unreachable: bad weekday for ${row.date}`);
      }
      // validateNonogram takes ONE argument and derives its criteria from the
      // puzzle's own weekday, so the narrowing above is what ties the verdict
      // to the DATE rather than to the puzzle itself.
      const verdict = validateNonogram({ ...content, weekday });
      expect(verdict.ok).toBe(true);
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

    const termoRows = await rowsFor("termo");
    expect(termoRows.map((row) => row.date).sort()).toEqual(expectedDates);
    const eligible = new Map(
      TERMO_ANSWERS.map((answer) => [answer.normalized, answer.canonical]),
    );
    const drawn = new Set<string>();
    for (const row of termoRows) {
      const content = termoDailyContentSchema.parse(row.content);
      // Membership in the curated list, and nothing weaker: a five-letter
      // string that merely parses would satisfy the schema.
      expect(eligible.get(content.normalized)).toBe(content.canonical);
      drawn.add(content.normalized);
      // Termo's `seed` column is PROVENANCE — the accepted uint32 draw — and
      // deliberately NOT part of `content`, unlike the three engines above
      // where `row.seed === content.seed`. It reproduces nothing (ADR-0040).
      expect(Object.keys(content).sort()).toEqual(["canonical", "normalized"]);
      expect(row.seed).toBeGreaterThanOrEqual(0);
      expect(row.seed).toBeLessThan(2 ** 32);
    }
    expect(drawn.size).toBe(7);
  }, 30_000);

  it("T-API-S2: a second run generates nothing for any game (idempotent reconciliation)", async () => {
    await authorizedRun();
    const response = await authorizedRun();
    expect(response.status).toBe(200);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.generated).toBe(0);
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.nonogram.generated).toBe(0);
    expect(body.games.nonogram.depth).toBe(7);
    expect(body.games.sudoku.generated).toBe(0);
    expect(body.games.sudoku.depth).toBe(7);
    expect(body.games.termo.generated).toBe(0);
    expect(body.games.termo.depth).toBe(7);
    expect(await ctx.db.select().from(dailyPuzzles)).toHaveLength(28);
  }, 30_000);

  it("T-API-S3: tops up a partial buffer of every game, existing rows untouched (D14)", async () => {
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
    expect(body.games.nonogram.generated).toBe(2);
    expect(body.games.nonogram.depth).toBe(7);
    expect(body.games.sudoku.generated).toBe(2);
    expect(body.games.sudoku.depth).toBe(7);
    expect(body.games.termo.generated).toBe(2);
    expect(body.games.termo.depth).toBe(7);

    const after = await ctx.db.select().from(dailyPuzzles);
    expect(after).toHaveLength(28);
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
    expect(body.games.nonogram.depth).toBe(7);
    expect(body.games.sudoku.depth).toBe(7);
    expect(body.games.termo.depth).toBe(7);
  }, 30_000);

  it("T-API-S34a: 500 when TERMO alone sits below the effective threshold", async () => {
    // The fourth game inherits the same per-game gate. Termo's drain is the
    // one that can have a CONTENT cause — the word list running out — so a
    // healthy three must never mask it (ADR-0040 consequence (f)).
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'termo' and date <= ${addDays(today, 3)}`,
    );
    const response = await authorizedRun();
    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.termo.depth).toBe(3);
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.nonogram.depth).toBe(7);
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
    expect(body.games.nonogram.depth).toBe(7);
    expect(body.games.sudoku.depth).toBe(3);
    expect(body.games.termo.depth).toBe(7);
  }, 30_000);

  it("T-API-S4: 500 when NONOGRAM alone sits below the effective threshold", async () => {
    // The third game inherits the same per-game gate: a healthy binairo and a
    // healthy sudoku must never mask a drained nonogram.
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now()
            where game = 'nonogram' and date <= ${addDays(today, 3)}`,
    );
    const response = await authorizedRun();
    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo.depth).toBe(7);
    expect(body.games.nonogram.depth).toBe(3);
    expect(body.games.sudoku.depth).toBe(7);
    expect(body.games.termo.depth).toBe(7);
  }, 30_000);

  it("T-API-S4: a tuned-low depth is healthy for every game, not alarming (A3)", async () => {
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
    expect(body.games.nonogram).toEqual({
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
    expect(body.games.termo).toEqual({
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
    expect(await rowsFor("nonogram")).toHaveLength(3);
    expect(await rowsFor("sudoku")).toHaveLength(3);
    expect(await rowsFor("termo")).toHaveLength(3);
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
    expect(body.games.nonogram).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(body.games.sudoku).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(body.games.termo).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(await rowsFor("binairo")).toHaveLength(0);
    expect(await rowsFor("nonogram")).toHaveLength(7);
    expect(await rowsFor("sudoku")).toHaveLength(7);
    expect(await rowsFor("termo")).toHaveLength(7);
  }, 30_000);

  it("T-API-S21: the NONOGRAM top-up throwing never drains the other two", async () => {
    // The third game rides `runTopUp` unchanged — it is per-game and
    // game-generic — so this is the proof that wiring it in bought the same
    // isolation the other two have, and not a new single point of failure
    // sitting between them in the serial order (plan 020 §9.2).
    insertFailures.add("nonogram");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    // The ORIGINAL failure, never `TopUpAbortedError`'s own message.
    expect(body.games.nonogram.error).toContain(
      "insert sabotaged for nonogram",
    );
    expect(body.games.nonogram).toMatchObject({
      generated: 0,
      depth: 0,
      failures: [],
    });
    expect(body.games.binairo).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(body.games.sudoku).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(body.games.termo).toEqual({
      generated: 7,
      depth: 7,
      failures: [],
      error: null,
    });
    expect(await rowsFor("nonogram")).toHaveLength(0);
    expect(await rowsFor("binairo")).toHaveLength(7);
    expect(await rowsFor("sudoku")).toHaveLength(7);
    expect(await rowsFor("termo")).toHaveLength(7);
  }, 30_000);

  it("T-API-S34a: the TERMO top-up throwing never drains the other three", async () => {
    // Termo runs FIRST in the cost-ascending order, which is the position
    // that matters most for isolation: without the per-game try/catch, a
    // termo failure would stop all three of the others from being topped up
    // at all — the exact inversion of the cheapest-first rule's purpose.
    insertFailures.add("termo");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    // The ORIGINAL failure, never `TopUpAbortedError`'s own message.
    expect(body.games.termo.error).toContain("insert sabotaged for termo");
    expect(body.games.termo).toMatchObject({
      generated: 0,
      depth: 0,
      failures: [],
    });
    for (const game of ["binairo", "nonogram", "sudoku"] as const) {
      expect(body.games[game]).toEqual({
        generated: 7,
        depth: 7,
        failures: [],
        error: null,
      });
      expect(await rowsFor(game)).toHaveLength(7);
    }
    expect(await rowsFor("termo")).toHaveLength(0);
  }, 30_000);

  it("T-API-S41: runTopUp never leaks a bound parameter into the response body", async () => {
    // Drizzle's `DrizzleQueryError` embeds the BOUND PARAMETERS in its own
    // message (drizzle-orm/errors.js, separator "\nparams: "), and
    // `runTopUp` writes that string into the /cron/publish RESPONSE BODY and
    // the Vercel log line. For termo the bound parameter is
    // `{"canonical":…,"normalized":…}` for a date up to 30 days in the
    // FUTURE and by definition unpublished — the one thing this ticket
    // exists to withhold. The fix covers the three grid games at the same
    // time, so this runs for termo AND for binairo.
    //
    // The error is produced by driving a genuine statement failure through
    // the PGlite fixture, never by hand-rolling the message: a hand-rolled
    // string would prove the assertion, not the redaction.
    insertBadDate.add("termo");
    insertBadDate.add("binairo");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    const serialized = JSON.stringify(body);

    for (const game of ["termo", "binairo"] as const) {
      const error = body.games[game].error;
      // Positive control, so the negatives below cannot pass vacuously: the
      // operator still gets the query text, which is what they need.
      expect(error).toContain("Failed query:");
      expect(error).toContain("insert into");
      // And the tail is gone — from the field AND from the whole body.
      expect(error).not.toContain("params:");
      const bound = boundContent.get(game);
      expect(bound).toBeDefined();
      expect(error).not.toContain(bound ?? "<never bound>");
      expect(serialized).not.toContain(bound ?? "<never bound>");
    }

    // The answer word itself, named rather than inferred from the JSON blob.
    const termoBound: unknown = JSON.parse(boundContent.get("termo") ?? "null");
    const answer = termoDailyContentSchema.parse(termoBound);
    expect(serialized).not.toContain(answer.canonical);
    expect(serialized).not.toContain(answer.normalized);

    // The log line the operator queries takes the SAME sanitized string.
    for (const line of logLines) {
      expect(line).not.toContain("params:");
      expect(line).not.toContain(answer.normalized);
    }
  }, 30_000);

  it("T-API-S15b: a top-up that wrote rows and then threw reports the rows it wrote", async () => {
    // Three dates covered, then the fourth insert rejects and propagates out
    // of both loops. Nothing rolls the first three back — `insertDailyPuzzle`
    // is one autocommitted statement and no transaction spans the loop — so
    // reporting `generated: 0` would describe a state that never existed
    // (finding `cron-generated-understated-on-partial-failure`).
    insertFailAfter.set("binairo", 3);

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo).toMatchObject({
      generated: 3,
      depth: 3,
      failures: [],
    });
    // The ORIGINAL failure, not the wrapper that carried the counters.
    expect(body.games.binairo.error).toContain("insert sabotaged for binairo");
    expect(await rowsFor("binairo")).toHaveLength(3);
    // The other games are untouched, and the log line the operator queries
    // carries the same number the body does. Index 1, not 0: termo runs
    // FIRST in the cost-ascending order (#27).
    expect(body.games.sudoku.generated).toBe(7);
    const binairoLine: unknown = JSON.parse(logLines[1] ?? "null");
    expect(binairoLine).toMatchObject({
      event: "cron-publish",
      game: "binairo",
      generated: 3,
    });
  }, 30_000);

  it("T-API-S8: one structured log line per game, in the shape the log query reads", async () => {
    await authorizedRun();

    const logged: unknown[] = [];
    for (const line of logLines) {
      const parsed: unknown = JSON.parse(line);
      logged.push(parsed);
    }
    expect(logged).toHaveLength(4);
    // Order is fixed and COST-ASCENDING — termo (0.019 ms) → binairo (~7 ms)
    // → nonogram (~34-80 ms) → sudoku (~150 ms) — so a CPU overrun in an
    // expensive game can never starve a cheaper one (plan 020 P7, plan 022
    // §10.3). #27 is the ticket that made the order stop reading
    // alphabetically: appending termo last would have left these indices
    // untouched, which is a smaller diff and not a principle.
    expect(logged.map((entry) => (entry as { game: string }).game)).toEqual([
      "termo",
      "binairo",
      "nonogram",
      "sudoku",
    ]);
    for (const entry of logged) {
      expect(entry).toMatchObject({
        event: "cron-publish",
        generated: 7,
        depth: 7,
        failures: [],
      });
    }
  }, 30_000);
});

describe("route config", () => {
  it("is force-dynamic (never statically cached)", async () => {
    const route = await import("../app/cron/publish/route");
    expect(route.dynamic).toBe("force-dynamic");
  });
});
