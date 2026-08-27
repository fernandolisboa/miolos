import {
  completionResponseSchema,
  nonogramDailyContentSchema,
  statsResponseSchema,
  streakResponseSchema,
  type StatsResponse,
  type StreakResponse,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sessions, sql, users } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions, hasCreditedPastDateToday } from "@miolos/db/user";
import { isWeekday, type Weekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku, type SudokuPuzzle } from "@miolos/games/sudoku";
import { isValidGuess, TERMO_ANSWERS } from "@miolos/games/termo";
import { readFile } from "node:fs/promises";
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

import { OPTIONS, POST } from "../app/completions/route";

import { GET as statsGet } from "../app/stats/route";
import { GET as streakGet } from "../app/streak/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { getDbCalls, wallReadCalls } = vi.hoisted(() => ({
  getDbCalls: vi.fn(),
  wallReadCalls: vi.fn(),
}));

vi.mock("../src/db", () => ({
  getDb: () => {
    getDbCalls();
    return ctx.db;
  },
}));

vi.mock("@miolos/db/publishing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@miolos/db/publishing")>();
  return {
    ...actual,
    getPublishedDailyWithSolution: (
      ...args: Parameters<typeof actual.getPublishedDailyWithSolution>
    ) => {
      wallReadCalls();
      return actual.getPublishedDailyWithSolution(...args);
    },
  };
});

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  getDbCalls.mockClear();
  wallReadCalls.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();

  vi.useRealTimers();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = "https://miolos.app";

type SubmittableGame = "binairo" | "nonogram" | "sudoku";

function rowMajorPicture(
  solution: ReadonlyArray<ReadonlyArray<boolean>>,
): readonly number[] {
  return solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
}

function columnMajorPicture(
  solution: ReadonlyArray<ReadonlyArray<boolean>>,
): readonly number[] {
  const size = solution.length;
  return Array.from({ length: size * size }, (_unused, index) => {
    const row = index % size;
    const column = Math.floor(index / size);
    return solution[row]?.[column] === true ? 1 : 0;
  });
}

const sudokuCache = new Map<string, SudokuPuzzle>();

function sudokuPuzzle(seed: number, weekday: number): SudokuPuzzle {
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday ${String(weekday)}`);
  }
  const key = `${String(weekday)}:${String(seed)}`;
  const cached = sudokuCache.get(key);
  if (cached) {
    return cached;
  }
  const puzzle = generateDailySudoku({ seed, weekday });
  sudokuCache.set(key, puzzle);
  return puzzle;
}

async function createSession(): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  const token = generateSessionToken();
  await ctx.db
    .insert(sessions)
    .values({ tokenHash: await hashSessionToken(token), userId: user.id });
  return { token, userId: user.id };
}

async function seedDaily(
  game: SubmittableGame,
  date: string,
  seed = 7,

  nonogramWeekday?: Weekday,
): Promise<readonly number[]> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  if (game === "nonogram") {
    const puzzle = generateNonogram(seed, nonogramWeekday ?? weekday);
    await insertDailyPuzzle(ctx.db, { game, date, seed, content: puzzle });
    return rowMajorPicture(puzzle.reveal.solution);
  }
  const content =
    game === "binairo"
      ? generateBinairo({ seed, weekday })
      : sudokuPuzzle(seed, weekday);
  await insertDailyPuzzle(ctx.db, { game, date, seed, content });
  return content.solution;
}

function completionRequest(init: {
  body?: string;
  token?: string;

  contentType?: string | null;
  secFetchSite?: string;
  origin?: string;
}): NextRequest {
  const headers = new Headers();
  const contentType =
    init.contentType === undefined ? "application/json" : init.contentType;
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }
  if (init.token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${init.token}`);
  }
  if (init.secFetchSite !== undefined) {
    headers.set("sec-fetch-site", init.secFetchSite);
  }
  if (init.origin !== undefined) {
    headers.set("origin", init.origin);
  }
  return new NextRequest("http://localhost:3001/completions", {
    method: "POST",
    headers,
    body: init.body,
  });
}

function completionBody(init: {
  game: SubmittableGame;
  date: string;
  grid: readonly number[];
  elapsedMs?: number;
  hintsUsed?: number;
}): string {
  return JSON.stringify({
    game: init.game,
    date: init.date,
    grid: [...init.grid],
    elapsedMs: init.elapsedMs ?? 61_000,
    hintsUsed: init.hintsUsed ?? 0,
  });
}

function wrongGrid(
  game: SubmittableGame,
  solution: readonly number[],
): readonly number[] {
  return solution.map((cell, index) => {
    if (index !== 0) {
      return cell;
    }
    return game === "sudoku" ? (cell % 9) + 1 : cell === 0 ? 1 : 0;
  });
}

async function completionRows(): Promise<unknown[]> {
  return ctx.db.select().from(completions);
}

const TERMO_ANSWER = TERMO_ANSWERS.find(
  (candidate) => candidate.canonical !== candidate.normalized,
);

if (TERMO_ANSWER === undefined) {
  throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
}
const termoAnswer = TERMO_ANSWER;

const TERMO_DECOYS: readonly string[] = TERMO_ANSWERS.map(
  (candidate) => candidate.normalized,
)
  .filter((word) => word !== termoAnswer.normalized)
  .slice(0, 6);

async function seedTermo(date: string, seed = 7): Promise<void> {
  await insertDailyPuzzle(ctx.db, {
    game: "termo",
    date,
    seed,
    content: {
      canonical: termoAnswer.canonical,
      normalized: termoAnswer.normalized,
    },
  });
}

function termoBody(init: {
  date: string;
  guesses: readonly string[];
  elapsedMs?: number;
  hintsUsed?: number;
}): string {
  return JSON.stringify({
    game: "termo",
    date: init.date,
    guesses: [...init.guesses],
    elapsedMs: init.elapsedMs ?? 61_000,
    hintsUsed: init.hintsUsed ?? 0,
  });
}

async function storedGuessCounts(): Promise<
  { game: string; guesses: number | null }[]
> {
  return ctx.db
    .select({ game: completions.game, guesses: completions.guesses })
    .from(completions)
    .orderBy(completions.game);
}

async function errorOf(response: Response): Promise<unknown> {
  return response.json();
}

describe("POST /completions", () => {
  it("T-API-1: is force-dynamic and answers preflight (a JSON POST always preflights)", async () => {
    const route = await import("../app/completions/route");
    expect(route.dynamic).toBe("force-dynamic");
    expect(typeof OPTIONS).toBe("function");
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
  });

  it("T-API-2: no session cookie ⇒ 401, no row written and no user minted", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);

    const response = await POST(
      completionRequest({
        body: completionBody({ game: "binairo", date: today, grid: solution }),
      }),
    );

    expect(response.status).toBe(401);
    expect(await errorOf(response)).toEqual({ error: "no-session" });
    expect(await completionRows()).toHaveLength(0);
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-3: Sec-Fetch-Site: cross-site ⇒ 403 before the database is touched", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();
    getDbCalls.mockClear();

    const response = await POST(
      completionRequest({
        token,
        secFetchSite: "cross-site",
        body: completionBody({ game: "binairo", date: today, grid: solution }),
      }),
    );

    expect(response.status).toBe(403);
    expect(await errorOf(response)).toEqual({ error: "cross-site" });
    expect(getDbCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-4: a valid grid for today ⇒ 200, recorded, on time, contract-parseable", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: solution,
          elapsedMs: 272_000,
          hintsUsed: 1,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = completionResponseSchema.parse(await response.json());
    expect(body).toEqual({
      game: "binairo",
      date: today,
      outcome: "won",
      onTime: true,
      recorded: true,
      elapsedMs: 272_000,
      hintsUsed: 1,
    });
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-5: replaying the identical request ⇒ 200 with recorded: false and the same body", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();
    const body = completionBody({
      game: "binairo",
      date: today,
      grid: solution,
    });

    const first = await POST(completionRequest({ token, body }));
    const replay = await POST(completionRequest({ token, body }));

    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    const firstBody = completionResponseSchema.parse(await first.json());
    const replayBody = completionResponseSchema.parse(await replay.json());
    expect(replayBody).toEqual({ ...firstBody, recorded: false });
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-6: a DIFFERENT grid replay returns the stored record and never reaches the judge", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const first = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: solution,
          elapsedMs: 90_000,
        }),
      }),
    );
    const firstBody = completionResponseSchema.parse(await first.json());
    wallReadCalls.mockClear();

    const replay = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: wrongGrid("binairo", solution),
          elapsedMs: 5,
        }),
      }),
    );

    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toEqual({
      ...firstBody,
      recorded: false,
    });

    expect(wallReadCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-6b: a replay after the puzzle is killed still returns the stored record, not 404", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();
    const body = completionBody({
      game: "binairo",
      date: today,
      grid: solution,
    });

    const first = await POST(completionRequest({ token, body }));
    const firstBody = completionResponseSchema.parse(await first.json());

    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, today));

    const replay = await POST(completionRequest({ token, body }));

    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toEqual({
      ...firstBody,
      recorded: false,
    });
  });

  it("T-API-7: a wrong grid ⇒ 422 grid-mismatch and no row", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: wrongGrid("binairo", solution),
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toEqual({ error: "grid-mismatch" });
    expect(await completionRows()).toHaveLength(0);

    expect(wallReadCalls).toHaveBeenCalledTimes(1);
  });

  it("T-API-8: a FUTURE date ⇒ 404 by the wall predicate, no row", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const solution = await seedDaily("binairo", tomorrow, 11);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: tomorrow,
          grid: solution,
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toEqual({ error: "no-puzzle" });
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-9: a KILLED puzzle ⇒ 404, no row", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, today));
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({ game: "binairo", date: today, grid: solution }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toEqual({ error: "no-puzzle" });
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-9b: a published date two days old is WRITTEN and derives late — the D29 lower bound is gone (#31)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const twoDaysAgo = addDays(today, -2);
    const solution = await seedDaily("binairo", twoDaysAgo, 13);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: twoDaysAgo,
          grid: solution,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(completionResponseSchema.parse(await response.json())).toMatchObject(
      { date: twoDaysAgo, outcome: "won", onTime: false, recorded: true },
    );
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-10: malformed JSON, an unknown game and an impossible date each ⇒ 400, never 500", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const bodies = [
      "{not json",
      JSON.stringify({
        game: "xadrez",
        date: today,
        grid: [...solution],
        elapsedMs: 1,
        hintsUsed: 0,
      }),
      completionBody({ game: "binairo", date: "2026-02-30", grid: solution }),

      completionBody({ game: "binairo", date: "0000-01-01", grid: solution }),
    ];

    for (const body of bodies) {
      const response = await POST(completionRequest({ token, body }));
      expect(response.status).toBe(400);
      expect(await errorOf(response)).toEqual({ error: "invalid-body" });
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-10b: a non-JSON or absent Content-Type ⇒ 415 before the database is touched", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();
    const body = completionBody({
      game: "binairo",
      date: today,
      grid: solution,
    });
    getDbCalls.mockClear();

    const textPlain = await POST(
      completionRequest({
        token,
        body,
        contentType: "text/plain",
        secFetchSite: "same-site",
      }),
    );
    expect(textPlain.status).toBe(415);
    expect(await errorOf(textPlain)).toEqual({
      error: "unsupported-media-type",
    });

    const missing = await POST(
      completionRequest({ token, body, contentType: null }),
    );
    expect(missing.status).toBe(415);

    expect(getDbCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-10c: application/json with parameters is accepted", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        contentType: "application/json; charset=utf-8",
        body: completionBody({ game: "binairo", date: today, grid: solution }),
      }),
    );

    expect(response.status).toBe(200);
  });

  it("T-API-13: late derives at the seam with no clock fake — yesterday's puzzle is late, today's is not", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const todaySolution = await seedDaily("binairo", today);
    const yesterdaySolution = await seedDaily("binairo", yesterday, 21);
    const { token } = await createSession();

    const late = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: yesterday,
          grid: yesterdaySolution,
        }),
      }),
    );
    const onTime = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: todaySolution,
        }),
      }),
    );

    expect(completionResponseSchema.parse(await late.json()).onTime).toBe(
      false,
    );
    expect(completionResponseSchema.parse(await onTime.json()).onTime).toBe(
      true,
    );
  });

  it("T-API-14: the rollover boundary at the seam, faked clock, two distinct sessions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z"));
    const solution = await seedDaily("binairo", "2026-07-31", 31);
    const body = completionBody({
      game: "binairo",
      date: "2026-07-31",
      grid: solution,
    });
    const sessionA = await createSession();
    const beforeMidnight = await POST(
      completionRequest({ token: sessionA.token, body }),
    );

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z"));
    const sessionB = await createSession();
    const afterMidnight = await POST(
      completionRequest({ token: sessionB.token, body }),
    );

    expect(
      completionResponseSchema.parse(await beforeMidnight.json()).onTime,
    ).toBe(true);
    expect(
      completionResponseSchema.parse(await afterMidnight.json()).onTime,
    ).toBe(false);
  });

  it("T-API-12: the 200 body carries no solution/seed/reveal/answer at any depth", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({ game: "binairo", date: today, grid: solution }),
      }),
    );

    const raw: unknown = await response.json();
    const keys = collectKeys(raw);

    expect(keys.has("outcome")).toBe(true);
    for (const forbidden of FORBIDDEN_DAILY_KEYS) {
      expect(keys.has(forbidden)).toBe(false);
    }
  });

  it("T-API-15: every status carries the credentialed CORS grant (the status IS the queue's control flow)", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("binairo", today);
    const { token } = await createSession();
    const validBody = completionBody({
      game: "binairo",
      date: today,
      grid: solution,
    });

    const responses: Record<number, Response> = {
      403: await POST(
        completionRequest({
          token,
          secFetchSite: "cross-site",
          body: validBody,
        }),
      ),
      415: await POST(
        completionRequest({
          token,
          contentType: "text/plain",
          body: validBody,
        }),
      ),
      401: await POST(completionRequest({ body: validBody })),
      400: await POST(completionRequest({ token, body: "{not json" })),
      404: await POST(
        completionRequest({
          token,
          body: completionBody({
            game: "binairo",
            date: addDays(today, 1),
            grid: solution,
          }),
        }),
      ),
      422: await POST(
        completionRequest({
          token,
          body: completionBody({
            game: "binairo",
            date: today,
            grid: wrongGrid("binairo", solution),
          }),
        }),
      ),
      200: await POST(completionRequest({ token, body: validBody })),
    };

    for (const [expected, response] of Object.entries(responses)) {
      expect(response.status).toBe(Number(expected));
      expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
      expect(response.headers.get("vary")).toBe("Origin");
    }
  });
});

describe("POST /completions — sudoku (plan 018 §7.3)", () => {
  it("T-API-S9: a valid sudoku grid for today ⇒ 200, recorded, on time, contract-parseable", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("sudoku", today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: solution,
          elapsedMs: 402_000,
          hintsUsed: 1,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = completionResponseSchema.parse(await response.json());
    expect(body).toEqual({
      game: "sudoku",
      date: today,
      outcome: "won",
      onTime: true,
      recorded: true,
      elapsedMs: 402_000,
      hintsUsed: 1,
    });
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S10: replaying the identical sudoku request ⇒ 200, recorded: false, stored values", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("sudoku", today);
    const { token } = await createSession();
    const body = completionBody({
      game: "sudoku",
      date: today,
      grid: solution,
    });

    const first = await POST(completionRequest({ token, body }));
    const replay = await POST(completionRequest({ token, body }));

    const firstBody = completionResponseSchema.parse(await first.json());
    const replayBody = completionResponseSchema.parse(await replay.json());
    expect(replay.status).toBe(200);
    expect(replayBody).toEqual({ ...firstBody, recorded: false });
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S11: a DIFFERENT sudoku grid replay returns the stored record and never reaches the judge", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const solution = await seedDaily("sudoku", today);
    const { token } = await createSession();

    const first = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: solution,
          elapsedMs: 90_000,
        }),
      }),
    );
    const firstBody = completionResponseSchema.parse(await first.json());
    wallReadCalls.mockClear();

    const replay = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: wrongGrid("sudoku", solution),
          elapsedMs: 5,
        }),
      }),
    );

    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toEqual({
      ...firstBody,
      recorded: false,
    });

    expect(wallReadCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S12: a wrong sudoku grid ⇒ 422; future and killed ⇒ 404; a two-days-old published row is now WRITTEN, late (#31)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const twoDaysAgo = addDays(today, -2);
    const todaySolution = await seedDaily("sudoku", today);
    const tomorrowSolution = await seedDaily("sudoku", tomorrow, 11);
    const oldSolution = await seedDaily("sudoku", twoDaysAgo, 13);
    const { token } = await createSession();

    const mismatch = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: wrongGrid("sudoku", todaySolution),
        }),
      }),
    );
    expect(mismatch.status).toBe(422);
    expect(await errorOf(mismatch)).toEqual({ error: "grid-mismatch" });

    const future = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: tomorrow,
          grid: tomorrowSolution,
        }),
      }),
    );
    expect(future.status).toBe(404);
    expect(await errorOf(future)).toEqual({ error: "no-puzzle" });

    const archived = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: twoDaysAgo,
          grid: oldSolution,
        }),
      }),
    );
    expect(archived.status).toBe(200);
    expect(completionResponseSchema.parse(await archived.json())).toMatchObject(
      { date: twoDaysAgo, outcome: "won", onTime: false, recorded: true },
    );

    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.game, "sudoku"));
    const killed = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: todaySolution,
        }),
      }),
    );
    expect(killed.status).toBe(404);
    expect(await errorOf(killed)).toEqual({ error: "no-puzzle" });

    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S13: sudoku on-time derivation at the seam — yesterday is late, today is not", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const todaySolution = await seedDaily("sudoku", today);
    const yesterdaySolution = await seedDaily("sudoku", yesterday, 21);
    const { token } = await createSession();

    const late = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: yesterday,
          grid: yesterdaySolution,
        }),
      }),
    );
    const onTime = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: todaySolution,
        }),
      }),
    );

    expect(completionResponseSchema.parse(await late.json()).onTime).toBe(
      false,
    );
    expect(completionResponseSchema.parse(await onTime.json()).onTime).toBe(
      true,
    );
  }, 30_000);

  it("T-API-S13: the sudoku rollover boundary, faked clock, two distinct sessions", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z"));
    const solution = await seedDaily("sudoku", "2026-07-31", 31);
    const body = completionBody({
      game: "sudoku",
      date: "2026-07-31",
      grid: solution,
    });
    const sessionA = await createSession();
    const beforeMidnight = await POST(
      completionRequest({ token: sessionA.token, body }),
    );

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z"));
    const sessionB = await createSession();
    const afterMidnight = await POST(
      completionRequest({ token: sessionB.token, body }),
    );

    expect(
      completionResponseSchema.parse(await beforeMidnight.json()).onTime,
    ).toBe(true);
    expect(
      completionResponseSchema.parse(await afterMidnight.json()).onTime,
    ).toBe(false);
  }, 30_000);

  it("T-API-S14: a sudoku body against a stored BINAIRO row (and the reverse) is a 404, never a 500", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const binairoSolution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const sudokuOnBinairo = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,

          grid: Array.from({ length: 81 }, (_, index) => (index % 9) + 1),
        }),
      }),
    );
    expect(sudokuOnBinairo.status).toBe(404);
    expect(await errorOf(sudokuOnBinairo)).toEqual({ error: "no-puzzle" });

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await seedDaily("sudoku", today);
    const binairoOnSudoku = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: binairoSolution,
        }),
      }),
    );
    expect(binairoOnSudoku.status).toBe(404);
    expect(await errorOf(binairoOnSudoku)).toEqual({ error: "no-puzzle" });

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    const nonogramSolution = await seedDaily("nonogram", today, 7, 3);
    expect(nonogramSolution).toHaveLength(64);
    const binairoOnNonogram = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: nonogramSolution,
        }),
      }),
    );
    expect(binairoOnNonogram.status).toBe(404);
    expect(await errorOf(binairoOnNonogram)).toEqual({ error: "no-puzzle" });

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await seedDaily("binairo", today);
    const nonogramOnBinairo = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: today,
          grid: binairoSolution,
        }),
      }),
    );
    expect(nonogramOnBinairo.status).toBe(404);
    expect(await errorOf(nonogramOnBinairo)).toEqual({ error: "no-puzzle" });

    expect(await completionRows()).toHaveLength(0);
  }, 30_000);
});

describe("POST /completions — nonogram (plan 020 §9.3)", () => {
  it("T-API-S23a: a valid picture for today ⇒ 200, recorded, on time; the replay returns the stored row", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const picture = await seedDaily("nonogram", today);
    const { token } = await createSession();
    const body = completionBody({
      game: "nonogram",
      date: today,
      grid: picture,
      elapsedMs: 188_000,
      hintsUsed: 1,
    });

    const first = await POST(completionRequest({ token, body }));
    expect(first.status).toBe(200);
    const firstBody = completionResponseSchema.parse(await first.json());
    expect(firstBody).toEqual({
      game: "nonogram",
      date: today,
      outcome: "won",
      onTime: true,
      recorded: true,
      elapsedMs: 188_000,
      hintsUsed: 1,
    });

    const replay = await POST(completionRequest({ token, body }));
    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toEqual({
      ...firstBody,
      recorded: false,
    });
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-S24: the encoding pin — row-major 1=filled is the ONLY body the judge accepts", async () => {
    const today = await todaySaoPaulo(ctx.db);

    const picture = await seedDaily("nonogram", today, 7, 3);
    const { token } = await createSession();

    const exact = await POST(
      completionRequest({
        token,
        body: completionBody({ game: "nonogram", date: today, grid: picture }),
      }),
    );
    expect(exact.status).toBe(200);
    expect(await completionRows()).toHaveLength(1);

    const other = await createSession();
    const firstEmpty = picture.indexOf(0);
    const firstFilled = picture.indexOf(1);
    if (firstEmpty === -1 || firstFilled === -1) {
      throw new Error("unreachable: a motif has both filled and empty cells");
    }

    const overpainted = [...picture];
    overpainted[firstEmpty] = 1;
    const missing = [...picture];
    missing[firstFilled] = 0;

    const rows = await ctx.db.select().from(dailyPuzzles);
    const stored = rows.find((row) => row.game === "nonogram")?.content;
    const solution = nonogramDailyContentSchema.parse(stored).reveal.solution;
    const transposed = columnMajorPicture(solution);
    if (transposed.every((cell, index) => cell === picture[index])) {
      throw new Error("the chosen picture is transpose-symmetric");
    }

    for (const grid of [overpainted, missing, transposed]) {
      const response = await POST(
        completionRequest({
          token: other.token,
          body: completionBody({ game: "nonogram", date: today, grid }),
        }),
      );
      expect(response.status).toBe(422);
      expect(await errorOf(response)).toEqual({ error: "grid-mismatch" });
    }

    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-S25a: a LONGER grid whose prefix matches is 422, not a recorded win (N7)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const monday = await seedDaily("nonogram", today, 7, 1);
    expect(monday).toHaveLength(25);
    const { token } = await createSession();

    const padded = [...monday, ...Array.from({ length: 75 }, (): number => 0)];
    const longer = await POST(
      completionRequest({
        token,
        body: completionBody({ game: "nonogram", date: today, grid: padded }),
      }),
    );
    expect(longer.status).toBe(422);
    expect(await errorOf(longer)).toEqual({ error: "grid-mismatch" });
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S25b: a SHORTER grid against a bigger stored picture is 422, no row", async () => {
    const today = await todaySaoPaulo(ctx.db);

    const thursday = await seedDaily("nonogram", today, 7, 4);
    expect(thursday).toHaveLength(100);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: today,
          grid: thursday.slice(0, 25),
        }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toEqual({ error: "grid-mismatch" });
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S28: YESTERDAY's picture is judged against yesterday's stored row, at a different size", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const todayPicture = await seedDaily("nonogram", today, 7, 1);
    const yesterdayPicture = await seedDaily("nonogram", yesterday, 21, 7);
    expect(todayPicture).toHaveLength(25);
    expect(yesterdayPicture).toHaveLength(225);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: yesterday,
          grid: yesterdayPicture,
        }),
      }),
    );

    const body = completionResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(body.recorded).toBe(true);

    expect(body.onTime).toBe(false);
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-S23b: a wrong picture ⇒ 422; future and killed ⇒ 404; a two-days-old published row is now WRITTEN, late (#31)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const twoDaysAgo = addDays(today, -2);
    const todayPicture = await seedDaily("nonogram", today, 7, 1);
    const tomorrowPicture = await seedDaily("nonogram", tomorrow, 11, 1);
    const oldPicture = await seedDaily("nonogram", twoDaysAgo, 13, 1);
    const { token } = await createSession();

    const mismatch = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: today,
          grid: wrongGrid("nonogram", todayPicture),
        }),
      }),
    );
    expect(mismatch.status).toBe(422);
    expect(await errorOf(mismatch)).toEqual({ error: "grid-mismatch" });

    const future = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: tomorrow,
          grid: tomorrowPicture,
        }),
      }),
    );
    expect(future.status).toBe(404);
    expect(await errorOf(future)).toEqual({ error: "no-puzzle" });

    const archived = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: twoDaysAgo,
          grid: oldPicture,
        }),
      }),
    );
    expect(archived.status).toBe(200);
    expect(completionResponseSchema.parse(await archived.json())).toMatchObject(
      { date: twoDaysAgo, outcome: "won", onTime: false, recorded: true },
    );

    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.game, "nonogram"));
    const killed = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: today,
          grid: todayPicture,
        }),
      }),
    );
    expect(killed.status).toBe(404);
    expect(await errorOf(killed)).toEqual({ error: "no-puzzle" });

    expect(await completionRows()).toHaveLength(1);
  });
});

describe("POST /completions — termo (#27, ADR-0038)", () => {
  it("T-API-S39: the decoys are dictionary words and the answer is accented", () => {
    expect(TERMO_DECOYS).toHaveLength(6);
    for (const word of TERMO_DECOYS) {
      expect(isValidGuess(word), `${word} must be a dictionary word`).toBe(
        true,
      );
    }
    expect(termoAnswer.canonical).not.toBe(termoAnswer.normalized);
  });

  it("T-API-S39: a winning list records `won` with the guess COUNT, and `outcome` is no longer a literal", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: termoBody({
          date: today,
          guesses: [...TERMO_DECOYS.slice(0, 3), termoAnswer.normalized],
          elapsedMs: 272_000,
          hintsUsed: 1,
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = completionResponseSchema.parse(await response.json());
    expect(body).toEqual({
      game: "termo",
      date: today,
      outcome: "won",
      onTime: true,
      recorded: true,
      elapsedMs: 272_000,
      hintsUsed: 1,
    });

    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 4 }]);
  });

  it('T-API-S39: SIX exhausted guesses record `outcome: "lost"` — the first reachable loss in the product', async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: termoBody({ date: today, guesses: TERMO_DECOYS }),
      }),
    );

    expect(response.status).toBe(200);
    const body = completionResponseSchema.parse(await response.json());
    expect(body.outcome).toBe("lost");
    expect(body.recorded).toBe(true);
    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 6 }]);
  });

  it("T-API-S39: a still-`playing` list is 422 `guess-mismatch` with NO row", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    for (let length = 1; length <= 5; length += 1) {
      const response = await POST(
        completionRequest({
          token,
          body: termoBody({
            date: today,
            guesses: TERMO_DECOYS.slice(0, length),
          }),
        }),
      );
      expect(response.status, `${String(length)} wrong guesses`).toBe(422);
      expect(await errorOf(response)).toEqual({ error: "guess-mismatch" });
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S39: a list past a winning row is 422 `guess-mismatch`, never 500", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    const decoy = TERMO_DECOYS[0] ?? "";

    const lists = [
      [termoAnswer.normalized, decoy],
      [decoy, termoAnswer.normalized, TERMO_DECOYS[1] ?? ""],
      [termoAnswer.normalized, termoAnswer.normalized],
    ];

    for (const guesses of lists) {
      const response = await POST(
        completionRequest({ token, body: termoBody({ date: today, guesses }) }),
      );
      expect(response.status, guesses.join(",")).toBe(422);
      expect(await errorOf(response)).toEqual({ error: "guess-mismatch" });
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S43: a WIN whose earlier rows contain a non-word is RECORDED, not 422'd", async () => {
    //

    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: termoBody({
          date: today,

          guesses: [TERMO_DECOYS[0] ?? "", "zzzzz", termoAnswer.normalized],
        }),
      }),
    );

    expect(response.status).toBe(200);
    const body = completionResponseSchema.parse(await response.json());
    expect(body.outcome).toBe("won");
    expect(body.recorded).toBe(true);
    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 3 }]);
  });

  it("T-API-S43: an unfinished list is still 422 `guess-mismatch` when it contains a non-word", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: termoBody({ date: today, guesses: ["zzzzz"] }),
      }),
    );

    expect(response.status).toBe(422);
    expect(await errorOf(response)).toEqual({ error: "guess-mismatch" });
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S39: a replay of a WINNING list against a stored `lost` row returns the loss, unrecorded", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const lost = await POST(
      completionRequest({
        token,
        body: termoBody({ date: today, guesses: TERMO_DECOYS }),
      }),
    );
    expect(completionResponseSchema.parse(await lost.json()).outcome).toBe(
      "lost",
    );
    wallReadCalls.mockClear();

    const replay = await POST(
      completionRequest({
        token,
        body: termoBody({
          date: today,
          guesses: [termoAnswer.normalized],
          elapsedMs: 1,
        }),
      }),
    );

    expect(replay.status).toBe(200);
    const body = completionResponseSchema.parse(await replay.json());
    expect(body.outcome).toBe("lost");
    expect(body.recorded).toBe(false);
    expect(body.elapsedMs).toBe(61_000);
    expect(wallReadCalls).not.toHaveBeenCalled();

    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 6 }]);
  });

  it("T-API-S39: yesterday's board is judged and recorded LATE — the rollover case", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    await seedTermo(yesterday, 21);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: termoBody({
          date: yesterday,
          guesses: [termoAnswer.normalized],
        }),
      }),
    );

    const body = completionResponseSchema.parse(await response.json());
    expect(response.status).toBe(200);
    expect(body.outcome).toBe("won");
    expect(body.onTime).toBe(false);
    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 1 }]);
  });

  it("T-API-S40: the grid path is UNCHANGED — all three still judge, and write a NULL count", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const binairo = await seedDaily("binairo", today);
    const sudoku = await seedDaily("sudoku", today);
    const nonogram = await seedDaily("nonogram", today, 7, 1);
    const { token } = await createSession();

    for (const [game, grid] of [
      ["binairo", binairo],
      ["sudoku", sudoku],
      ["nonogram", nonogram],
    ] as const) {
      const response = await POST(
        completionRequest({
          token,
          body: completionBody({ game, date: today, grid }),
        }),
      );
      expect(
        completionResponseSchema.parse(await response.json()),
      ).toMatchObject({ game, outcome: "won", recorded: true });
    }
    expect(await storedGuessCounts()).toEqual([
      { game: "binairo", guesses: null },
      { game: "nonogram", guesses: null },
      { game: "sudoku", guesses: null },
    ]);
  });

  it("T-API-S40: a length mismatch is still 422 `grid-mismatch`, and a binairo body against a TERMO row 404s", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const nonogram = await seedDaily("nonogram", today, 7, 1);
    expect(nonogram).toHaveLength(25);
    await seedTermo(today);
    const { token } = await createSession();

    const padded = [
      ...nonogram,
      ...Array.from({ length: 75 }, (): number => 0),
    ];
    const longer = await POST(
      completionRequest({
        token,
        body: completionBody({ game: "nonogram", date: today, grid: padded }),
      }),
    );
    expect(longer.status).toBe(422);
    expect(await errorOf(longer)).toEqual({ error: "grid-mismatch" });

    const wrongGame = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: Array.from({ length: 64 }, (): number => 0),
        }),
      }),
    );
    expect(wrongGame.status).toBe(404);
    expect(await errorOf(wrongGame)).toEqual({ error: "no-puzzle" });

    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S40: a termo body against a GRID row 404s, and a malformed termo body is 400", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedDaily("binairo", today);
    const { token } = await createSession();

    const noRow = await POST(
      completionRequest({
        token,
        body: termoBody({ date: today, guesses: [termoAnswer.normalized] }),
      }),
    );
    expect(noRow.status).toBe(404);
    expect(await errorOf(noRow)).toEqual({ error: "no-puzzle" });

    await seedTermo(today);
    for (const body of [
      termoBody({ date: today, guesses: [] }),
      termoBody({ date: today, guesses: ["CAFÉ"] }),
      termoBody({
        date: today,
        guesses: Array.from({ length: 7 }, () => termoAnswer.normalized),
      }),
      JSON.stringify({
        game: "termo",
        date: today,
        guesses: [termoAnswer.normalized],
        elapsedMs: 1,
        hintsUsed: 0,
        outcome: "won",
      }),
    ]) {
      const response = await POST(completionRequest({ token, body }));
      expect(response.status, body.slice(0, 70)).toBe(400);
      expect(await errorOf(response)).toEqual({ error: "invalid-body" });
    }
    expect(await completionRows()).toHaveLength(0);
  });
});

describe("POST /completions — the archive write window (#31, ADR-0053)", () => {
  async function statsOf(token: string): Promise<StatsResponse> {
    const response = await statsGet(
      new NextRequest("http://localhost:3001/stats", {
        method: "GET",
        headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` }),
      }),
    );
    expect(response.status).toBe(200);
    return statsResponseSchema.parse(await response.json());
  }

  async function streakOf(token: string): Promise<StreakResponse> {
    const response = await streakGet(
      new NextRequest("http://localhost:3001/streak", {
        method: "GET",
        headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` }),
      }),
    );
    expect(response.status).toBe(200);
    return streakResponseSchema.parse(await response.json());
  }

  it("T-API-S97: a completion 90 days back is ACCEPTED and reads back onTime: false", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -90);
    const solution = await seedDaily("binairo", archived);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: archived,
          grid: solution,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(completionResponseSchema.parse(await response.json())).toEqual({
      game: "binairo",
      date: archived,
      outcome: "won",
      onTime: false,
      elapsedMs: 61_000,
      hintsUsed: 0,
      recorded: true,
    });
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S98: a FUTURE date is refused in the route, BEFORE the wall read — new behaviour, not preserved behaviour", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const solution = await seedDaily("binairo", tomorrow, 11);
    const { token } = await createSession();

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: tomorrow,
          grid: solution,
        }),
      }),
    );

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toEqual({ error: "no-puzzle" });
    expect(wallReadCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(0);
  }, 30_000);

  it("T-API-S99: an unpublished, a killed and a never-published past date are each 404 — the wall is now the only lower authority", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();

    const missing = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: addDays(today, -90),
          grid: Array.from({ length: 64 }, () => 0),
        }),
      }),
    );
    expect(missing.status).toBe(404);
    expect(await errorOf(missing)).toEqual({ error: "no-puzzle" });

    const unpublishedDate = addDays(today, -60);
    const unpublished = await seedDaily("binairo", unpublishedDate, 13);
    await ctx.db
      .update(dailyPuzzles)
      .set({ publishedAt: sql`now() + interval '1 day'` })
      .where(eq(dailyPuzzles.date, unpublishedDate));
    const pending = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: unpublishedDate,
          grid: unpublished,
        }),
      }),
    );
    expect(pending.status).toBe(404);

    const killedDate = addDays(today, -30);
    const killedSolution = await seedDaily("binairo", killedDate, 17);
    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, killedDate));
    const killed = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: killedDate,
          grid: killedSolution,
        }),
      }),
    );
    expect(killed.status).toBe(404);

    expect(await completionRows()).toHaveLength(0);
  }, 30_000);

  it("T-API-S100: AC 3's exclusion half at the seam — an archived win and an archived Termo loss move `solved` and the FAIL ROW, and nothing else", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -90);
    const { token } = await createSession();

    const todaySolution = await seedDaily("binairo", today);
    await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: today,
          grid: todaySolution,
          elapsedMs: 120_000,
        }),
      }),
    );
    const before = await statsOf(token);
    const streakBefore = await streakOf(token);

    const archivedSolution = await seedDaily("binairo", archived, 23);
    await seedTermo(archived, 29);
    const win = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: archived,
          grid: archivedSolution,
          elapsedMs: 1_000,
        }),
      }),
    );
    expect(win.status).toBe(200);
    const loss = await POST(
      completionRequest({
        token,
        body: termoBody({ date: archived, guesses: TERMO_DECOYS }),
      }),
    );
    expect(loss.status).toBe(200);

    const after = await statsOf(token);

    expect(after.binairo.solved).toBe(before.binairo.solved + 1);
    expect(after.termo.distribution[6]).toBe(before.termo.distribution[6] + 1);

    expect(after.binairo.bestMs).toBe(before.binairo.bestMs);
    expect(after.binairo.averageMs).toBe(before.binairo.averageMs);
    expect(after.binairo.averageSampleCount).toBe(
      before.binairo.averageSampleCount,
    );
    expect(after.binairo.histogram).toEqual(before.binairo.histogram);

    expect(after.termo.distribution.slice(0, 6)).toEqual(
      before.termo.distribution.slice(0, 6),
    );
    expect(after.termo.solved).toBe(before.termo.solved);
    expect(after.perfectDays).toBe(before.perfectDays);

    expect(await streakOf(token)).toEqual(streakBefore);
  }, 40_000);

  it("T-API-S104: AC 4's teeth — an archive-dated replay of a day already completed on time returns the STORED row and writes nothing, ahead of the cap", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const solution = await seedDaily("sudoku", yesterday);
    const { token, userId } = await createSession();

    await ctx.db.insert(completions).values({
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      completedAt: new Date(`${yesterday}T15:00:00Z`),
      elapsedMs: 42_000,
      hintsUsed: 1,
      onTime: true,
    });
    const storedBefore = await ctx.db.select().from(completions);

    wallReadCalls.mockClear();
    const replay = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: yesterday,
          grid: solution,
          elapsedMs: 5,
          hintsUsed: 0,
        }),
      }),
    );

    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toEqual({
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      onTime: true,
      elapsedMs: 42_000,
      hintsUsed: 1,
      recorded: false,
    });

    expect(await ctx.db.select().from(completions)).toEqual(storedBefore);
    expect(wallReadCalls).not.toHaveBeenCalled();
  }, 30_000);

  it("T-API-S105: a lost archived Termo is written once and a later winning replay does not reopen it", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -45);
    await seedTermo(archived);
    const { token } = await createSession();

    const lost = await POST(
      completionRequest({
        token,
        body: termoBody({ date: archived, guesses: TERMO_DECOYS }),
      }),
    );
    expect(lost.status).toBe(200);
    expect(completionResponseSchema.parse(await lost.json())).toMatchObject({
      outcome: "lost",
      onTime: false,
      recorded: true,
    });

    const replay = await POST(
      completionRequest({
        token,
        body: termoBody({ date: archived, guesses: [termoAnswer.normalized] }),
      }),
    );
    expect(replay.status).toBe(200);
    expect(completionResponseSchema.parse(await replay.json())).toMatchObject({
      outcome: "lost",
      recorded: false,
    });
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S106: another user's archive completions never move the caller's stats or streak", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -70);
    const solution = await seedDaily("binairo", archived);
    const mine = await createSession();
    const theirs = await createSession();

    const baseline = await statsOf(mine.token);
    const baselineStreak = await streakOf(mine.token);

    const written = await POST(
      completionRequest({
        token: theirs.token,
        body: completionBody({
          game: "binairo",
          date: archived,
          grid: solution,
        }),
      }),
    );
    expect(written.status).toBe(200);

    expect(await statsOf(mine.token)).toEqual(baseline);
    expect(await streakOf(mine.token)).toEqual(baselineStreak);

    expect((await statsOf(theirs.token)).binairo.solved).toBe(1);
  }, 30_000);

  it("T-API-S107: the 50th late write of a São Paulo day lands and the 51st is 429 archive-cap; a today-dated write is neither counted nor capped; the cap lifts when the clock crosses SP midnight", async () => {
    //

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-08-11T02:59:59Z"));

    const today = await todaySaoPaulo(ctx.db);
    expect(today).toBe("2026-08-10");
    const { token, userId } = await createSession();

    await ctx.db.insert(completions).values(
      Array.from({ length: 49 }, (_unused, index) => ({
        userId,
        game: "binairo" as const,
        date: addDays(today, -(index + 2)),
        outcome: "won" as const,
        completedAt: new Date("2026-08-11T02:59:59Z"),
        elapsedMs: 61_000,
        hintsUsed: 0,
        onTime: false,
      })),
    );

    const todaySolution = await seedDaily("sudoku", today);
    const daily = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          grid: todaySolution,
        }),
      }),
    );
    expect(daily.status).toBe(200);

    const fiftieth = addDays(today, -99);
    const fiftiethSolution = await seedDaily("sudoku", fiftieth, 30);
    const accepted = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: fiftieth,
          grid: fiftiethSolution,
        }),
      }),
    );
    expect(accepted.status).toBe(200);

    const archived = addDays(today, -100);
    const archivedSolution = await seedDaily("sudoku", archived, 31);
    const rowsBefore = await completionRows();
    const capped = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: archived,
          grid: archivedSolution,
        }),
      }),
    );
    expect(capped.status).toBe(429);
    expect(await errorOf(capped)).toEqual({ error: "archive-cap" });
    expect(await completionRows()).toHaveLength(rowsBefore.length);

    vi.setSystemTime(new Date("2026-08-11T03:00:01Z"));
    expect(await todaySaoPaulo(ctx.db)).toBe("2026-08-11");
    const retried = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: archived,
          grid: archivedSolution,
        }),
      }),
    );
    expect(retried.status).toBe(200);
    expect(completionResponseSchema.parse(await retried.json())).toMatchObject({
      onTime: false,
      recorded: true,
    });
  }, 40_000);

  it("T-API-S107a: 429 is NOT terminal in the web client's sync ladder — a capped archive completion survives to flush later", async () => {
    //

    //

    const sync = await readFile(
      new URL("../../web/src/play/sync.ts", import.meta.url),
      "utf8",
    );
    const terminal =
      /const TERMINAL_STATUSES[^=]*=\s*new Set\(\[([^\]]*)\]/.exec(sync);
    expect(terminal?.[1]).toBeDefined();
    expect(terminal?.[1]).not.toContain("429");
  });
});

describe("POST /completions — the late-sync credit (#58, ADR-0066)", () => {
  async function streakOf(token: string): Promise<StreakResponse> {
    const response = await streakGet(
      new NextRequest("http://localhost:3001/streak", {
        method: "GET",
        headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` }),
      }),
    );
    expect(response.status).toBe(200);
    return streakResponseSchema.parse(await response.json());
  }

  async function statsOf(token: string): Promise<StatsResponse> {
    const response = await statsGet(
      new NextRequest("http://localhost:3001/stats", {
        method: "GET",
        headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` }),
      }),
    );
    expect(response.status).toBe(200);
    return statsResponseSchema.parse(await response.json());
  }

  async function seedSeenDay(userId: string, date: string): Promise<void> {
    await ctx.db.execute(
      sql`insert into user_seen_days (user_id, date)
          values (${userId}::uuid, ${date}::date)
          on conflict do nothing`,
    );
  }

  it("T-API-S137: a seen yesterday is credited — 200 with onTime true, and GET /streak counts the day", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();
    await seedSeenDay(userId, yesterday);
    const solution = await seedDaily("binairo", yesterday);

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: yesterday,
          grid: solution,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(completionResponseSchema.parse(await response.json())).toMatchObject(
      { onTime: true, recorded: true, date: yesterday },
    );

    const streak = await streakOf(token);
    expect(streak.streak).toBe(1);
  });

  it("T-API-S138: an UNSEEN yesterday stays late — 200, recorded, onTime false; streak and Dia Perfeito unmoved", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token } = await createSession();

    const solution = await seedDaily("binairo", yesterday);

    const response = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: yesterday,
          grid: solution,
        }),
      }),
    );
    expect(response.status).toBe(200);
    expect(completionResponseSchema.parse(await response.json())).toMatchObject(
      { onTime: false, recorded: true },
    );

    expect((await streakOf(token)).streak).toBe(0);
    const stats = await statsOf(token);
    expect(stats.perfectDays).toBe(0);
    expect(stats.binairo.solved).toBe(1);
  });

  it("T-API-S139: the multi-past-date guard's window boundary — a stale straddle-shaped credit (two days back, written today) does not block yesterday's credit, and the predicate still trips on a second in-window credited date (the widening tripwire)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();
    await ctx.db.insert(completions).values({
      userId,
      game: "sudoku",
      date: addDays(today, -2),
      outcome: "won",

      elapsedMs: 1_000,
      hintsUsed: 0,
      onTime: true,
    });

    await seedSeenDay(userId, yesterday);
    const solution = await seedDaily("binairo", yesterday);
    const credited = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "binairo",
          date: yesterday,
          grid: solution,
        }),
      }),
    );
    expect(credited.status).toBe(200);
    expect(completionResponseSchema.parse(await credited.json())).toMatchObject(
      { onTime: true, recorded: true, date: yesterday },
    );

    await expect(
      hasCreditedPastDateToday(ctx.db, userId, {
        today,
        excludingDate: addDays(today, -2),
      }),
    ).resolves.toBe(true);
    await expect(
      hasCreditedPastDateToday(ctx.db, userId, {
        today,
        excludingDate: yesterday,
      }),
    ).resolves.toBe(false);
  });
});
