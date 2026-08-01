import { completionResponseSchema } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sessions, sql, users } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
import { isWeekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateDailySudoku, type SudokuPuzzle } from "@miolos/games/sudoku";
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
import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// Seam 4: the real route over PGlite. src/db is the only behavioural mock;
// @miolos/db/publishing is spread from the ACTUAL module and only counts
// calls to the judge (T-API-6 proves the idempotent short-circuit never
// reaches it — an assertion no status code can make).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { getDbCalls, judgeCalls } = vi.hoisted(() => ({
  getDbCalls: vi.fn(),
  judgeCalls: vi.fn(),
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
      judgeCalls();
      return actual.getPublishedDailyWithSolution(...args);
    },
  };
});

// PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower;
// 1.2 s × 4 + margin puts the ceiling well above vitest's 10 s default,
// which would otherwise flake this file on CI alone (plan 017 §15).
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` from users reaches sessions, completions and hint_grants.
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  getDbCalls.mockClear();
  judgeCalls.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  // T-API-14 is the only faker; restoring unconditionally keeps a failure
  // there from poisoning every test after it.
  vi.useRealTimers();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = "https://miolos.app";

/** The two games this route can judge today — the request union's discriminator. */
type SubmittableGame = "binairo" | "sudoku";

/**
 * Sudoku generation is deterministic in (seed, weekday) and a tier-5 Sunday
 * board measures ~121 ms mean / 346 ms max locally (plan 018 §19.6). Most
 * tests here seed the same (weekday, seed) pair, so caching keeps the file
 * from regenerating it; it changes nothing about what is asserted.
 */
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

/** A fresh identity with a live session cookie — the route never mints. */
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

/**
 * Seed through the production writer, so published_at derivation is real.
 * Game-parameterized rather than forked (plan 018 T-API-S9): the returned
 * solution is `readonly number[]` because that is exactly what the route's
 * own comparison sees once `storedSolution` dispatches.
 */
async function seedDaily(
  game: SubmittableGame,
  date: string,
  seed = 7,
): Promise<readonly number[]> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
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
  /** null omits the header entirely; undefined means application/json. */
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

/**
 * The wire body. `grid` is `readonly number[]` on purpose — JSON is untyped
 * at the boundary and the route's Zod gate is what must reject a bad cell,
 * so the helper may not do that job for it.
 */
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

/**
 * One changed cell — a COMPLETE grid that is not the solution. Game-aware
 * because a submitted grid must still PARSE: binairo cells are 0/1 and a
 * sudoku cell must stay 1–9, so flipping a sudoku digit to 0 would turn the
 * 422 under test into a 400 and prove nothing.
 */
function wrongGrid(
  game: SubmittableGame,
  solution: readonly number[],
): readonly number[] {
  return solution.map((cell, index) => {
    if (index !== 0) {
      return cell;
    }
    return game === "binairo" ? (cell === 0 ? 1 : 0) : (cell % 9) + 1;
  });
}

async function completionRows(): Promise<unknown[]> {
  return ctx.db.select().from(completions);
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
    judgeCalls.mockClear();

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
    // The whole point of the step-4 short-circuit: an honest retry is
    // answered from the stored row, never re-judged (plan 017 D15).
    expect(judgeCalls).not.toHaveBeenCalled();
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
    // The positive half of T-API-6: proves the judge spy is actually wired
    // into the route's import, so "never called" there means something.
    expect(judgeCalls).toHaveBeenCalledTimes(1);
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

  it("T-API-9b: a published date two days old ⇒ 404 by the D29 bound, no row", async () => {
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

    expect(response.status).toBe(404);
    expect(await errorOf(response)).toEqual({ error: "no-puzzle" });
    expect(await completionRows()).toHaveLength(0);
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

    // The D30 shape: a simple request that would NOT preflight, arriving
    // from a sibling subdomain the origin guard deliberately allows.
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
    // Two identities are MANDATORY: a same-user replay hits the step-4
    // short-circuit (and, below it, ON CONFLICT DO NOTHING) and re-reads
    // the ORIGINAL completed_at, so a single-identity version would assert
    // `true` twice and prove nothing (plan 017 §19.4).
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z")); // 23:59:59 in SP
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

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z")); // 00:00:01 in SP
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
    judgeCalls.mockClear();

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
    // The short-circuit still precedes the wall read for the second game.
    expect(judgeCalls).not.toHaveBeenCalled();
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S12: a wrong sudoku grid ⇒ 422; future, killed and two-days-old ⇒ 404, never a row", async () => {
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

    // ACCEPTED_DAYS_BACK is unchanged at 1 (#31 is its lever).
    const tooOld = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: twoDaysAgo,
          grid: oldSolution,
        }),
      }),
    );
    expect(tooOld.status).toBe(404);
    expect(await errorOf(tooOld)).toEqual({ error: "no-puzzle" });

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

    expect(await completionRows()).toHaveLength(0);
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
    // Two identities again: a same-user replay would re-read the ORIGINAL
    // completed_at through ON CONFLICT DO NOTHING and assert `true` twice.
    vi.useFakeTimers({ toFake: ["Date"] });

    vi.setSystemTime(new Date("2026-08-01T02:59:59Z")); // 23:59:59 in SP
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

    vi.setSystemTime(new Date("2026-08-01T03:00:01Z")); // 00:00:01 in SP
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
    // storedSolution dispatches on body.game and the wall read is
    // game-scoped, so the mismatch can never reach the wrong content
    // schema and throw a ZodError out of the route.
    const today = await todaySaoPaulo(ctx.db);
    const binairoSolution = await seedDaily("binairo", today);
    const { token } = await createSession();

    const sudokuOnBinairo = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "sudoku",
          date: today,
          // A well-formed sudoku submission: 81 digits in 1–9, so the 400
          // gate cannot be what answers here.
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

    expect(await completionRows()).toHaveLength(0);
  }, 30_000);
});
