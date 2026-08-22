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
    // #58 (ADR-0066): stored at write; the old derivation's verdict for
    // these instants, i.e. migration 0008's backfill semantics.
    onTime: init.completedAtDate === init.date,
  });
}

/**
 * A motif name no curated table holds, so a hit in a response body is the
 * leak and never a coincidence — the marker-name discipline the route-ssr
 * scans in `apps/web` already use.
 */
const MOTIF_MARKER = "MOTIVO-VAZADO-64";

/**
 * Publishes today's Nonogram with a chosen `reveal.name`, through the same
 * write the cron uses so `published_at` is derived exactly as in production.
 * The content is a REAL generated puzzle with only the name replaced: a
 * hand-written object would have to satisfy the strict content schema's two
 * refinements, and a fixture that drifts from the engine proves nothing
 * about the row the wall will actually meet.
 */
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
        // played claim carries no duration and no hint count.
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
    // A WON Termo: completed on the wire, and no hint count — Termo ships no
    // hint at all (ADR-0045 decision 1), so "sem dicas" would present as a
    // virtue something that was never possible. Same suppression as its
    // duration (ADR-0060 decision 2, annotations (b) and (f)).
    await insertHistoryRow({
      userId,
      game: "termo",
      date: today,
      outcome: "won",
      completedAtDate: today,
      guesses: 4,
    });
    // A lost Termo's stored count is real and publishes nothing: a hint
    // count beside a loss would frame it as a result (the `elapsedMs` rule,
    // one field over).
    await insertHistoryRow({
      userId,
      game: "nonogram",
      date: today,
      outcome: "lost",
      completedAtDate: today,
      hintsUsed: 1,
      // `completions_guesses_check` pairs guesses with termo only; a grid
      // row never carries one. A lost grid row is unreachable through the
      // product and legal in the schema, which is exactly what makes it the
      // cheapest "played publishes nothing" fixture at this seam.
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
    // A completed SUDOKU on the same day: the name is scoped to the nonogram
    // claim by the producer, not merely by which row exists.
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

    // Every not-completed shape a nonogram can take on the DAY payload, each
    // with today's row published and holding a name the route could have
    // reached for: `pending` from no row, `played` from a lost row, and
    // `pending` from the late win.
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
        // The sharpest negative at this layer, and the one the route's
        // condition is the ONLY thing withholding the name from: the row
        // exists, it is a WIN, it is for today — and it was written on a
        // later SP day, so `onTime` is false and `statusOfRow` yields
        // `pending` (ADR-0060 consequence (f)). A `!== "pending"` or a
        // "did they win it" condition would both publish the name here.
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

      // ANTI-VACUITY FIRST, and it is not decoration: `collectKeys` returns
      // an EMPTY set for any non-object input — an HTML error page,
      // `undefined`, a number — so every negative below would pass trivially
      // over a body that was never walked. This is the first key scan in
      // this file; the four apps/api scans that predate it learned this the
      // hard way (daily-nonogram.test.ts's own block).
      const keys = collectKeys(raw);
      expect(keys.has("games"), label).toBe(true);
      expect(keys.has("status"), label).toBe(true);

      expect(keys.has("motifName"), label).toBe(false);
      // The standing bans hold too, unchanged: `motifName` is ADR-0033
      // decision 4's RENAME route, not a relaxation of the list.
      for (const forbidden of FORBIDDEN_DAILY_KEYS) {
        expect(keys.has(forbidden), `${label} / ${forbidden}`).toBe(false);
      }
    }
  });

  it("T-API-S178: the seeded motif name appears nowhere in the raw body of a not-completed day — the ADR-0004 VALUE scan (#64)", async () => {
    // A key scan cannot catch a value. T-API-S177 proves no field is named
    // `motifName`; this proves the NAME ITSELF is not in the response under
    // any other key, at any depth, which is the actual ADR-0004 claim. The
    // marker is a string no motif table contains, so a hit is the leak and
    // never a coincidence.
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
    // Anti-vacuity: the scan is worthless over an empty or error body.
    expect(body).toContain(`"nonogram":{"status":"played"}`);
    expect(body).not.toContain(MOTIF_MARKER);

    // And the positive control, so this test cannot pass because the route
    // never publishes a name at all: the same user, the same seeded row,
    // completed — the marker IS in the body.
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

    // NO daily row at all — reachable in production for a completion whose
    // day was published and later purged, and the plainest proof that the
    // route does not depend on `daily_puzzles` answering.
    const completedNoName = {
      status: "completed",
      elapsedMs: 512_000,
      hintsUsed: 0,
    };
    expect((await readDay(token)).games.nonogram).toEqual(completedNoName);

    // KILLED after publication (ADR-0004's kill switch): the wall hides the
    // row, the user's completion still stands, and the claim degrades to
    // exactly today's pre-#64 shape rather than failing the day.
    await seedNonogram(today, MOTIF_MARKER);
    await ctx.db.execute(
      sql`update daily_puzzles set killed_at = now() where game = 'nonogram' and date = ${today}`,
    );
    expect((await readDay(token)).games.nonogram).toEqual(completedNoName);

    // And a BLANK stored name — the row the generator would have refused to
    // write, normalised at the wall read. Without that normalisation this
    // is a 500 for the WHOLE payload, not a missing caption.
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
