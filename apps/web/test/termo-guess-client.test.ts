import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

/**
 * T-WEB-S83 (plan 022 §11.4, §14.5, ADR-0038, ADR-0039). The guess client is
 * a FOREGROUND awaited fetch in Termo's own module, not a queue: `sync.ts`
 * carries the completion and only the completion.
 *
 * The failure table is the whole test, row by row, and the routing matters
 * more than the copy: a HELD turn survives and is re-postable, a REJECTED one
 * is cleared without being consumed, and only a 422 whose body says
 * `invalid-guess` is the "não está na lista" case.
 */

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";
const GUESSES = ["cafes", "praga"] as const;
const ANSWER = "praga";

const TILES = {
  miss: ["absent", "present", "absent", "absent", "present"],
  win: ["correct", "correct", "correct", "correct", "correct"],
} as const;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function judgedBody(overrides: Record<string, unknown> = {}) {
  return {
    game: "termo",
    date: DATE,
    tiles: [[...TILES.miss], [...TILES.win]],
    status: "won",
    answer: ANSWER,
    ...overrides,
  };
}

/**
 * Fetch double that answers `/session` unconditionally and delegates every
 * `/termo/guess` call to `respond`, which receives the 1-based attempt number
 * so a test can change its mind between the 401 and the re-post.
 */
function stubFetch(
  respond: (attempt: number) => Response | Promise<Response> | never,
) {
  let attempt = 0;
  const fetchMock = vi.fn((...args: unknown[]) => {
    if (String(args[0]).endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }
    attempt += 1;
    try {
      return Promise.resolve(respond(attempt));
    } catch (error) {
      return Promise.reject(error instanceof Error ? error : new Error("nope"));
    }
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const guessCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter((call) =>
    String(call[0]).endsWith("/termo/guess"),
  );

const sessionCalls = (fetchMock: ReturnType<typeof stubFetch>) =>
  fetchMock.mock.calls.filter((call) => String(call[0]).endsWith("/session"));

/** Module state (the one-shot re-mint latch) is per-import. */
async function freshClient() {
  vi.resetModules();
  return await import("../src/termo/guess-client");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a judged turn (T-WEB-S83)", () => {
  it("posts the whole guess list and returns the parsed verdict", () => {
    // STATELESS by construction (ADR-0038 decision 1): the client posts every
    // guess every time, so a lost response costs a re-post rather than a turn.
    const fetchMock = stubFetch(() => jsonResponse(200, judgedBody()));

    return freshClient()
      .then(({ postGuesses }) => postGuesses(DATE, GUESSES))
      .then((outcome) => {
        expect(outcome).toEqual({
          kind: "judged",
          tiles: [[...TILES.miss], [...TILES.win]],
          status: "won",
          answer: ANSWER,
        });

        const init = z
          .strictObject({
            method: z.string(),
            credentials: z.string(),
            headers: z.record(z.string(), z.string()),
            body: z.string(),
          })
          .parse(guessCalls(fetchMock)[0]?.[1]);
        expect(init.method).toBe("POST");
        // The cookie IS the identity, and the JSON content type is what forces
        // the CORS preflight that makes the WEB_ORIGIN grant load-bearing.
        expect(init.credentials).toBe("include");
        expect(init.headers["Content-Type"]).toBe("application/json");
        expect(JSON.parse(init.body)).toEqual({
          game: "termo",
          date: DATE,
          guesses: [...GUESSES],
        });
      });
  });

  it("HOLDS the turn when a 200's body does not match the contract", async () => {
    // "Parsed, never cast" (CLAUDE.md). A live turn must survive a server
    // bug: a body the contract does not recognise is neither a verdict nor a
    // player error, so the turn is held and stays re-postable. `sync.ts`'s
    // own `completionResponseSchema.parse` in a try/catch is the precedent.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { postGuesses } = await freshClient();

    for (const body of [
      judgedBody({ tiles: [["absent"]] }),
      judgedBody({ status: "solved" }),
      // The contract's own refine: an answer on a board that is still open.
      judgedBody({ status: "playing" }),
      { not: "a judgement" },
      "definitely not json object",
    ]) {
      stubFetch(() => jsonResponse(200, body));
      expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
    }
    expect(errors).toHaveBeenCalled();
  });
});

describe("the failure table, row by row (T-WEB-S83)", () => {
  it("HOLDS the turn when the fetch itself rejects", async () => {
    stubFetch(() => {
      throw new TypeError("Failed to fetch");
    });
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
  });

  it.each([500, 502, 503, 429])("HOLDS the turn on %i", async (status) => {
    // 429 is HELD and never terminal: a rate limit is not a verdict, and
    // spending one of six turns on one would be the worst possible reading.
    stubFetch(() => jsonResponse(status, { error: "nope" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
  });

  it("re-mints ONCE on a 401 and re-posts silently", async () => {
    const fetchMock = stubFetch((attempt) =>
      attempt === 1
        ? jsonResponse(401, { error: "no-session" })
        : jsonResponse(200, judgedBody()),
    );
    const { postGuesses } = await freshClient();

    const outcome = await postGuesses(DATE, GUESSES);

    expect(outcome).toMatchObject({ kind: "judged", status: "won" });
    expect(guessCalls(fetchMock)).toHaveLength(2);
    // Exactly one FORCED mint. A loop here would hammer the api on a broken
    // origin, which is why the latch is per page load.
    expect(sessionCalls(fetchMock).length).toBeGreaterThanOrEqual(1);
  });

  it("HOLDS the turn on a SECOND 401, rather than looping", async () => {
    const fetchMock = stubFetch(() =>
      jsonResponse(401, { error: "no-session" }),
    );
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
    expect(guessCalls(fetchMock)).toHaveLength(2);

    // And the latch is per page load, not per call: the next turn does not
    // re-mint again.
    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
    expect(guessCalls(fetchMock)).toHaveLength(3);
  });

  it("returns `not-in-list` for a 422 whose code is `invalid-guess`", async () => {
    // The row §11.4 splits out, and the reason it is routing rather than
    // copy: this is the not-in-the-list case arriving from the SERVER, and it
    // is reachable in normal operation because apps/web and apps/api deploy
    // independently and ADR-0015 expects the validation list to be
    // regenerated. It is a PLAYER outcome, not a system fault.
    stubFetch(() => jsonResponse(422, { error: "invalid-guess" }));
    const { postGuesses } = await freshClient();

    // Asserted on the REASON and never on the copy — the copy is the screen's
    // job (ADR-0018).
    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "rejected",
      reason: "not-in-list",
    });
  });

  it("returns `refused` for a 422 carrying any other code", async () => {
    for (const error of ["guess-mismatch", "", "invalid-guesses"]) {
      stubFetch(() => jsonResponse(422, { error }));
      const { postGuesses } = await freshClient();
      expect(await postGuesses(DATE, GUESSES)).toEqual({
        kind: "rejected",
        reason: "refused",
      });
    }
  });

  it("returns `refused` for a 422 whose body cannot be read at all", async () => {
    stubFetch(() => new Response("<html>gateway</html>", { status: 422 }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "rejected",
      reason: "refused",
    });
  });

  it.each([400, 403, 415])(
    "returns `refused` on %i — the server never judged it",
    async (status) => {
      stubFetch(() => jsonResponse(status, { error: "invalid-body" }));
      const { postGuesses } = await freshClient();

      expect(await postGuesses(DATE, GUESSES)).toEqual({
        kind: "rejected",
        reason: "refused",
      });
    },
  );

  it("returns `gone` on 404 — the day is over", async () => {
    stubFetch(() => jsonResponse(404, { error: "no-puzzle" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "gone" });
  });
});

describe("the request is parsed before it leaves", () => {
  it("HOLDS the turn, and posts nothing, when the api origin is unset", async () => {
    // Loud, not silent: a relative "undefined/termo/guess" fetch would 404
    // against the web app itself and read as a dead day.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(() => jsonResponse(200, judgedBody()));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({ kind: "held" });
    expect(guessCalls(fetchMock)).toHaveLength(0);
    expect(errors).toHaveBeenCalled();
  });

  it("refuses a body the request contract would not accept, without posting", async () => {
    // The boundary rule runs in both directions (CLAUDE.md): a list that is
    // empty, over the bound, or not normalized cannot be fixed by retrying,
    // so it is `refused` rather than held — and no request is made.
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(() => jsonResponse(200, judgedBody()));
    const { postGuesses } = await freshClient();

    for (const guesses of [
      [],
      Array.from({ length: 7 }, () => "cafes"),
      ["CAFES"],
      ["caf"],
    ]) {
      expect(await postGuesses(DATE, guesses)).toEqual({
        kind: "rejected",
        reason: "refused",
      });
    }
    expect(guessCalls(fetchMock)).toHaveLength(0);
    expect(errors).toHaveBeenCalled();
  });
});
