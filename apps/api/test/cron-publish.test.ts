import {
  binairoDailyContentSchema,
  cronPublishGameResultSchema,
  cronPublishResponseSchema,
  nonogramDailyContentSchema,
  sudokuDailyContentSchema,
  termoDailyContentSchema,
  type CronPublishGameResult,
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

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { insertFailures, insertFailAfter, insertBadDate, boundContent } =
  vi.hoisted(() => ({
    insertFailures: new Set<string>(),

    insertFailAfter: new Map<string, number>(),

    insertBadDate: new Set<string>(),

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

const logLines: string[] = [];

function cronRequest(authorization?: string): NextRequest {
  return new NextRequest("http://localhost:3001/cron/publish", {
    headers: authorization ? { authorization } : undefined,
  });
}

async function authorizedRun(): Promise<Response> {
  return GET(cronRequest(`Bearer ${SECRET}`));
}

function freeTextOf(result: CronPublishGameResult): string[] {
  return [result.error ?? "", ...result.failures.map((entry) => entry.reason)];
}

const loggedResultSchema = cronPublishGameResultSchema.loose();

async function rowsFor(game: string): Promise<DailyPuzzleRow[]> {
  const rows = await ctx.db.select().from(dailyPuzzles);
  return rows.filter((row) => row.game === game);
}

//

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

      expect(eligible.get(content.normalized)).toBe(content.canonical);
      drawn.add(content.normalized);

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
        expect(JSON.stringify({ seed: row.seed, content: row.content })).toBe(
          snapshot,
        );
      }
    }
  }, 30_000);

  it("T-API-S4: 500 when BINAIRO alone sits below the effective threshold", async () => {
    await authorizedRun();
    const today = await todaySaoPaulo(ctx.db);

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
    insertFailures.add("nonogram");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());

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
    insertFailures.add("termo");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());

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
    //

    insertBadDate.add("termo");
    insertBadDate.add("binairo");

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    const serialized = JSON.stringify(body);

    for (const game of ["termo", "binairo"] as const) {
      const error = body.games[game].error;

      expect(error).toContain("Failed query:");
      expect(error).toContain("insert into");

      expect(error).not.toContain("params:");
      const bound = boundContent.get(game);
      expect(bound).toBeDefined();
      expect(error).not.toContain(bound ?? "<never bound>");
      expect(serialized).not.toContain(bound ?? "<never bound>");
    }

    const termoBound: unknown = JSON.parse(boundContent.get("termo") ?? "null");
    const answer = termoDailyContentSchema.parse(termoBound);
    const bodyText = Object.values(body.games).flatMap(freeTextOf);

    const loggedText = logLines.flatMap((line) => {
      expect(line).not.toContain("params:");
      const parsed: unknown = JSON.parse(line);
      return freeTextOf(loggedResultSchema.parse(parsed));
    });
    for (const text of [...bodyText, ...loggedText]) {
      expect(text).not.toContain(answer.canonical);
      expect(text).not.toContain(answer.normalized);

      const collisions = TERMO_ANSWERS.filter(
        (candidate) =>
          text.includes(candidate.canonical) ||
          text.includes(candidate.normalized),
      );
      expect(collisions).toEqual([]);
    }
  }, 30_000);

  it("T-API-S15b: a top-up that wrote rows and then threw reports the rows it wrote", async () => {
    insertFailAfter.set("binairo", 3);

    const response = await authorizedRun();

    expect(response.status).toBe(500);
    const body = cronPublishResponseSchema.parse(await response.json());
    expect(body.games.binairo).toMatchObject({
      generated: 3,
      depth: 3,
      failures: [],
    });

    expect(body.games.binairo.error).toContain("insert sabotaged for binairo");
    expect(await rowsFor("binairo")).toHaveLength(3);

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
