import { statsCalendarResponseSchema, statsResponseSchema } from "@miolos/core";
import { eq, sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
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

import { GET } from "../app/stats/calendar/route";

import { GET as statsGet } from "../app/stats/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
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

async function ageAccount(userId: string, days: number): Promise<void> {
  await ctx.db
    .update(users)
    .set({
      createdAt: sql`now() - make_interval(days => ${days})`,
    })
    .where(eq(users.id, userId));
}

function calendarRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/stats/calendar", {
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
  guesses?: number;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    outcome: init.outcome,
    completedAt: new Date(`${init.completedAtDate}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    guesses: init.guesses,

    onTime: init.completedAtDate === init.date,
  });
}

describe("GET /stats/calendar — the #29 day enumeration (plan 033 §5, ADR-0051)", () => {
  it("T-API-S88: the range runs from created_at's SP day to the DB clock's today, three states from real rows, the perfect marker on a four-win day only, days and nothing else", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await ageAccount(userId, 3);

    for (const game of ["binairo", "sudoku", "nonogram"] as const) {
      await insertHistoryRow({
        userId,
        game,
        date: today,
        outcome: "won",
        completedAtDate: today,
      });
    }
    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      guesses: 3,
    });
    await insertHistoryRow({
      userId,
      game: "termo",
      date: addDays(today, -1),
      outcome: "lost",
      completedAtDate: addDays(today, -1),
      guesses: 6,
    });
    await insertHistoryRow({
      userId,
      game: "binairo",
      date: addDays(today, -2),
      outcome: "won",
      completedAtDate: today,
    });

    const response = await GET(calendarRequest(token));
    expect(response.status).toBe(200);
    const raw: unknown = await response.json();

    expect(Object.keys(raw as Record<string, unknown>)).toEqual(["days"]);
    const body = statsCalendarResponseSchema.parse(raw);
    expect(body.days).toEqual([
      { date: addDays(today, -3), state: "missed", perfect: false },
      { date: addDays(today, -2), state: "late", perfect: false },
      { date: addDays(today, -1), state: "missed", perfect: false },
      { date: today, state: "onTime", perfect: true },
    ]);
  });

  it("T-API-S89: cookieless is 401 with zero queries; a thrown db is 500; no-store and the CORS grant ride every branch", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);

    const noCookie = await GET(calendarRequest());
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });
    expect(noCookie.headers.get("cache-control")).toBe("no-store");
    expect(noCookie.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(noCookie.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
    expect(await ctx.db.select().from(users)).toHaveLength(0);

    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });
    const thrown = await GET(calendarRequest(generateSessionToken()));
    expect(thrown.status).toBe(500);
    expect(await thrown.json()).toEqual({ error: "internal" });
    expect(thrown.headers.get("cache-control")).toBe("no-store");
    expect(thrown.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(thrown.headers.get("access-control-allow-credentials")).toBe("true");
    dbOverride = undefined;

    const { token } = await createSession();
    const ok = await GET(calendarRequest(token));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
    const today = await todaySaoPaulo(ctx.db);
    expect(statsCalendarResponseSchema.parse(await ok.json()).days).toEqual([
      { date: today, state: "missed", perfect: false },
    ]);
  });

  it("T-API-S90: the clamp at the seam — a row one day before birth extends the range by exactly one day; a week-old row never extends it further", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "binairo",
      date: yesterday,
      outcome: "won",
      completedAtDate: today,
    });
    const extended = statsCalendarResponseSchema.parse(
      await (await GET(calendarRequest(token))).json(),
    );
    expect(extended.days).toEqual([
      { date: yesterday, state: "late", perfect: false },
      { date: today, state: "missed", perfect: false },
    ]);

    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: addDays(today, -7),
      outcome: "won",
      completedAtDate: addDays(today, -7),
    });
    const clamped = statsCalendarResponseSchema.parse(
      await (await GET(calendarRequest(token))).json(),
    );
    expect(clamped.days.map((day) => day.date)).toEqual([yesterday, today]);
  });

  it("T-API-S90a: a LOST row one day before birth never extends the range — reachable today, and the day it would fabricate does not appear", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "termo",
      date: yesterday,
      outcome: "lost",
      completedAtDate: today,
      guesses: 6,
    });
    const body = statsCalendarResponseSchema.parse(
      await (await GET(calendarRequest(token))).json(),
    );
    expect(body.days).toEqual([
      { date: today, state: "missed", perfect: false },
    ]);
  });

  it("T-API-S91: another user's completions never colour this user's calendar", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const winner = await createSession();
    const other = await createSession();

    for (const game of ["binairo", "sudoku", "nonogram"] as const) {
      await insertHistoryRow({
        userId: winner.userId,
        game,
        date: today,
        outcome: "won",
        completedAtDate: today,
      });
    }
    await insertHistoryRow({
      userId: winner.userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      guesses: 2,
    });

    const body = statsCalendarResponseSchema.parse(
      await (await GET(calendarRequest(other.token))).json(),
    );
    expect(body.days.every((day) => day.state === "missed")).toBe(true);
    expect(body.days.every((day) => !day.perfect)).toBe(true);

    const winnerBody = statsCalendarResponseSchema.parse(
      await (await GET(calendarRequest(winner.token))).json(),
    );
    expect(winnerBody.days.at(-1)).toEqual({
      date: today,
      state: "onTime",
      perfect: true,
    });
  });
});

describe("GET /stats/calendar — the archive widening (#31, ADR-0053)", () => {
  it("T-API-S103: a late row 400 days before the account's birth paints no calendar day, does not move the range start, and still counts in GET /stats' `solved`", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await ageAccount(userId, 3);
    const birthDay = addDays(today, -3);
    const prebirth = addDays(today, -400);

    await insertHistoryRow({
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });

    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: prebirth,
      outcome: "won",
      completedAtDate: today,
    });

    const response = await GET(calendarRequest(token));
    expect(response.status).toBe(200);
    const body = statsCalendarResponseSchema.parse(await response.json());

    expect(body.days.some((day) => day.date === prebirth)).toBe(false);
    expect(body.days[0]?.date).toBe(birthDay);
    expect(body.days).toHaveLength(4);

    const stats = await statsGet(
      new NextRequest("http://localhost:3001/stats", {
        method: "GET",
        headers: new Headers({ cookie: `${SESSION_COOKIE_NAME}=${token}` }),
      }),
    );
    expect(stats.status).toBe(200);
    const statsBody = statsResponseSchema.parse(await stats.json());
    expect(statsBody.sudoku.solved).toBe(1);

    expect(statsBody.sudoku.bestMs).toBeNull();
    expect(statsBody.sudoku.averageMs).toBeNull();
  });
});
