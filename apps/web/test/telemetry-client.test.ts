import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The client half of the telemetry relay (#33, ADR-0069 decision 2), tested
 * without rendering — the `streak-client.test.ts` shape.
 *
 * EVERY CASE RE-IMPORTS THE MODULE after `vi.resetModules()`. The session
 * gate, the buffer and the once-guard are module-level by design (they must
 * survive every remount of a play screen in one page load), so a shared
 * import would leak one case's fired set into the next — the
 * `session-remint.test.ts` discipline, for the same reason.
 */

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

/**
 * A `fetch` stub whose PARAMETERS are typed, so `mock.calls[n]` is a real
 * tuple rather than `[]` — a bare `vi.fn(() => …)` records a zero-arity
 * signature and every read of the init object needs a cast the checker is
 * right to refuse.
 */
function fetchStub(): ReturnType<
  typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>
> {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
}

/**
 * The posted JSON. `RequestInit["body"]` is a `BodyInit | null | undefined`
 * union, so a bare `String(init.body)` is a lint error waiting for the day
 * the module sends a `Blob` — the narrowing below IS the assertion that it
 * does not.
 */
function postedBody(init: RequestInit): unknown {
  const { body } = init;
  expect(typeof body).toBe("string");
  return JSON.parse(typeof body === "string" ? body : "null");
}

/** Let every already-queued microtask run, several rounds deep. */
async function settle(): Promise<void> {
  for (let round = 0; round < 20; round += 1) {
    await Promise.resolve();
  }
}

async function loadClient(): Promise<typeof import("../src/telemetry/client")> {
  vi.resetModules();
  return import("../src/telemetry/client");
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("the puzzle_started relay client", () => {
  it("T-WEB-S315: nothing is posted until the session mint settles, and the buffered starts then flush in call order", async () => {
    // The cold-first-visit case, and the reason the buffer exists: POST
    // /telemetry answers a cookieless request with a 204 drop, so an ungated
    // fire would lose the puzzle_started of every first-ever visit — exactly
    // the population the event exists to measure.
    const fetchMock = fetchStub();
    vi.stubGlobal("fetch", fetchMock);
    const { markSessionReady, postPuzzleStarted } = await loadClient();

    postPuzzleStarted("binairo", DATE);
    postPuzzleStarted("sudoku", DATE);
    await settle();
    expect(fetchMock).not.toHaveBeenCalled();

    markSessionReady();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const games = fetchMock.mock.calls.map(
      ([, init]) =>
        (postedBody(init) as { properties: { game: string } }).properties.game,
    );
    expect(games).toEqual(["binairo", "sudoku"]);

    // Drain-once: a second flip finds an empty buffer rather than re-posting.
    markSessionReady();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("T-WEB-S316: a rejecting fetch, a never-resolving fetch and a synchronously throwing fetch all leave the caller untouched — the play path never blocks and never throws", async () => {
    // The "no blocking requests on the play path" pin (plan 064's gate
    // section): `postPuzzleStarted` returns `void` SYNCHRONOUSLY on all
    // three, so a mount effect can neither await it nor be broken by it.
    for (const stub of [
      vi.fn(() => Promise.reject(new Error("offline"))),
      vi.fn(() => new Promise<Response>(() => undefined)),
      vi.fn(() => {
        throw new Error("fetch replaced by a hostile extension");
      }),
    ]) {
      vi.stubGlobal("fetch", stub);
      const { markSessionReady, postPuzzleStarted } = await loadClient();
      markSessionReady();

      expect(() => postPuzzleStarted("nonogram", DATE)).not.toThrow();
      expect(postPuzzleStarted("termo", DATE)).toBeUndefined();
      // No unhandled rejection escapes: the `.catch` inside `send` owns the
      // rejecting arm, the `try` owns the synchronous one.
      await settle();
      expect(stub).toHaveBeenCalled();
    }
  });

  it("T-WEB-S317: the once-guard is per (game, date) — remounts of the same board post nothing more, a different date posts again", async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal("fetch", fetchMock);
    const { markSessionReady, postPuzzleStarted } = await loadClient();
    markSessionReady();

    // StrictMode's double effect, a visibility remount, a client-side
    // navigation back to the same board: one attempt, not three.
    postPuzzleStarted("binairo", DATE);
    postPuzzleStarted("binairo", DATE);
    postPuzzleStarted("binairo", DATE);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // The archive makes the date a real dimension: yesterday's board is a
    // different start, and so is the same date on another game.
    postPuzzleStarted("binairo", "2026-07-29");
    postPuzzleStarted("sudoku", DATE);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("T-WEB-S318: the request is the relay contract — credentialed keepalive POST to /telemetry, the event literal and the two client-known properties, no archive claim; an unset API url logs loudly and posts nothing", async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal("fetch", fetchMock);
    const { markSessionReady, postPuzzleStarted } = await loadClient();
    markSessionReady();
    postPuzzleStarted("sudoku", DATE);
    await settle();

    const call = fetchMock.mock.calls[0];
    // The `??` is `noUncheckedIndexedAccess`'s price, not a real branch: the
    // assertion two lines up already proved the call happened.
    const [url, init] = call ?? ["", {}];
    expect(url).toBe(`${API_URL}/telemetry`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "content-type": "application/json" });
    // `archive` is DERIVED server-side against the DB clock's São Paulo
    // today — the client asserts nothing about it (ADR-0069 decision 2).
    expect(postedBody(init)).toEqual({
      event: "puzzle_started",
      properties: { game: "sudoku", date: DATE },
    });

    // The bootstrap.ts guard parity: without the var the fetch would hit the
    // relative URL "undefined/telemetry" and the catch would swallow the
    // misconfiguration forever.
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const silent = vi.fn();
    vi.stubGlobal("fetch", silent);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cold = await loadClient();
    cold.markSessionReady();
    cold.postPuzzleStarted("termo", DATE);
    await settle();
    expect(silent).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});
