import { streakResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions, mergeAccounts } from "@miolos/db/user";
import { NextRequest } from "next/server";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { GET } from "../app/streak/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { requireUserId } from "../src/session/service";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  await ctx.db.execute(sql`truncate table users cascade`);
});

afterAll(async () => {
  await ctx.close();
});

const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

async function createSession(
  createdAt: Date,
): Promise<{ token: string; userId: string }> {
  const inserted = await ctx.db
    .insert(users)
    .values({ createdAt, updatedAt: createdAt })
    .returning();
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

function streakRequest(token: string): NextRequest {
  const headers = new Headers();
  headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  return new NextRequest("http://localhost:3001/streak", {
    method: "GET",
    headers,
  });
}

async function insertOnTimeWin(init: {
  userId: string;
  game: "binairo" | "sudoku" | "nonogram" | "termo";
  date: string;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    outcome: "won",
    completedAt: new Date(`${init.date}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    onTime: true,
  });
}

async function readStreak(
  token: string,
): Promise<{ date: string; streak: number; todayCounts: boolean }> {
  const response = await GET(streakRequest(token));
  expect(response.status).toBe(200);
  return streakResponseSchema.parse(await response.json());
}

describe("account merge at the cookie seam (ADR-0009, ADR-0022, ADR-0049)", () => {
  it("T-API-S54: the losing account's cookie resolves to the merged identity, and the real GET /streak under it serves the merged streak", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const winner = await createSession(OLDER);
    const loser = await createSession(NEWER);

    await insertOnTimeWin({
      userId: winner.userId,
      game: "binairo",
      date: today,
    });
    await insertOnTimeWin({
      userId: winner.userId,
      game: "binairo",
      date: addDays(today, -2),
    });
    await insertOnTimeWin({
      userId: loser.userId,
      game: "sudoku",
      date: addDays(today, -1),
    });
    await insertOnTimeWin({
      userId: loser.userId,
      game: "sudoku",
      date: addDays(today, -3),
    });

    expect(await requireUserId(ctx.db, winner.token)).toBe(winner.userId);
    expect(await requireUserId(ctx.db, loser.token)).toBe(loser.userId);
    expect(await readStreak(winner.token)).toEqual({
      date: today,
      streak: 1,
      todayCounts: true,
    });
    expect(await readStreak(loser.token)).toEqual({
      date: today,
      streak: 1,
      todayCounts: false,
    });

    expect(await mergeAccounts(ctx.db, winner.userId, loser.userId)).toEqual({
      winnerId: winner.userId,
      loserId: loser.userId,
    });

    expect(await requireUserId(ctx.db, loser.token)).toBe(winner.userId);

    const merged = { date: today, streak: 4, todayCounts: true };
    expect(await readStreak(loser.token)).toEqual(merged);
    expect(await readStreak(winner.token)).toEqual(merged);

    expect(await ctx.db.select().from(users)).toHaveLength(2);
  });
});
