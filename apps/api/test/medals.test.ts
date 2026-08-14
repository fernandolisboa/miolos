import { medalsResponseSchema } from "@miolos/core";
import { sessions, sql, users } from "@miolos/db";
import { todaySaoPaulo } from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions, medalGrants } from "@miolos/db/user";
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

import { GET } from "../app/medals/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

// Seam 4: the real GET /medals handler over PGlite (the streak.test.ts
// architecture). src/db is the only behavioural mock. History rows are
// manufactured by direct `db.insert(completions)` with an explicit
// `completedAt`, and grant rows by direct `db.insert(medalGrants)` — the
// manufactured-rows precedent: no code writer exists for grants in v1
// (the operator ritual, ADR-0052), exactly as #29 manufactured late rows
// before any late writer existed.
let ctx: Awaited<ReturnType<typeof createTestDb>>;

/** When set, the route sees this in place of the real db — T-API-S94's
 *  two probes ride it: a counting proxy over the real db (the 401 path's
 *  zero-queries-beyond-auth claim, asserted rather than titled) and a
 *  client whose every access throws (the 500 branch). */
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
  // `cascade` from users reaches sessions, completions and medal_grants.
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

function medalsRequest(token?: string): NextRequest {
  const headers = new Headers();
  if (token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${token}`);
  }
  return new NextRequest("http://localhost:3001/medals", {
    method: "GET",
    headers,
  });
}

/**
 * A LATE win dated `date`, completed at noon-SP TODAY: on_time derives
 * false, so the row moves the volume totals (late wins count — ADR-0008
 * rule 2 names distributions, not totals) while touching no streak, no
 * perfect day and no guess medal — the seeded set stays computable by
 * hand.
 */
async function insertLateWin(init: {
  userId: string;
  game: "binairo" | "sudoku" | "nonogram" | "termo";
  date: string;
  today: string;
}): Promise<void> {
  await ctx.db.insert(completions).values({
    userId: init.userId,
    game: init.game,
    date: init.date,
    outcome: "won",
    completedAt: new Date(`${init.today}T15:00:00Z`),
    elapsedMs: 61_000,
    hintsUsed: 0,
    guesses: init.game === "termo" ? 3 : undefined,
  });
}

/** The operator ritual's shape (ADR-0052): a direct grant insert. */
async function insertGrant(userId: string, medalId: string): Promise<void> {
  await ctx.db.insert(medalGrants).values({ userId, medalId });
}

async function readMedals(token: string): Promise<{ medals: string[] }> {
  const response = await GET(medalsRequest(token));
  expect(response.status).toBe(200);
  return medalsResponseSchema.parse(await response.json());
}

describe("GET /medals — the earned id set (#30, ADR-0052)", () => {
  it("T-API-S92: seeded completions earn the expected rule-derived ids through the strict contract — the n−1th win leaves wins-10 absent and the nth surfaces it", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token, userId } = await createSession();

    // Zero history: the honest empty set parses.
    expect(await readMedals(token)).toEqual({ medals: [] });

    // Nine late binairo wins on nine distinct past dates: first-win is
    // earned from the first (a late solve is honestly a solve), wins-10
    // is one row short.
    for (let i = 1; i <= 9; i += 1) {
      await insertLateWin({
        userId,
        game: "binairo",
        date: addDays(today, -i),
        today,
      });
    }
    expect(await readMedals(token)).toEqual({ medals: ["first-win"] });

    // The tenth row earns it — the threshold visible at the seam, in
    // catalog order.
    await insertLateWin({
      userId,
      game: "binairo",
      date: addDays(today, -10),
      today,
    });
    expect(await readMedals(token)).toEqual({
      medals: ["first-win", "wins-10"],
    });
  });

  it("T-API-S93: a directly-inserted curated grant surfaces its id; a rule-derived-id grant row is ignored — never surfaced, never an error", async () => {
    const { token, userId } = await createSession();

    // The curated grant (the operator ritual's own row shape).
    await insertGrant(userId, "founder");
    // A grant row bearing a RULE-DERIVED id: ignored at read time —
    // storing one could fake an uncomputed feat or desync from a
    // recompute (ADR-0052). The caller has zero completions, so
    // surfacing it would be exactly that fake.
    await insertGrant(userId, "first-win");
    // A shape-valid id unknown to the bundled catalog: the read-time
    // no-op the shape CHECK (never a membership CHECK) was chosen for.
    await insertGrant(userId, "ghost-medal");

    expect(await readMedals(token)).toEqual({ medals: ["founder"] });
  });

  it("T-API-S94: cookieless is 401 with zero queries beyond auth, a thrown db is 500 internal, and no-store plus the CORS grant ride every branch", async () => {
    vi.stubEnv("WEB_ORIGIN", WEB);

    // The 401 path runs over a COUNTING proxy: every query-verb access on
    // the db is recorded and forwarded to the real client, so "zero
    // queries beyond auth" is an asserted access list, not a title. Only
    // the verbs are counted — every drizzle query STARTS with one, while
    // execution also reads internal plumbing (`session`, `dialect`) off
    // the instance, which is not a query of its own.
    const QUERY_VERBS = new Set([
      "select",
      "insert",
      "update",
      "delete",
      "execute",
      "transaction",
    ]);
    const accessed: string[] = [];
    dbOverride = new Proxy(ctx.db, {
      get(target, property, receiver) {
        if (typeof property === "string" && QUERY_VERBS.has(property)) {
          accessed.push(property);
        }
        // `as unknown` only widens Reflect.get's `any` for no-unsafe-return.
        return Reflect.get(target, property, receiver) as unknown;
      },
    });

    // No cookie: 401 no-session before the db is touched AT ALL — zero
    // accesses, auth included (`requireUserId` short-circuits tokenless).
    const noCookie = await GET(medalsRequest());
    expect(noCookie.status).toBe(401);
    expect(await noCookie.json()).toEqual({ error: "no-session" });
    expect(noCookie.headers.get("cache-control")).toBe("no-store");
    expect(noCookie.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(accessed).toEqual([]);

    // An unknown cookie: exactly the one auth lookup (`select`), and none
    // of the three post-auth reads — a 401 costs zero queries beyond auth.
    const unknownCookie = await GET(medalsRequest(generateSessionToken()));
    expect(unknownCookie.status).toBe(401);
    expect(accessed).toEqual(["select"]);
    dbOverride = undefined;
    expect(await ctx.db.select().from(users)).toHaveLength(0);

    // The 200 branch carries the same discipline.
    const { token } = await createSession();
    const ok = await GET(medalsRequest(token));
    expect(ok.status).toBe(200);
    expect(ok.headers.get("cache-control")).toBe("no-store");
    expect(ok.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(ok.headers.get("access-control-allow-credentials")).toBe("true");

    // A db whose every access throws (the T-API-S53 pattern): the catch
    // must produce the same header discipline as every intentional branch.
    dbOverride = new Proxy({} as NonNullable<typeof dbOverride>, {
      get() {
        throw new Error("connection lost");
      },
    });
    const response = await GET(medalsRequest(generateSessionToken()));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: "internal" });
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("access-control-allow-origin")).toBe(WEB);
    expect(response.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("T-API-S95: another user's completions and grants never move the caller's answer", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const caller = await createSession();
    const other = await createSession();

    await insertLateWin({
      userId: other.userId,
      game: "binairo",
      date: addDays(today, -1),
      today,
    });
    await insertGrant(other.userId, "founder");

    expect(await readMedals(caller.token)).toEqual({ medals: [] });
    expect(await readMedals(other.token)).toEqual({
      medals: ["first-win", "founder"],
    });
  });
});
