import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

function fetchStub(): ReturnType<
  typeof vi.fn<(url: string, init: RequestInit) => Promise<Response>>
> {
  return vi.fn<(url: string, init: RequestInit) => Promise<Response>>(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  );
}

function postedBody(init: RequestInit): unknown {
  const { body } = init;
  expect(typeof body).toBe("string");
  return JSON.parse(typeof body === "string" ? body : "null");
}

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

    markSessionReady();
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("T-WEB-S316: a rejecting fetch, a never-resolving fetch and a synchronously throwing fetch all leave the caller untouched — the play path never blocks and never throws", async () => {
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

      await settle();
      expect(stub).toHaveBeenCalled();
    }
  });

  it("T-WEB-S317: the once-guard is per (game, date) — remounts of the same board post nothing more, a different date posts again", async () => {
    const fetchMock = fetchStub();
    vi.stubGlobal("fetch", fetchMock);
    const { markSessionReady, postPuzzleStarted } = await loadClient();
    markSessionReady();

    postPuzzleStarted("binairo", DATE);
    postPuzzleStarted("binairo", DATE);
    postPuzzleStarted("binairo", DATE);
    await settle();
    expect(fetchMock).toHaveBeenCalledTimes(1);

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

    const [url, init] = call ?? ["", {}];
    expect(url).toBe(`${API_URL}/telemetry`);
    expect(init.method).toBe("POST");
    expect(init.credentials).toBe("include");
    expect(init.keepalive).toBe(true);
    expect(init.headers).toEqual({ "content-type": "application/json" });

    expect(postedBody(init)).toEqual({
      event: "puzzle_started",
      properties: { game: "sudoku", date: DATE },
    });

    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const silent = vi.fn();
    vi.stubGlobal("fetch", silent);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const cold = await loadClient();
    cold.markSessionReady();
    cold.postPuzzleStarted("termo", DATE);
    cold.postPuzzleStarted("sudoku", DATE);
    await settle();
    expect(silent).not.toHaveBeenCalled();
    expect(
      errorSpy,
      "the relay warns once per page life, not once per send",
    ).toHaveBeenCalledTimes(1);
  });
});
