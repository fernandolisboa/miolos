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

// Seam 4 for issue #20's AC 3 (plan 029 §7): "the losing account's cookie
// resolves to the merged identity" is a sentence about `sessions` rows and
// the real resolver, so it is tested where real tokens are hashed and the
// real `GET /streak` runs — the streak.test.ts architecture. NO production
// apps/api change rides this ticket: #21 owns the HTTP seam, and until it
// lands `mergeAccounts` is production-dormant, tested machinery (the
// grantHints posture).
let ctx: Awaited<ReturnType<typeof createTestDb>>;

vi.mock("../src/db", () => ({
  getDb: () => ctx.db,
}));

// Hook budget 30_000 ms, over vitest's bare 10_000 ms hook default. The
// measured figures behind it — isolated, capped, uncapped and CI — why it is
// not re-derived, and the re-derivation tripwire live once, beside
// `createTestDb` in `@miolos/db/testing` (ADR-0055 decision 1 as amended by
// #114; ADR-0057). Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` from users reaches sessions and completions.
  await ctx.db.execute(sql`truncate table users cascade`);
});

afterAll(async () => {
  await ctx.close();
});

// Pinned birthdays: D8's winner rule (older created_at wins) applied by
// hand, so the fixture names the winner before the merge runs.
const OLDER = new Date("2026-01-01T12:00:00.000Z");
const NEWER = new Date("2026-06-01T12:00:00.000Z");

/** A fresh identity with a live session cookie and a pinned birthday. */
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

/**
 * An on-time win for `date` — completed at noon SP (T15:00:00Z) of its own
 * day, so `on_time` derives true (the streak.test.ts fixture idiom).
 */
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
    // Interleaved calendars — two devices covering DIFFERENT days, the
    // ADR-0009 consequence shape: the winner holds today and D−2, the
    // loser D−1 and D−3, so each input alone reads streak 1 and the union
    // reads 4 — strictly greater than either, "correct, not a bug".
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

    // Before the merge: each real hashed token resolves to its own user,
    // and each history reads its own streak of 1.
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

    // The merge, driven exactly as #21's magic-link route will drive it
    // (AC 4's attach-flow readiness).
    expect(await mergeAccounts(ctx.db, winner.userId, loser.userId)).toEqual({
      winnerId: winner.userId,
      loserId: loser.userId,
    });

    // AC 3's own sentence: the LOSER's cookie now resolves to the merged
    // identity — through the only cookie→identity mechanism that exists
    // (one SELECT on sessions.token_hash), with nothing minted.
    expect(await requireUserId(ctx.db, loser.token)).toBe(winner.userId);

    // The recompute observed end to end through the deployed read path:
    // the real route under the loser's cookie serves the MERGED streak —
    // computeStreak over the unioned rows, reused unchanged (ADR-0048).
    const merged = { date: today, streak: 4, todayCounts: true };
    expect(await readStreak(loser.token)).toEqual(merged);
    expect(await readStreak(winner.token)).toEqual(merged);
    // And no phantom identity appeared anywhere in the flow.
    expect(await ctx.db.select().from(users)).toHaveLength(2);
  });
});
