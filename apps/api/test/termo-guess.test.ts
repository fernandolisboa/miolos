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

import { POST as completionsPost } from "../app/completions/route";
import { OPTIONS, POST } from "../app/termo/guess/route";
import { addDays } from "../src/publishing/dates";
import { SESSION_COOKIE_NAME } from "../src/session/cookie";
import { generateSessionToken, hashSessionToken } from "../src/session/token";

let ctx: Awaited<ReturnType<typeof createTestDb>>;

const { getDbCalls } = vi.hoisted(() => ({ getDbCalls: vi.fn() }));

vi.mock("../src/db", () => ({
  getDb: () => {
    getDbCalls();
    return ctx.db;
  },
}));

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

const ANSWER: TermoAnswer | undefined = TERMO_ANSWERS.find(
  (answer) => answer.canonical !== answer.normalized,
);

if (ANSWER === undefined) {
  throw new Error("unreachable: no accented answer in TERMO_ANSWERS");
}
const answer: TermoAnswer = ANSWER;

const DECOYS: readonly string[] = TERMO_ANSWERS.map((a) => a.normalized)
  .filter((word) => word !== answer.normalized)
  .slice(0, 6);

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

async function rawBody(response: Response): Promise<Record<string, unknown>> {
  const parsed: unknown = await response.json();
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("the route answered with a non-object body");
  }
  return parsed as Record<string, unknown>;
}

describe("POST /termo/guess", () => {
  it("T-API-S36: the decoys really are dictionary words and the answer really is one", () => {
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

    expect("answer" in raw).toBe(false);
    const body = termoGuessResponseSchema.parse(raw);
    expect(body.status).toBe("playing");
    expect(body.date).toBe(today);
    expect(body.tiles).toHaveLength(3);

    for (const [index, guess] of guesses.entries()) {
      const row = body.tiles[index];
      expect(row).toBeDefined();
      for (const [position, tile] of (row ?? []).entries()) {
        const expected =
          guess.charAt(position) === answer.normalized.charAt(position)
            ? "correct"
            : answer.normalized.includes(guess.charAt(position))
              ? tile
              : "absent";
        expect(tile).toBe(expected);
      }
    }

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

    const archived = await POST(
      guessRequest({ token, body: guessBody(twoDaysAgo, list) }),
    );
    expect(archived.status).toBe(200);

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
    const today = await todaySaoPaulo(ctx.db);
    await seedTermo(today);
    const { token } = await createSession();

    const responses = [
      await POST(guessRequest({ body: guessBody(today, [NOT_A_WORD]) })),
      await POST(
        guessRequest({
          token,
          secFetchSite: "cross-site",
          body: guessBody(today, [NOT_A_WORD]),
        }),
      ),
      await POST(
        guessRequest({ token, body: guessBody(today, []), contentType: null }),
      ),
      await POST(guessRequest({ token, body: "{not json" })),
      await POST(
        guessRequest({
          token,
          body: guessBody(addDays(today, 5), [NOT_A_WORD]),
        }),
      ),
      await POST(guessRequest({ token, body: guessBody(today, [NOT_A_WORD]) })),
      await POST(
        guessRequest({ token, body: guessBody(today, [answer.normalized]) }),
      ),
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
    const today = await todaySaoPaulo(ctx.db);
    const archived = addDays(today, -90);
    await seedTermo(archived);
    const { token } = await createSession();

    const playing = await POST(
      guessRequest({ token, body: guessBody(archived, DECOYS.slice(0, 3)) }),
    );
    expect(playing.status).toBe(200);
    const playingBody = termoGuessResponseSchema.parse(await playing.json());
    expect(playingBody.status).toBe("playing");
    expect(playingBody.tiles).toHaveLength(3);

    const won = await POST(
      guessRequest({
        token,
        body: guessBody(archived, [...DECOYS.slice(0, 2), answer.normalized]),
      }),
    );
    expect(termoGuessResponseSchema.parse(await won.json()).status).toBe("won");

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

    expect(await completionRows()).toHaveLength(1);
  }, 30_000);

  it("T-API-S102: after the widening the 404 arm fires only for killed, unpublished and future", async () => {
    const today = await todaySaoPaulo(ctx.db);
    const { token } = await createSession();
    const list = [answer.normalized];

    const missing = await POST(
      guessRequest({ token, body: guessBody(addDays(today, -200), list) }),
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "no-puzzle" });

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

    await seedTermo(addDays(today, 1), 17);
    const future = await POST(
      guessRequest({ token, body: guessBody(addDays(today, 1), list) }),
    );
    expect(future.status).toBe(404);

    expect(await completionRows()).toHaveLength(0);
  }, 30_000);
});
