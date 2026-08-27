import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

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
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const { postGuesses } = await freshClient();

    for (const body of [
      judgedBody({ tiles: [["absent"]] }),
      judgedBody({ status: "solved" }),

      judgedBody({ status: "playing" }),
      { not: "a judgement" },
      "definitely not json object",
    ]) {
      stubFetch(() => jsonResponse(200, body));

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

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "offline",
    });
  });

  it.each([500, 502, 503, 429])("HOLDS the turn on %i", async (status) => {
    //

    stubFetch(() => jsonResponse(status, { error: "nope" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
  });

  it("says `offline` on a 5xx when the browser itself reports no connection", async () => {
    stubFetch(() => jsonResponse(503, { error: "nope" }));
    const { postGuesses } = await freshClient();

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

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
    expect(guessCalls(fetchMock)).toHaveLength(3);
    expect(sessionCalls(fetchMock)).toHaveLength(2);
  });

  it("re-mints AGAIN for a later 401, once the first fresh identity worked", async () => {
    let phase = 0;
    const fetchMock = stubFetch(() => {
      phase += 1;

      return phase === 2 || phase === 4
        ? jsonResponse(200, judgedBody())
        : jsonResponse(401, { error: "no-session" });
    });
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toMatchObject({ kind: "judged" });
    expect(await postGuesses(DATE, GUESSES)).toMatchObject({ kind: "judged" });

    expect(guessCalls(fetchMock)).toHaveLength(4);
    expect(sessionCalls(fetchMock)).toHaveLength(3);
  });

  it("returns `not-in-list` for a 422 whose code is `invalid-guess`", async () => {
    stubFetch(() => jsonResponse(422, { error: "invalid-guess" }));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "rejected",
      reason: "not-in-list",
    });
  });

  it("returns `refused` for a 422 whose code is `board-closed`", async () => {
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
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = stubFetch(() => jsonResponse(200, judgedBody()));
    const { postGuesses } = await freshClient();

    expect(await postGuesses(DATE, GUESSES)).toEqual({
      kind: "held",
      reason: "server",
    });
    expect(guessCalls(fetchMock)).toHaveLength(0);
    expect(errors).toHaveBeenCalled();
  });

  it("refuses a body the request contract would not accept, without posting", async () => {
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
