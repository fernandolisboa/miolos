import { termoGuessResponseSchema } from "@miolos/core";
import { eq, sessions, sql, users } from "@miolos/db";
import {
  dailyPuzzles,
  insertDailyPuzzle,
  todaySaoPaulo,
} from "@miolos/db/publishing";
import { createTestDb } from "@miolos/db/testing";
import { completions } from "@miolos/db/user";
import {
  isValidGuess,
  TERMO_ANSWERS,
  type TermoAnswer,
} from "@miolos/games/termo";
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

// #31 (ADR-0053): T-API-S101 asserts that both write routes share ONE
// window, which is only checkable by driving the other route. Statically
// imported, the `completions.test.ts` register — `vi.mock` is hoisted
// above every import, so a route module needs no `await import(...)` to
// see the mocked `../src/db`, and one idiom for one need beats two.
import { POST as completionsPost } from "../app/completions/route";
import { OPTIONS, POST } from "../app/termo/guess/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

/**
 * Seam 4: the real route over PGlite; the ONLY mock is `src/db`. Seeding goes
 * through `insertDailyPuzzle` — the same write the cron uses.
 *
 * The route under test is the product's first mid-game judgement and the one
 * place `deriveBoardStatus` can be reached from an untrusted body (ADR-0038,
 * plan 022 §11.1). It is STATELESS and writes NOTHING: every case below
 * asserts an empty `completions` table at the end, because "no row" is half
 * of what makes a replay free.
 *
 * No per-`it` timeout: the engine work is ≤6 evaluations of a five-letter
 * word, so every case here is a PGlite round trip and nothing else. The boot
 * hook keeps its own, which is what it is for — on evidence the comment beside
 * `beforeAll` points at.
 */
let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { getDbCalls } = vi.hoisted(() => ({ getDbCalls: vi.fn() }));

vi.mock("../src/db", () => ({
  getDb: () => {
    getDbCalls();
    return ctx.db;
  },
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
  await ctx.db.execute(sql`truncate table users, daily_puzzles cascade`);
  getDbCalls.mockClear();
  vi.stubEnv("WEB_ORIGIN", "https://miolos.app");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

afterAll(async () => {
  await ctx.close();
});

/**
 * The seeded answer, taken from the curated list by predicate rather than by
 * the top-up's rejection draw: the route is under test, not the publication.
 * ACCENTED, so `canonical` and `normalized` genuinely differ and the reveal
 * assertion can name the exact string — the whole point of storing both
 * (ADR-0040).
 */
const ANSWER: TermoAnswer | undefined = TERMO_ANSWERS.find(
  (answer) => answer.canonical !== answer.normalized,
);

if (ANSWER === undefined) {
  throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
}
const answer: TermoAnswer = ANSWER;

/**
 * Six dictionary words that are NOT the answer, in a fixed order. Drawn from
 * the answer list itself, whose normalized forms are all members of the
 * validation dictionary (ADR-0038 (j)) — asserted below rather than assumed,
 * because a test whose "valid" words silently stopped being valid would prove
 * the 422 path and call it the happy path.
 */
const DECOYS: readonly string[] = TERMO_ANSWERS.map((a) => a.normalized)
  .filter((word) => word !== answer.normalized)
  .slice(0, 6);

/** In the dictionary's shape (`^[a-z]{5}$`) but not in the dictionary. */
const NOT_A_WORD = "zzzzz";

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

async function seedTermo(date: string, seed = 7): Promise<void> {
  await insertDailyPuzzle(ctx.db, {
    game: "termo",
    date,
    seed,
    content: { canonical: answer.canonical, normalized: answer.normalized },
  });
}

function guessRequest(init: {
  body?: string;
  token?: string;
  /** null omits the header entirely; undefined means application/json. */
  contentType?: string | null;
  secFetchSite?: string;
  origin?: string;
}): NextRequest {
  const headers = new Headers();
  const contentType =
    init.contentType === undefined ? "application/json" : init.contentType;
  if (contentType !== null) {
    headers.set("content-type", contentType);
  }
  if (init.token !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${init.token}`);
  }
  if (init.secFetchSite !== undefined) {
    headers.set("sec-fetch-site", init.secFetchSite);
  }
  if (init.origin !== undefined) {
    headers.set("origin", init.origin);
  }
  return new NextRequest("http://localhost:3001/termo/guess", {
    method: "POST",
    headers,
    body: init.body,
  });
}

function guessBody(date: string, guesses: readonly string[]): string {
  return JSON.stringify({ game: "termo", date, guesses: [...guesses] });
}

async function completionRows(): Promise<unknown[]> {
  return ctx.db.select().from(completions);
}

/** The raw JSON, so a test can assert a key is ABSENT rather than undefined. */
async function rawBody(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("the route answered with a non-object body");
  }
  return parsed as Record<string, unknown>;
}

describe("POST /termo/guess", () => {
  it("T-API-S36: the decoys really are dictionary words and the answer really is one", () => {
    // Anti-vacuity for the whole file: every "valid list" below rests on this.
    expect(DECOYS).toHaveLength(6);
    for (const word of DECOYS) {
      expect(isValidGuess(word), `${word} must be a dictionary word`).toBe(
        true,
      );
    }
    expect(isValidGuess(answer.normalized)).toBe(true);
    expect(isValidGuess(NOT_A_WORD)).toBe(false);
    expect(answer.canonical).not.toBe(answer.normalized);
  });

  it("T-API-S36: a mid-game list is `playing`, its tiles are parallel and in order, and there is NO answer key", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    const guesses = DECOYS.slice(0, 3);

    const response = await POST(
      guessRequest({ token, body: guessBody(today, guesses) }),
    );

    expect(response.status).toBe(200);
    const raw = await rawBody(response);
    // The key is ABSENT, not `undefined`: `JSON.stringify` drops an undefined
    // value, so `body.answer === undefined` would pass on a leak too.
    expect("answer" in raw).toBe(false);
    const body = termoGuessResponseSchema.parse(raw);
    expect(body.status).toBe("playing");
    expect(body.date).toBe(today);
    expect(body.tiles).toHaveLength(3);
    // Parallel and IN THE SUBMITTED ORDER — the request is not echoed, so
    // this is the only thing that ties a row to its guess.
    for (const [index, guess] of guesses.entries()) {
      const row = body.tiles[index];
      expect(row).toBeDefined();
      for (const [position, tile] of (row ?? []).entries()) {
        const expected =
          guess.charAt(position) === answer.normalized.charAt(position)
            ? "correct"
            : answer.normalized.includes(guess.charAt(position))
              ? // Pass 2 is count-aware, so "present" is not implied by mere
                // membership; only "correct" and "absent" are decidable here.
                tile
              : "absent";
        expect(tile).toBe(expected);
      }
    }
    // Stateless: nothing is written, ever.
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S36: a winning list is `won` and reveals the CANONICAL accented spelling", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      guessRequest({
        token,
        body: guessBody(today, [...DECOYS.slice(0, 2), answer.normalized]),
      }),
    );

    expect(response.status).toBe(200);
    const body = termoGuessResponseSchema.parse(await response.json());
    expect(body.status).toBe("won");
    // The reveal is `content.canonical`, never the normalized form the player
    // typed: nothing else in the runtime can recover an accented spelling.
    expect(body.answer).toBe(answer.canonical);
    expect(body.tiles[2]).toEqual([
      "correct",
      "correct",
      "correct",
      "correct",
      "correct",
    ]);
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S36: SIX exhausted guesses are `lost` — a 200 with the answer, never a 422", async () => {
    // The one place Termo INVERTS the grid games' rule. A wrong grid is a
    // client bug and writes nothing; six wrong Termo guesses is the game
    // working (ADR-0038 decision 4), so the board closes and the answer is
    // revealed.
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      guessRequest({ token, body: guessBody(today, DECOYS) }),
    );

    expect(response.status).toBe(200);
    const body = termoGuessResponseSchema.parse(await response.json());
    expect(body.status).toBe("lost");
    expect(body.answer).toBe(answer.canonical);
    expect(body.tiles).toHaveLength(6);
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S36: FIVE wrong guesses are still `playing` — the boundary, from the other side", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const response = await POST(
      guessRequest({ token, body: guessBody(today, DECOYS.slice(0, 5)) }),
    );

    expect(response.status).toBe(200);
    const raw = await rawBody(response);
    expect("answer" in raw).toBe(false);
    expect(termoGuessResponseSchema.parse(raw).status).toBe("playing");
  });

  it("T-API-S36: YESTERDAY's board is judged against yesterday's row (the rollover case)", async () => {
    // The shared write window exists for exactly this: a player mid-game at
    // the São Paulo rollover must be able to submit guess five for
    // yesterday's date, or Termo becomes unfinishable at midnight (ADR-0038
    // decision 8, whose one-predicate-both-routes substance survives #31).
    const today = await todaySaoPaulo(ctx.db);
    const yesterday = addDays(today, -1);
    await seedTermo(yesterday, 21);

    const { token } = await createSession();
    const response = await POST(
      guessRequest({
        token,
        body: guessBody(yesterday, [answer.normalized]),
      }),
    );

    expect(response.status).toBe(200);
    const body = termoGuessResponseSchema.parse(await response.json());
    expect(body.date).toBe(yesterday);
    expect(body.status).toBe("won");
  });
});

describe("POST /termo/guess — the gate ladder", () => {
  it("T-API-S37: is force-dynamic and answers preflight (a JSON POST always preflights)", async () => {
    const route = await import("../app/termo/guess/route");
    expect(route.dynamic).toBe("force-dynamic");
    const preflight = OPTIONS();
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get("access-control-allow-credentials")).toBe(
      "true",
    );
  });

  it("T-API-S37: no session cookie ⇒ 401, and no user is minted", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);

    const response = await POST(
      guessRequest({ body: guessBody(today, [DECOYS[0] ?? ""]) }),
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "no-session" });
    // The route NEVER mints — an unauthenticated guess is not a new player.
    expect(await ctx.db.select().from(users)).toHaveLength(0);
  });

  it("T-API-S37: Sec-Fetch-Site: cross-site ⇒ 403 before the database is touched", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    getDbCalls.mockClear();

    const response = await POST(
      guessRequest({
        token,
        secFetchSite: "cross-site",
        body: guessBody(today, [DECOYS[0] ?? ""]),
      }),
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "cross-site" });
    expect(getDbCalls).not.toHaveBeenCalled();
  });

  it("T-API-S37: a non-JSON or absent Content-Type ⇒ 415 before the database is touched", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    const body = guessBody(today, [DECOYS[0] ?? ""]);
    getDbCalls.mockClear();

    const textPlain = await POST(
      guessRequest({
        token,
        body,
        contentType: "text/plain",
        secFetchSite: "same-site",
      }),
    );
    expect(textPlain.status).toBe(415);
    expect(await textPlain.json()).toEqual({
      error: "unsupported-media-type",
    });

    const missing = await POST(
      guessRequest({ token, body, contentType: null }),
    );
    expect(missing.status).toBe(415);

    expect(getDbCalls).not.toHaveBeenCalled();
  });

  it("T-API-S37: malformed JSON, a bad shape and an impossible date each ⇒ 400, never 500", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();
    const word = DECOYS[0] ?? "";

    const bodies = [
      "{not json",
      guessBody(today, []),
      guessBody(
        today,
        Array.from({ length: 7 }, () => word),
      ),
      guessBody(today, ["CAFÉ"]),
      guessBody(today, ["cafe"]),
      guessBody(today, ["2026-08-02"]),
      // Year 0000 survives `calendarDateString`'s UTC round trip and raises
      // 22008 at a Postgres `date` column, so the floor is a 400 here rather
      // than a 500 three statements later.
      guessBody("0000-01-01", [word]),
      guessBody("2026-02-30", [word]),
      JSON.stringify({ game: "binairo", date: today, guesses: [word] }),
      JSON.stringify({
        game: "termo",
        date: today,
        guesses: [word],
        tiles: [],
      }),
    ];

    for (const body of bodies) {
      const response = await POST(guessRequest({ token, body }));
      expect(response.status, body.slice(0, 60)).toBe(400);
      expect(await response.json()).toEqual({ error: "invalid-body" });
    }
  });

  it("T-API-S37: two days back is now JUDGED; a future date, an unpublished row and a killed row each ⇒ 404 (#31)", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const tomorrow = addDays(today, 1);
    const twoDaysAgo = addDays(today, -2);
    await seedTermo(today);
    await seedTermo(tomorrow, 11);
    await seedTermo(twoDaysAgo, 13);
    const { token } = await createSession();
    const list = [answer.normalized];

    // THE WIDENING (#31, ADR-0053 decision 5), pinned where the old lower
    // bound was pinned. The row exists and is published, and the write
    // window no longer has a lower half — so an archived Termo is judged,
    // which is what makes one playable at all. The wall is now the only
    // lower authority, and the three cases below are what it still refuses.
    const archived = await POST(
      guessRequest({ token, body: guessBody(twoDaysAgo, list) }),
    );
    expect(archived.status).toBe(200);

    // Tomorrow is refused by `isWritableDate` in the ROUTE, ahead of the
    // wall read — the upper bound is the one #31 tightened (before it, a
    // future date reached the wall and was refused there).
    const future = await POST(
      guessRequest({ token, body: guessBody(tomorrow, list) }),
    );
    expect(future.status).toBe(404);

    const missing = await POST(
      guessRequest({ token, body: guessBody(addDays(today, 2), list) }),
    );
    expect(missing.status).toBe(404);

    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.game, "termo"));
    const killed = await POST(
      guessRequest({ token, body: guessBody(today, list) }),
    );
    expect(killed.status).toBe(404);
    expect(await killed.json()).toEqual({ error: "no-puzzle" });
  });

  it("T-API-S37: EVERY response carries the credentialed CORS grant, 4xx included", async () => {
    // On a credentialed cross-origin fetch a response without these headers is
    // unreadable to JS, and on this route the STATUS is the screen's control
    // flow (ADR-0039 decision 3): a 422 that arrived as an opaque TypeError
    // would be indistinguishable from being offline, and the turn would be
    // held instead of cleared.
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const responses = [
      await POST(guessRequest({ body: guessBody(today, [NOT_A_WORD]) })), // 401
      await POST(
        guessRequest({
          token,
          secFetchSite: "cross-site",
          body: guessBody(today, [NOT_A_WORD]),
        }),
      ), // 403
      await POST(
        guessRequest({ token, body: guessBody(today, []), contentType: null }),
      ), // 415
      await POST(guessRequest({ token, body: "{not json" })), // 400
      await POST(
        guessRequest({
          token,
          body: guessBody(addDays(today, 5), [NOT_A_WORD]),
        }),
      ), // 404
      await POST(guessRequest({ token, body: guessBody(today, [NOT_A_WORD]) })), // 422
      await POST(
        guessRequest({ token, body: guessBody(today, [answer.normalized]) }),
      ), // 200
    ];

    expect(responses.map((r) => r.status)).toEqual([
      401, 403, 415, 400, 404, 422, 200,
    ]);
    for (const response of responses) {
      expect(response.headers.get("access-control-allow-origin")).toBe(
        "https://miolos.app",
      );
      expect(response.headers.get("access-control-allow-credentials")).toBe(
        "true",
      );
    }
  });
});

describe("POST /termo/guess — 422 invalid-guess", () => {
  it("T-API-S38: the NEWEST word outside the validation dictionary ⇒ 422 invalid-guess, and it never reaches the engine", async () => {
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    for (const guesses of [[NOT_A_WORD], [DECOYS[0] ?? "", NOT_A_WORD]]) {
      const response = await POST(
        guessRequest({ token, body: guessBody(today, guesses) }),
      );
      expect(response.status).toBe(422);
      expect(await response.json()).toEqual({ error: "invalid-guess" });
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S42: an EARLIER non-word is judged normally — the gate is the newest guess only", async () => {
    // The soft-lock this exists to prevent (#27 step-7 finding A-1). The route
    // is stateless, so the client re-posts every earlier guess every turn. If
    // the gate ran over the whole list, ONE word removed from validation.txt
    // after an independent `apps/web` deploy would 422 every subsequent turn
    // of a board that already contains it — the player retypes forever, and
    // the completion POST then 422s permanently on a terminal status. Only
    // the word just typed can honestly be handed back.
    //
    // An earlier non-word cannot manufacture a win either: the win test is
    // `guess === answer` and the answer is a dictionary member, so the two
    // cases below stay `playing` and the third still closes as a real win.
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    for (const [guesses, expected] of [
      [[NOT_A_WORD, DECOYS[0] ?? ""], "playing"],
      [[DECOYS[0] ?? "", NOT_A_WORD, DECOYS[1] ?? ""], "playing"],
      [[NOT_A_WORD, answer.normalized], "won"],
    ] as const) {
      const response = await POST(
        guessRequest({ token, body: guessBody(today, [...guesses]) }),
      );
      expect(response.status, guesses.join(",")).toBe(200);
      const body = termoGuessResponseSchema.parse(await response.json());
      expect(body.status).toBe(expected);
      expect(body.tiles).toHaveLength(guesses.length);
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S38: a row FOLLOWING a winning row ⇒ 422 `board-closed`, and never the 500 `deriveBoardStatus` would throw", async () => {
    // `deriveBoardStatus` throws a RangeError when a winning row is followed
    // by another (status.ts:31-36), and that case is reachable from a hostile
    // body — an uncaught RangeError in a route handler is a 500. The explicit
    // pre-check in front of the call is what makes it a 422, and it is exact
    // rather than conservative: `evaluateGuess` writes "correct" only where
    // `g.charAt(i) === a.charAt(i)`, so all-five-correct ⟺ the guess EQUALS
    // the answer.
    //
    // The CODE is `board-closed`, not `invalid-guess` (#27 step-7 finding
    // A-3). This is a client bug or tampering, never a player outcome, and
    // the old shared code told a desynced board that a correct word was not
    // in the dictionary. `POST /completions` already named the same fact
    // separately (`guess-mismatch`).
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    for (const guesses of [
      [answer.normalized, DECOYS[0] ?? ""],
      [DECOYS[0] ?? "", answer.normalized, DECOYS[1] ?? ""],
      [answer.normalized, answer.normalized],
      Array.from({ length: 6 }, () => answer.normalized),
    ]) {
      const response = await POST(
        guessRequest({ token, body: guessBody(today, guesses) }),
      );
      expect(response.status, guesses.join(",")).toBe(422);
      expect(await response.json()).toEqual({ error: "board-closed" });
    }
    expect(await completionRows()).toHaveLength(0);
  });

  it("T-API-S38: a winning row LAST is accepted — the pre-check can never 422 a legitimate board", async () => {
    // Anti-vacuity for the test above: the same equality that rejects a
    // continued board must accept every honest one, at all six positions.
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    for (let length = 1; length <= 6; length += 1) {
      const guesses = [...DECOYS.slice(0, length - 1), answer.normalized];
      const response = await POST(
        guessRequest({ token, body: guessBody(today, guesses) }),
      );
      expect(response.status, `a win at position ${String(length)}`).toBe(200);
      const body = termoGuessResponseSchema.parse(await response.json());
      expect(body.status).toBe("won");
      expect(body.tiles).toHaveLength(length);
    }
  });
});

describe("POST /termo/guess — the archive write window (#31, ADR-0053)", () => {
  it("T-API-S101: an archived Termo is judged, and the window is the SAME one /completions uses", async () => {
    // An archived Termo needs both routes to agree about the date or it is
    // unfinishable: the guess route would judge and the completion route
    // would 404 the result, or the reverse. ADR-0038 decision 8's
    // one-predicate-both-routes rule is what stops that, and #31 kept it
    // while removing the window's lower half — so this asserts one seeded
    // date through BOTH routes rather than trusting the shared import.
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -90);
    await seedTermo(archived);
    const { token } = await createSession();

    // The ladder answers, mid-game, at a 90-day-old date.
    const playing = await POST(
      guessRequest({ token, body: guessBody(archived, DECOYS.slice(0, 3)) }),
    );
    expect(playing.status).toBe(200);
    const playingBody = termoGuessResponseSchema.parse(await playing.json());
    expect(playingBody.status).toBe("playing");
    expect(playingBody.tiles).toHaveLength(3);

    // And it closes, at the same date.
    const won = await POST(
      guessRequest({
        token,
        body: guessBody(archived, [...DECOYS.slice(0, 2), answer.normalized]),
      }),
    );
    expect(termoGuessResponseSchema.parse(await won.json()).status).toBe("won");

    // The completion route accepts the same date — one window, both routes.
    const completion = await completionsPost(
      new NextRequest("http://localhost:3001/completions", {
        method: "POST",
        headers: new Headers({
          "content-type": "application/json",
          cookie: `${SESSION_COOKIE_NAME}=${token}`,
        }),
        body: JSON.stringify({
          game: "termo",
          date: archived,
          guesses: [...DECOYS.slice(0, 2), answer.normalized],
          elapsedMs: 61_000,
          hintsUsed: 0,
        }),
      }),
    );
    expect(completion.status).toBe(200);

    // This route still wrote nothing of its own — the row above is the
    // completion route's.
    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S102: after the widening the 404 arm fires only for killed, unpublished and future", async () => {
    // ADR-0039 decision 3's 404 table, re-pinned: #31 narrowed its reachable
    // causes from four to three by deleting the route's lower bound, and the
    // wall is now the only lower authority.
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();
    const list = [answer.normalized];

    // Never published, 200 days back.
    const missing = await POST(
      guessRequest({ token, body: guessBody(addDays(today, -200), list) }),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "no-puzzle" });

    // Published in the future but dated in the past.
    const pendingDate = addDays(today, -100);
    await seedTermo(pendingDate, 11);
    await ctx.db
      .update(dailyPuzzles)
      .set({ publishedAt: sql`now() + interval '1 day'` })
      .where(eq(dailyPuzzles.date, pendingDate));
    const pending = await POST(
      guessRequest({ token, body: guessBody(pendingDate, list) }),
    );
    expect(pending.status).toBe(404);

    // Killed.
    const killedDate = addDays(today, -50);
    await seedTermo(killedDate, 13);
    await ctx.db
      .update(dailyPuzzles)
      .set({ killedAt: sql`now()` })
      .where(eq(dailyPuzzles.date, killedDate));
    const killed = await POST(
      guessRequest({ token, body: guessBody(killedDate, list) }),
    );
    expect(killed.status).toBe(404);

    // Future — refused in the ROUTE now, ahead of the wall.
    await seedTermo(addDays(today, 1), 17);
    const future = await POST(
      guessRequest({ token, body: guessBody(addDays(today, 1), list) }),
    );
    expect(future.status).toBe(404);

    expect(await completionRows()).toHaveLength(0);
  }, 30_000);
});
