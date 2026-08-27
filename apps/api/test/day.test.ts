import { dayResponseSchema, type DayResponse } from "@miolos/core";
import { collectKeys, FORBIDDEN_DAILY_KEYS } from "@miolos/core/testing";
import { sessions, sql, users } from "@miolos/db";
import { insertDailyPuzzle, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
import { isWeekday } from "@miolos/games";
import { generateNonogram } from "@miolos/games/nonogram";
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

import { GET } from "../app/day/route";
import { addDays, isoWeekdayOf } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

let queryCount = 0;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? countingDb(),
}));

function countingDb(): Awaited<ReturnType<typeof createTestDb>>["db"] {
  return new Proxy(ctx.db, {
    get(target, property, receiver) {
      if (property === "select" || property === "execute") {
        queryCount += 1;
      }

      const value: unknown = Reflect.get(target, property, receiver);
      return value;
    },
  });
}

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  queryCount = 0;
});

afterEach(() => {
  dbOverride = undefined;
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

const WEB = "https://miolos.app";

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

function dayRequest(token?: string, search = ""): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest(`http://localhost:3001/day${search}`, {
    method: "GET",
    headers,
  });
}

async function insertHistoryRow(init: {
  userId: string;
  game: "binairo" | "sudoku" | "nonogram" | "termo";
  date: string;
  outcome: "won" | "lost";
  completedAtDate: string;
  elapsedMs?: number;
  hintsUsed?: number;
  guesses?: number;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    outcome: init.outcome,
    completedAt: new Date(`${init.completedAtDate}T15:00:00Z`),
    elapsedMs: init.elapsedMs ?? 61_000,
    hintsUsed: init.hintsUsed ?? 0,
    guesses: init.guesses,

    onTime: init.completedAtDate === init.date,
  });
}

const MOTIF_MARKER = "MOTIVO-VAZADO-64";

async function seedNonogram(date: string, name: string): Promise<void> {
  const weekday = isoWeekdayOf(date);
  if (!isWeekday(weekday)) {
    throw new Error(`unreachable: bad weekday for ${date}`);
  }
  const content = generateNonogram(7, weekday);
  await insertDailyPuzzle(ctx.db, {
    game: "nonogram",
    date,
    seed: 7,
    content: { ...content, reveal: { ...content.reveal, name } },
  });
}

async function readDay(token: string, search = ""): Promise<DayResponse> {
  const response = await GET(dayRequest(token, search));
  expect(response.status).toBe(200);

  return dayResponseSchema.parse(await response.json());
}

describe("GET /day — the server day-truth payload (#83, ADR-0060)", () => {
  it("T-API-S109: 200 answers the DB clock's SP today, with the four statuses the rows imply", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "pending" },
        sudoku: { status: "pending" },
        nonogram: { status: "pending" },
        binairo: { status: "pending" },
      },
    });

    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });
    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      completedAtDate: today,
      guesses: 6,
    });

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "played" },
        sudoku: { status: "completed", elapsedMs: 61_000, hintsUsed: 0 },
        nonogram: { status: "pending" },
        binairo: { status: "pending" },
      },
    });
  });

  it("T-API-S123: the completed grid game's claim carries the STORED duration, and a completed Termo's never does (#141)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 512_000,
    });

    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 188_000,
      guesses: 4,
    });

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "completed" },
        sudoku: { status: "pending" },
        nonogram: { status: "completed", elapsedMs: 512_000, hintsUsed: 0 },
        binairo: { status: "pending" },
      },
    });
  });

  it("T-API-S133: the completed grid game's claim carries the STORED hint count — 0 and 1 both round-trip — and never on Termo or a played game (#142)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 512_000,
      hintsUsed: 1,
    });
    await insertHistoryRow({
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 407_000,
      hintsUsed: 0,
    });

    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      guesses: 4,
    });

    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "lost",
      completedAtDate: today,
      hintsUsed: 1,
    });

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "completed" },
        sudoku: { status: "completed", elapsedMs: 512_000, hintsUsed: 1 },
        nonogram: { status: "played" },
        binairo: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
      },
    });
  });

  it("T-API-S176: a completed on-time Nonogram publishes the STORED motif name, and no other game carries one (#64, ADR-0070)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedNonogram(today, MOTIF_MARKER);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 512_000,
      hintsUsed: 1,
    });

    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 407_000,
      hintsUsed: 0,
    });

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "pending" },
        sudoku: { status: "completed", elapsedMs: 407_000, hintsUsed: 0 },
        nonogram: {
          status: "completed",
          elapsedMs: 512_000,
          hintsUsed: 1,
          motifName: MOTIF_MARKER,
        },
        binairo: { status: "pending" },
      },
    });
  });

  it("T-API-S177: a Nonogram that is not completed carries no motif name — the whole-payload key scan (#64)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedNonogram(today, MOTIF_MARKER);
    const { token, userId } = await createSession();

    const cases: readonly [string, () => Promise<void>][] = [
      ["no row at all", async () => {}],
      [
        "a lost row → played",
        () =>
          insertHistoryRow({
            userId,
            game: "nonogram",
            date: today,
            outcome: "lost",
            completedAtDate: today,
          }),
      ],
      [
        "a LATE WIN → pending",

        () =>
          insertHistoryRow({
            userId,
            game: "nonogram",
            date: today,
            outcome: "won",
            completedAtDate: addDays(today, 1),
            elapsedMs: 512_000,
          }),
      ],
    ];
    for (const [label, seed] of cases) {
      await ctx.db.execute(sql`truncate table completions`);
      await seed();
      const response = await GET(dayRequest(token));
      expect(response.status, label).toBe(200);
      const raw: unknown = await response.json();

      const keys = collectKeys(raw);
      expect(keys.has("games"), label).toBe(true);
      expect(keys.has("status"), label).toBe(true);

      expect(keys.has("motifName"), label).toBe(false);

      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden), `${label} / ${forbidden}`).toBe(false);
      }
    }
  });

  it("T-API-S178: the seeded motif name appears nowhere in the raw body of a not-completed day — the ADR-0004 VALUE scan (#64)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedNonogram(today, MOTIF_MARKER);
    const { token, userId } = await createSession();
    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "lost",
      completedAtDate: today,
    });

    const response = await GET(dayRequest(token));
    expect(response.status).toBe(200);
    const body = await response.text();

    expect(body).toContain(`"nonogram":{"status":"played"}`);
    expect(body).not.toContain(MOTIF_MARKER);

    await ctx.db.execute(sql`truncate table completions`);
    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });
    expect(await (await GET(dayRequest(token))).text()).toContain(MOTIF_MARKER);
  });

  it("T-API-S179: a completed Nonogram whose daily row is killed or missing yields the claim with no name and no 500 (#64)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 512_000,
      hintsUsed: 0,
    });

    const completedNoName = {
      status: "completed",
      elapsedMs: 512_000,
      hintsUsed: 0,
    };
    expect((await readDay(token)).games.nonogram).toEqual(completedNoName);

    await seedNonogram(today, MOTIF_MARKER);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where game = 'nonogram' and date = ${today}`,
    );
    expect((await readDay(token)).games.nonogram).toEqual(completedNoName);

    await ctx.db.execute(sql`truncate table daily_puzzles`);
    await seedNonogram(today, "   ");
    const response = await GET(dayRequest(token));
    expect(response.status).toBe(200);
    expect((await readDay(token)).games.nonogram).toEqual(completedNoName);
  });

  it("T-API-S110: a cookieless GET is 401 no-session and costs ZERO queries; an unknown cookie costs only the session lookup", async () => {
    const noCookie = await GET(dayRequest());
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });

    expect(queryCount).toBe(0);

    const unknownCookie = await GET(dayRequest(generateSessionToken()));
    expect(unknownCookie.status).toBe(401);
    expect(await unknownCookie.json()).toEqual({ error: "no-session" });

    expect(queryCount).toBe(1);

    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S111: no-store and the credentialed CORS grant on all three branches — 200, 401 and the catch-all 500", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);
    const { token } = await createSession();

    const ok = await GET(dayRequest(token));
    expect(ok.status).toBe(200);

    const unauthorised = await GET(dayRequest());
    expect(unauthorised.status).toBe(401);

    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });
    const failed = await GET(dayRequest(generateSessionToken()));
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: "internal" });

    for (const response of [ok, unauthorised, failed]) {
      expect(response.headers.get("cache-control")).toBe("no-store");
      expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    }
  });

  it("T-API-S112: cross-user isolation — another user's rows never appear", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const mine = await createSession();
    const theirs = await createSession();

    await insertHistoryRow({
      userId: theirs.userId,
      game: "binairo",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });

    expect((await readDay(mine.token)).games.binairo.status).toBe("pending");
    expect((await readDay(theirs.token)).games.binairo.status).toBe(
      "completed",
    );

    expect((await readDay(mine.token)).games.binairo.elapsedMs).toBeUndefined();
  });

  it("T-API-S113: query parameters are ignored — `?date=<tomorrow>` still answers today (the ADR-0004 tripwire at the route)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });

    for (const search of [
      `?date=${tomorrow}`,
      `?date=${addDays(today, -1)}`,
      "?user=someone-else",
    ]) {
      const body = await readDay(token, search);
      expect(body.date, search).toBe(today);
      expect(body.games.nonogram.status, search).toBe("completed");
    }
  });

  it("T-API-S114: a row for another date never enters the payload", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "binairo",
      date: yesterday,
      outcome: "won",
      completedAtDate: yesterday,
    });

    expect(await readDay(token)).toEqual({
      date: today,
      games: {
        termo: { status: "pending" },
        sudoku: { status: "pending" },
        nonogram: { status: "pending" },
        binairo: { status: "pending" },
      },
    });
  });

  it("T-API-S115: the route module exports GET (and the dynamic marker) and nothing else — the no-OPTIONS absence pinned", async () => {
    const routeModule = await import("../app/day/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });
});
