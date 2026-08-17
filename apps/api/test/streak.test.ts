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

// Seam 4: the real GET /streak handler over PGlite (the completions.test.ts
// architecture). src/db is the only behavioural mock. History rows are
// manufactured by direct `db.insert(completions)` with an explicit
// `completedAt` — `recordCompletion` rightly accepts no timestamp, and
// T15:00:00Z is 12:00 in São Paulo, so a row stamped that way sits inside
// its own SP day (on time) and one stamped on the NEXT date is late.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

/** When set, the route sees this in place of the real db — the T-API-S53
 *  500-branch probe swaps in a client whose every access throws. */
let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? ctx.db,
}));

// Hook budget 30_000 ms. The arithmetic, both measured figures, the uncapped
// worst case and the re-derivation tripwire live once, beside `createTestDb`
// in `@miolos/db/testing` (ADR-0055 decision 1 as amended by #114; ADR-0057).
// Do not restate them here — 26 copies rot 26 ways.
beforeAll(async () => {
  ctx = await createTestDb();
}, 30_000);

beforeEach(async () => {
  // `cascade` from users reaches sessions and completions; daily_puzzles
  // is seeded by the T-API-S48 real-route half.
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

/**
 * A history row with a chosen completion instant. `completedAtDate` is the
 * SP day the completion HAPPENED on; the noon-SP stamp keeps it inside that
 * day unambiguously, so `on_time` derives to `completedAtDate === date`.
 */
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

async function readStreak(
  token: string,
): Promise<{ date: string; streak: number; todayCounts: boolean }> {
  const response = await GET(streakRequest(token));
  expect(response.status).toBe(200);
  return streakResponseSchema.parse(await response.json());
}

/** The losing Termo board for the real-route half of T-API-S48. */
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

    // The never-mints property at the read: `requireUserId` looked up and
    // refused; nothing was inserted on either path.
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S47: authenticated with no rows reads the honest zero, no-store, with the credentialed CORS grant", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);
    const { token } = await createSession();

    const response = await GET(streakRequest(token));
    expect(response.status).toBe(200);
    // Strict parse: an extra field or a missing one throws here.
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
    // (a) DOES NOT EXTEND / DAY NOT COUNTED. A won on-time row yesterday,
    // then today's Termo LOST through the REAL completions route (the
    // T-API-S39 six-guess shape): the streak stays 1 and today does not
    // count — the anchor skipped the lost day, not the whole history.
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

    // (b) DOES NOT MAINTAIN. won D−2, on-time lost D−1, nothing on D: the
    // run dies at the rollover only a lost row spans — 0, not 2.
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

    // A win FOR yesterday synced today (ADR-0026 decision 7's window):
    // on_time derives false and the day stays uncounted end to end.
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

    // The yesterday-alive case: an on-time run through D−2 and D−1 with
    // nothing on D reads intact until the rollover (ADR-0048 decision 2).
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
    // A db whose every access throws, standing in for a lost connection:
    // the catch must produce the same header discipline as every
    // intentional branch — a bare framework 500 carries neither.
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
    // Handlers are imported directly at this seam, so Next's own 405
    // wiring never runs; the assertion the seam CAN make is that no POST
    // and no OPTIONS export exists to be wired.
    const routeModule = await import("../app/streak/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });
});
