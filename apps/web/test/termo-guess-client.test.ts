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
      // `server`, never `offline`: a body we cannot read is OUR defect, and
      // "sem conexão" would be a false claim about the player's network.
      expect(await postGuesses(DATE, GUESSES)).toEqual({
        kind: "held",
        reason: "server",
      });
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

    // The ONE branch that may claim "sem conexão": the fetch itself rejected.
    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "offline",
    });
  });

  it.each([500, 502, 503, 429])("HOLDS the turn on %i", async (status) => {
    // 429 is HELD and never terminal: a rate limit is not a verdict, and
    // spending one of six turns on one would be the worst possible reading.
    //
    // `reason: "server"` is the half T-WEB-S83 was missing (finding B-7): all
    // four of these used to resolve to the same `held` the screen answered
    // with "Sem conexão — a tentativa vai assim que a conexão voltar.", a
    // factual claim about the player's network that is false here and points
    // them at a fix that cannot help.
    stubFetch(() => jsonResponse(status, { error: "nope" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
  });

  it("says `offline` on a 5xx when the browser itself reports no connection", async () => {
    // `navigator.onLine` is trusted in ONE direction only — false is
    // reliable, true is not — so it can add the offline claim but never
    // remove it.
    stubFetch(() => jsonResponse(503, { error: "nope" }));
    const { postGuesses } = await freshClient();

    // An OWN property shadowing jsdom's prototype getter, removed again in
    // the `finally` — `vi.restoreAllMocks` does not reach a defineProperty.
    Object.defineProperty(navigator, "onLine", {
      configurable: true,
      get: () => false,
    });
    try {
      expect(await postGuesses(DATE, GUESSES)).toEqual({
        kind: "held",
        reason: "offline",
      });
    } finally {
      Reflect.deleteProperty(navigator, "onLine");
    }
    expect(navigator.onLine).toBe(true);
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

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
    expect(guessCalls(fetchMock)).toHaveLength(2);

    // And the latch holds across turns: the re-mint was never CONFIRMED — the
    // re-post 401ed too — so nothing arms a second one, and the next turn
    // posts once and holds. Minting one identity per failed turn is the
    // sequential form of the race finding B-1 removed.
    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
    expect(guessCalls(fetchMock)).toHaveLength(3);
    expect(sessionCalls(fetchMock)).toHaveLength(2);
  });

  it("re-mints AGAIN for a later 401, once the first fresh identity worked", async () => {
    // Finding B-2: the allowance used to be a module-level boolean that was
    // never reset, so the first spent re-mint was terminal for the page load
    // — a cookie expiring forty minutes in left the board held, `retry()`
    // re-posting and holding again, and only a reload cleared it.
    let phase = 0;
    const fetchMock = stubFetch(() => {
      phase += 1;
      // 401, re-post OK (the identity is confirmed), then 401 again.
      return phase === 2 || phase === 4
        ? jsonResponse(200, judgedBody())
        : jsonResponse(401, { error: "no-session" });
    });
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toMatchObject({ kind: "judged" });
    expect(await postGuesses(DATE, GUESSES)).toMatchObject({ kind: "judged" });

    // Two turns, two 401s, two re-mints — because the first one was seen to
    // work. Nothing here is a loop: each is one player action.
    expect(guessCalls(fetchMock)).toHaveLength(4);
    expect(sessionCalls(fetchMock)).toHaveLength(3);
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

  it("returns `refused` for a 422 whose code is `board-closed`", async () => {
    // The pinned wire contract's second 422, and it is the OPPOSITE kind of
    // thing from `invalid-guess`: the posted list continues past a winning
    // row, which is a client bug or tampering and never a player outcome. It
    // must not read as "não está na lista" — a desynced board would otherwise
    // be told a correct word is not in the dictionary (findings A-3/B-8).
    stubFetch(() => jsonResponse(422, { error: "board-closed" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "rejected",
      reason: "refused",
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

    // `server`: a misconfigured build is ours however good the connection is.
    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
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
