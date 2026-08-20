import { dayResponseSchema, type DayResponse } from "@miolos/core";
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

import { GET } from "../app/day/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// The real GET /day handler over PGlite (#83, ADR-0060), on the
// streak.test.ts architecture: src/db is the only behavioural mock, and
// history rows are manufactured by direct `db.insert(completions)` with an
// explicit `completedAt` — T15:00:00Z is 12:00 in São Paulo, so a row
// stamped that way sits inside its own SP day (on time) and one stamped on
// the NEXT date is late.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

/** When set, the route sees this in place of the real db — the 500-branch probe. */
let dbOverride: Awaited<ReturnType<typeof createTestDb>>["db"] | undefined;

/** Every statement the route issues, counted — the "401 costs zero queries" half. */
let queryCount = 0;

vi.mock("../src/db", () => ({
  getDb: () => dbOverride ?? countingDb(),
}));

/**
 * The real db behind a proxy that counts `select`/`execute` calls. A count
 * rather than a spy on one method, because the claim is about the route's
 * whole database traffic on the 401 branch, not about one statement.
 */
function countingDb(): Awaited<ReturnType<typeof createTestDb>>["db"] {
  return new Proxy(ctx.db, {
    get(target, property, receiver) {
      if (property === "select" || property === "execute") {
        queryCount += 1;
      }
      // Through an `unknown` binding rather than returned straight:
      // `Reflect.get` is typed `any`, and the trap's own signature is not a
      // place to launder it (`no-unsafe-return`).
      const value: unknown = Reflect.get(target, property, receiver);
      return value;
    },
  });
}

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
  });
}

async function readDay(token: string, search = ""): Promise<DayResponse> {
  const response = await GET(dayRequest(token, search));
  expect(response.status).toBe(200);
  // Strict parse: an extra field or a missing one throws here.
  return dayResponseSchema.parse(await response.json());
}

describe("GET /day — the server day-truth payload (#83, ADR-0060)", () => {
  it("T-API-S109: 200 answers the DB clock's SP today, with the four statuses the rows imply", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    // No rows: four pendings, which is the honest answer for a fresh day.
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
        // ADR-0008 rule 3: a lost Termo is PLAYED, never completed — and a
        // played claim carries no duration.
        termo: { status: "played" },
        sudoku: { status: "completed", elapsedMs: 61_000 },
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
    // A WON Termo: completed on the wire, and still no duration — Termo
    // publishes none on any projection (ADR-0045 decision 4), so the payload
    // must not invent the clock its own tile never renders. The hub captions
    // that tile `em 4/6` from GET /stats, one value one producer (ADR-0060
    // decision 2).
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
        nonogram: { status: "completed", elapsedMs: 512_000 },
        binairo: { status: "pending" },
      },
    });
  });

  it("T-API-S110: a cookieless GET is 401 no-session and costs ZERO queries; an unknown cookie costs only the session lookup", async () => {
    const noCookie = await GET(dayRequest());
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });
    // Auth is FIRST and sequential: `requireUserId` short-circuits on the
    // missing cookie, so neither the clock read nor the completions read
    // ever runs. A cookieless hub view must cost the database nothing.
    expect(queryCount).toBe(0);

    const unknownCookie = await GET(dayRequest(generateSessionToken()));
    expect(unknownCookie.status).toBe(401);
    expect(await unknownCookie.json()).toEqual({ error: "no-session" });
    // One statement — the session lookup that refused. Still no clock read
    // and no completions read.
    expect(queryCount).toBe(1);

    // The never-mints property at the read.
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S111: no-store and the credentialed CORS grant on all three branches — 200, 401 and the catch-all 500", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);
    const { token } = await createSession();

    const ok = await GET(dayRequest(token));
    expect(ok.status).toBe(200);

    const unauthorised = await GET(dayRequest());
    expect(unauthorised.status).toBe(401);

    // A db whose every access throws, standing in for a lost connection:
    // the catch must produce the same header discipline as every
    // intentional branch — a bare framework 500 carries neither.
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
    // The isolation holds for the duration too — a value, not just a verb,
    // must never cross users (#141).
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
    // Handlers are imported directly at this seam, so Next's own 405 wiring
    // never runs; the assertion the seam CAN make is that no POST and no
    // OPTIONS export exists to be wired — `T-API-S51`'s claim, made about
    // this route (a second file, so a second id).
    const routeModule = await import("../app/day/route");
    expect(Object.keys(routeModule).sort()).toEqual(["GET", "dynamic"]);
  });
});
