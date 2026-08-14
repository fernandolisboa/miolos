import { statsCalendarResponseSchema } from "@miolos/core";
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
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// Seam 4: the real GET /stats/calendar handler over PGlite (the
// streak.test.ts architecture). src/db is the only behavioural mock.
// The range anchor is `users.created_at`'s SP day, so tests move the
// anchor by UPDATING created_at with a DB-side interval — never a JS
// clock. History rows carry an explicit `completedAt`: T15:00:00Z is
// 12:00 in São Paulo (inside its own day = on time); stamped on a LATER
// date the row derives late.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

/** When set, the route sees this in place of the real db — the 500-branch
 *  probe swaps in a client whose every access throws (T-API-S53 pattern). */
let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

// PGlite boot measures ~1.2 s locally and CI runners are ~3–4× slower;
// 1.2 s × 4 + margin puts the ceiling well above vitest's 10 s default,
// which would otherwise flake this file on CI alone (plan 017 §15).
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

/** Move the account's birth back `days` days — DB-side arithmetic only. */
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
  });
}

describe("GET /stats/calendar — the #29 day enumeration (plan 033 §5, ADR-0051)", () => {
  it("T-API-S88: the range runs from created_at's SP day to the DB clock's today, three states from real rows, the perfect marker on a four-win day only, days and nothing else", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();
    await ageAccount(userId, 3);

    // today: all four games won on time — an "onTime" day AND a Dia
    // Perfeito. today−1: a lost Termo ONLY — lost rows never colour a
    // day, so it renders "missed" (and the day is structurally not
    // perfect). today−2: a win dated there but synced today — "late".
    // today−3 (the birth day): no rows — "missed".
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
    // The payload carries `days` and nothing else — no envelope fields.
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

    // The 200 branch (a cold account: one honest "missed" day) carries
    // the same discipline.
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

    // The ACCEPTED_DAYS_BACK birth-midnight case: an account minted just
    // after the SP rollover completing YESTERDAY's puzzle — the row is
    // dated one day before created_at's SP day and must appear.
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

    // A manufactured row a week before birth (no writer can produce one
    // today) does NOT drag the range further back: it emits no day entry
    // and contributes nothing to the clamp — the start stays where the
    // yesterday won row put it (the won-only rule, ADR-0051 decision 2).
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

    // The reachable case the won-only clamp exists for: a 00:20 account
    // LOSES yesterday's Termo (ACCEPTED_DAYS_BACK admits the write). A
    // lost row colours no day, so an extension it earned could only paint
    // "missed" on a day the account did not exist for — the range must
    // start at birth, and the loss still lands in the fail row (visible
    // on GET /stats, not here).
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
});
