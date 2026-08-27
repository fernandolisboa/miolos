import { statsResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
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

import { GET } from "../app/stats/route";
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

function statsRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/stats", {
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
  guesses?: number;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    outcome: init.outcome,
    completedAt: new Date(`${init.completedAtDate}T15:00:00Z`),
    elapsedMs: init.elapsedMs ?? 61_000,
    hintsUsed: 0,
    guesses: init.guesses,

    onTime: init.completedAtDate === init.date,
  });
}

describe("GET /stats — the #29 aggregates (plan 033 §5, ADR-0051)", () => {
  it("T-API-S85: seeded on-time/late/lost rows parse through the strict contract with the exclusions visible at the seam", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    const { token, userId } = await createSession();

    await insertHistoryRow({
      userId,
      game: "binairo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 272_000,
    });
    await insertHistoryRow({
      userId,
      game: "sudoku",
      date: yesterday,
      outcome: "won",
      completedAtDate: today,
      elapsedMs: 480_000,
    });
    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "lost",
      completedAtDate: today,
      guesses: 6,
    });

    const response = await GET(statsRequest(token));
    expect(response.status).toBe(200);

    const body = statsResponseSchema.parse(await response.json());
    expect(body.date).toBe(today);

    expect(body.binairo).toEqual({
      solved: 1,
      bestMs: 272_000,
      averageMs: 272_000,
      averageSampleCount: 1,
      histogram: [0, 1, 0, 0, 0, 0],
    });

    expect(body.sudoku).toEqual({
      solved: 1,
      bestMs: null,
      averageMs: null,
      averageSampleCount: 0,
      histogram: [0, 0, 0, 0, 0, 0],
    });

    expect(body.termo).toEqual({
      solved: 0,
      distribution: [0, 0, 0, 0, 0, 0, 1],
    });
    expect(body.perfectDays).toBe(0);
    expect(body.todayTermoGuesses).toBeNull();
  });

  it("T-API-S86: cookieless is 401 with zero queries; a thrown db is 500; no-store and the CORS grant ride every branch", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);

    const noCookie = await GET(statsRequest());
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
    const thrown = await GET(statsRequest(generateSessionToken()));
    expect(thrown.status).toBe(500);
    expect(await thrown.json()).toEqual({ error: "internal" });
    expect(thrown.headers.get("cache-control")).toBe("no-store");
    expect(thrown.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(thrown.headers.get("access-control-allow-credentials")).toBe("true");
    dbOverride = undefined;

    const { token } = await createSession();
    const ok = await GET(statsRequest(token));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");
  });

  it("T-API-S87: todayTermoGuesses at the seam — won today reads the count, a loss reads null, another user's win never leaks", async () => {
    const today = await todaySaoPaulo(ctx.db);

    const winner = await createSession();
    await insertHistoryRow({
      userId: winner.userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      guesses: 4,
    });
    const winnerBody = statsResponseSchema.parse(
      await (await GET(statsRequest(winner.token))).json(),
    );
    expect(winnerBody.todayTermoGuesses).toBe(4);
    expect(winnerBody.termo.distribution).toEqual([0, 0, 0, 1, 0, 0, 0]);

    const loser = await createSession();
    await insertHistoryRow({
      userId: loser.userId,
      game: "termo",
      date: today,
      outcome: "lost",
      completedAtDate: today,
      guesses: 6,
    });
    expect(
      statsResponseSchema.parse(
        await (await GET(statsRequest(loser.token))).json(),
      ).todayTermoGuesses,
    ).toBeNull();

    const cold = await createSession();
    const coldBody = statsResponseSchema.parse(
      await (await GET(statsRequest(cold.token))).json(),
    );
    expect(coldBody.todayTermoGuesses).toBeNull();
    expect(coldBody.termo.distribution).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
