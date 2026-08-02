import {
  completionResponseSchema,
  nonogramDailyContentSchema,
} from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { eq, sessions, sql, users } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
import { isWeekday, type Weekday } from "@miolos/games";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku, type SudokuPuzzle } from "@miolos/games/sudoku";
import { isValidGuess, TERMO_ANSWERS } from "@miolos/games/termo";
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

/** The three games this route can judge today — the request union's discriminator. */
type SubmittableGame = "binairo" | "nonogram" | "sudoku";

/**
 * The wire encoding, computed HERE and never imported from the route: the
 * judge flattens `reveal.solution` row-major and maps `true → 1`, so a test
 * that reused the route's own function would assert nothing about it
 * (ADR-0032, plan 020 §9.3).
 */
function rowMajorPicture(
  solution: ReadonlyArray<ReadonlyArray<boolean>>,
): readonly number[] {
  return solution.flatMap((row) => row.map((cell) => (cell ? 1 : 0)));
}

/** The same bitmap read down the columns — a legal body that is not this picture. */
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
  /**
   * Nonogram only: generate for THIS weekday rather than the date's own. A
   * nonogram's board size is a function of its weekday, and the length tests
   * need two different sizes on ACCEPTED dates — of which there are only ever
   * two (ACCEPTED_DAYS_BACK = 1), whose weekdays are whatever the calendar
   * makes them. Nothing on this route reads `content.weekday`: the judge
   * reads `reveal.solution` and the wall reads the DATE column.
   */
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
 * because a submitted grid must still PARSE: binairo and nonogram cells are
 * 0/1 and a sudoku cell must stay 1–9, so flipping a sudoku digit to 0 would
 * turn the 422 under test into a 400 and prove nothing.
 */
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

/**
 * The seeded Termo answer, ACCENTED so `canonical` and `normalized` differ.
 * Termo is the fourth game on this route and the first with no grid at all:
 * its evidence is the guess LIST, and the outcome is DERIVED from it against
 * the stored answer (ADR-0038).
 */
const TERMO_ANSWER = TERMO_ANSWERS.find(
  (candidate) => candidate.canonical !== candidate.normalized,
);

if (TERMO_ANSWER === undefined) {
  throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
}
const termoAnswer = TERMO_ANSWER;

/** Six dictionary words that are NOT the answer — the losing board. */
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

/** The written row's `guesses`, which `getCompletion` deliberately does not project. */
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
      // Year 0000: step-6 round-4 finding
      // `calendar-date-year-zero-500s-the-completions-route`. JS has a year 0
      // and the proleptic Gregorian calendar Postgres implements does not, so
      // this survived `calendarDateString`'s UTC round trip, reached
      // `getCompletion` — ADR-0026's idempotent short-circuit runs BEFORE the
      // `ACCEPTED_DAYS_BACK` range check that would have 404'd it — and threw
      // 22008 out of an unhandled `select`, i.e. a 500 on the repo's only
      // authenticated write. Whoever moves the floor out of the schema reds
      // here as well as in `completion-contract.test.ts`.
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
    // Anti-vacuity: `collectKeys` returns an empty set for any non-object
    // input, so without this the forbidden loop passes trivially on an HTML
    // error page (finding `api-leak-scans-have-no-anti-vacuity-assertion`).
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

    // Extended at #25 with the pair that is genuinely ambiguous on the wire:
    // an 8x8 nonogram and a binairo board are the SAME 64-cell 0/1 array, so
    // neither body can be turned away by its own schema and only the
    // game-scoped wall read plus `storedSolution`'s dispatch stand between
    // them and a ZodError 500.
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

/**
 * Deliberately WITHOUT per-`it` timeouts, unlike the sudoku block above
 * (landmine 25): nonogram generate+validate measures 0.0354 ms (Mon 5x5) to
 * 0.1902 ms (Sun 15x15), so nothing here approaches vitest's 5 000 ms
 * default and a copied 30_000 would be a number with no reason to exist.
 */
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
    // Wednesday's 8x8: big enough that a transpose is almost never the same
    // bitmap, small enough to stay cheap.
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

    // A second identity, so every rejection below is judged rather than
    // short-circuited by the first player's stored row.
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
      // Anti-vacuity: a transpose-symmetric motif would make the last case
      // assert that the CORRECT body is rejected, which would be a bug.
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
    // Only the first player's row exists: no rejected body ever wrote.
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-S25a: a LONGER grid whose prefix matches is 422, not a recorded win (N7)", async () => {
    // The hole the request schema structurally cannot close: binairo pins
    // .length(64) and sudoku .length(81), but a nonogram grid is one of four
    // lengths and the compare loop iterates the STORED solution's entries —
    // so without the route's explicit length check a 100-cell body whose
    // first 25 cells match a 5x5 picture scores zero mismatches.
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
    // Thursday's 10x10 stored, a 25-cell body submitted: both lengths are
    // legal on the wire, so only the route's check can separate them.
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
    // The one LEGITIMATE submission whose length differs from today's board,
    // and the only shape binairo's `.length(64)` and sudoku's `.length(81)`
    // structurally cannot produce: ACCEPTED_DAYS_BACK = 1 exists for D19's
    // post-rollover flush, where a board finished offline yesterday is POSTed
    // on today's mount by `sync.ts`. Yesterday is a different ISO weekday and
    // a nonogram's size is a function of the weekday, so the two accepted
    // dates almost always carry different size classes — which is exactly
    // what the route's `body.grid.length !== solution.length` check has to be
    // keyed on: the STORED row, never today's board. The two 422 length cases
    // above prove it rejects; nothing proved it accepts (step-6 round-3
    // finding NONO-C-R3-1).
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
    // Yesterday's daily is late by construction, whatever the wall clock —
    // T-API-13's seam argument, for the third game.
    expect(body.onTime).toBe(false);
    expect(await completionRows()).toHaveLength(1);
  });

  it("T-API-S23b: a wrong picture ⇒ 422; future, killed and two-days-old ⇒ 404, never a row", async () => {
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

    // ACCEPTED_DAYS_BACK is unchanged at 1 (#31 is its lever).
    const tooOld = await POST(
      completionRequest({
        token,
        body: completionBody({
          game: "nonogram",
          date: twoDaysAgo,
          grid: oldPicture,
        }),
      }),
    );
    expect(tooOld.status).toBe(404);
    expect(await errorOf(tooOld)).toEqual({ error: "no-puzzle" });

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

    expect(await completionRows()).toHaveLength(0);
  });
});

describe("POST /completions — termo (#27, ADR-0038)", () => {
  it("T-API-S39: the decoys are dictionary words and the answer is accented", () => {
    // Anti-vacuity for everything below.
    expect(TERMO_DECOYS).toHaveLength(6);
    for (const word of TERMO_DECOYS) {
      expect(isValidGuess(word), `${word} must be a dictionary word`).toBe(
        true,
      );
    }
    expect(termoAnswer.canonical).not.toBe(termoAnswer.normalized);
  });

  it("T-API-S39: a winning list records `won` with the guess COUNT, and `outcome` is no longer a literal", async () => {
    // `outcome: "won"` was hardcoded at this route until #27. It is now the
    // server's own re-run of `evaluateGuess` + `deriveBoardStatus` against the
    // stored answer, so a client-asserted outcome has nowhere to enter.
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
    // The response is UNCHANGED in shape — `guesses` is write-only in #27
    // (widening `CompletionRecord` would throw on every completion in the app
    // through the strict `completionResponseSchema`), so the count is read
    // back from the table directly.
    expect(await storedGuessCounts()).toEqual([{ game: "termo", guesses: 4 }]);
  });

  it('T-API-S39: SIX exhausted guesses record `outcome: "lost"` — the first reachable loss in the product', async () => {
    // THE INVERSION, and it is the one place Termo does not follow the grid
    // games: a wrong grid writes nothing, six wrong Termo guesses IS the game
    // (ADR-0038 decision 4) and closes the day.
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
    // The guard that makes a client bug non-fatal. The row is write-once
    // (ADR-0026 decision 1), so a prematurely posted loss would cost the
    // player the day permanently — this rule must not be relaxed.
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

  it("T-API-S39: a non-dictionary word and a list past a winning row are 422 `guess-mismatch`, never 500", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    const decoy = TERMO_DECOYS[0] ?? "";

    const lists = [
      // Shaped `^[a-z]{5}$` so it PARSES, and outside the dictionary so the
      // judge refuses it — a 400 here would prove nothing about the judge.
      ["zzzzz"],
      [decoy, "zzzzz", termoAnswer.normalized],
      // `deriveBoardStatus` throws a RangeError on a row after a win, and an
      // uncaught RangeError in a route handler is a 500. The explicit
      // pre-check in front of the call is what makes this a 422.
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

  it("T-API-S39: a replay of a WINNING list against a stored `lost` row returns the loss, unrecorded", async () => {
    // The idempotent short-circuit runs BEFORE the wall read and before any
    // judging, so ADR-0008's "a loss followed by an archive replay does not
    // reopen the daily" is enforced by code that already existed. Proved by
    // the judge NEVER being reached, which no status code can assert.
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
    judgeCalls.mockClear();

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
    expect(judgeCalls).not.toHaveBeenCalled();
    // Still one row, and its count is the LOSS's six.
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
    // `storedSolution` was narrowed rather than widened (ADR-0038 decision 5);
    // the proof it still serves all three is that all three still record.
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

    // ADR-0032 consequence (c): the length check is game-generic and must not
    // be simplified away by the narrowing.
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

    // The wall is keyed on (game, date), so a binairo body finds no binairo
    // row for a day that only carries a termo one: 404, never a 500 from a
    // termo `content` reaching `binairoDailyContentSchema.parse`.
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
