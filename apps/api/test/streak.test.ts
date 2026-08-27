import { streakResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import { insertDailyPuzzle, todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
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

import { POST } from "../app/completions/route";
import { GET } from "../app/streak/route";
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
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
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

function streakRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/streak", {
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

async function readStreak(
  token: string,
): Promise<{ date: string; streak: number; todayCounts: boolean }> {
  const response = await GET(streakRequest(token));
  expect(response.status).toBe(200);
  return streakResponseSchema.parse(await response.json());
}

const TERMO_ANSWER = TERMO_ANSWERS[0];
if (TERMO_ANSWER === undefined) {
  throw new Error("unreachable: TERMO_ANSWERS is empty");
}
const termoAnswer = TERMO_ANSWER;
const TERMO_DECOYS: readonly string[] = TERMO_ANSWERS.map(
  (candidate) => candidate.normalized,
)
  .filter((word) => word !== termoAnswer.normalized)
  .slice(0, 6);

describe("GET /streak — the first authenticated read (ADR-0048, plan 027 §7)", () => {
  it("T-API-S46: no cookie and an unknown cookie are 401 no-session, and no user row is ever created", async () => {
    const noCookie = await GET(streakRequest());
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });

    const unknownCookie = await GET(streakRequest(generateSessionToken()));
    expect(unknownCookie.status).toBe(401);
    expect(await unknownCookie.json()).toEqual({ error: "no-session" });

    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S47: authenticated with no rows reads the honest zero, no-store, with the credentialed CORS grant", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);
    const { token } = await createSession();

    const response = await GET(streakRequest(token));
    expect(response.status).toBe(200);

    const body = streakResponseSchema.parse(await response.json());
    expect(body).toEqual({
      date: await todaySaoPaulo(ctx.db),
      streak: 0,
      todayCounts: false,
    });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("T-API-S48: the #27-transferred obligation (issue #19 comment 5159949996) — a lost Termo neither extends nor maintains a streak", async () => {
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
    expect(await readStreak(token)).toEqual({
      date: today,
      streak: 1,
      todayCounts: false,
    });

    await insertDailyPuzzle(ctx.db, {
      game: "termo",
      date: today,
      seed: 7,
      content: {
        canonical: termoAnswer.canonical,
        normalized: termoAnswer.normalized,
      },
    });
    const lossResponse = await POST(
      new NextRequest("http://localhost:3001/completions", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        }),
        body: JSON.stringify({
          game: "termo",
          date: today,
          guesses: [...TERMO_DECOYS],
          elapsedMs: 61_000,
          hintsUsed: 0,
        }),
      }),
    );
    expect(lossResponse.status).toBe(200);
    const lossBody: unknown = await lossResponse.json();
    expect(lossBody).toMatchObject({ outcome: "lost", recorded: true });

    expect(await readStreak(token)).toEqual({
      date: today,
      streak: 1,
      todayCounts: false,
    });

    const other = await createSession();
    const twoDaysAgo = addDays(today, -2);
    await insertHistoryRow({
      userId: other.userId,
      game: "sudoku",
      date: twoDaysAgo,
      outcome: "won",
      completedAtDate: twoDaysAgo,
    });
    await insertHistoryRow({
      userId: other.userId,
      game: "termo",
      date: yesterday,
      outcome: "lost",
      completedAtDate: yesterday,
      guesses: 6,
    });
    expect(await readStreak(other.token)).toEqual({
      date: today,
      streak: 0,
      todayCounts: false,
    });
  });

  it("T-API-S49: consecutive on-time Binairo days read 1 then 2 — AC 5 at the seam", async () => {
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
    expect(await readStreak(token)).toEqual({
      date: today,
      streak: 1,
      todayCounts: false,
    });

    await insertHistoryRow({
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      completedAtDate: today,
    });
    expect(await readStreak(token)).toEqual({
      date: today,
      streak: 2,
      todayCounts: true,
    });
  });

  it("T-API-S50: a late win never counts, and a run through yesterday reads alive with todayCounts false", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);

    const late = await createSession();
    await insertHistoryRow({
      userId: late.userId,
      game: "nonogram",
      date: yesterday,
      outcome: "won",
      completedAtDate: today,
    });
    expect(await readStreak(late.token)).toEqual({
      date: today,
      streak: 0,
      todayCounts: false,
    });

    const alive = await createSession();
    const twoDaysAgo = addDays(today, -2);
    await insertHistoryRow({
      userId: alive.userId,
      game: "binairo",
      date: twoDaysAgo,
      outcome: "won",
      completedAtDate: twoDaysAgo,
    });
    await insertHistoryRow({
      userId: alive.userId,
      game: "binairo",
      date: yesterday,
      outcome: "won",
      completedAtDate: yesterday,
    });
    expect(await readStreak(alive.token)).toEqual({
      date: today,
      streak: 2,
      todayCounts: false,
    });
  });

  it("T-API-S53: a thrown db is a 500 `internal` that still carries no-store and the credentialed CORS grant", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);

    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });

    const response = await GET(streakRequest(generateSessionToken()));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("T-API-S51: the route module exports GET (and the dynamic marker) and nothing else — D6's no-OPTIONS pinned as export-absence", async () => {
    const routeModule = await import("../app/streak/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });
});
