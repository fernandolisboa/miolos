import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchDayTruth } from "../src/day/day-client";

// The fetch-and-parse half of the day-truth read (#83, ADR-0060), tested
// without rendering — `streak-client.test.ts`'s register. This suite
// deliberately keeps the unset-env case (the bootstrap.ts guard parity),
// which every RENDERING suite must avoid by stubbing the env/fetch pair.

const API_URL = "https://api.example.test";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

const validBody = {
  date: "2026-08-19",
  games: {
    termo: "completed",
    sudoku: "pending",
    nonogram: "played",
    binairo: "pending",
  },
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchDayTruth (T-WEB-S234)", () => {
  it("parses a valid body against the strict contract, with credentials and no custom headers", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, validBody)),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchDayTruth()).toEqual(validBody);
    // A credentialed GET with no custom headers stays a CORS simple
    // request, so the read never preflights. No parameters either.
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/day`, {
      credentials: "include",
    });
  });

  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchDayTruth()).toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("answers undefined on 401, on 500 and on a network failure", async () => {
    for (const status of [401, 500]) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(status, { error: "x" }))),
      );
      expect(await fetchDayTruth(), String(status)).toBeUndefined();
    }

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    expect(await fetchDayTruth()).toBeUndefined();
  });

  it("answers undefined on a malformed 200 body — SILENTLY, and never a throw into the UI", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const malformed: readonly unknown[] = [
      { date: "2026-08-19" },
      { ...validBody, streak: 3 },
      {
        ...validBody,
        games: { ...validBody.games, xadrez: "pending" },
      },
      {
        date: "2026-08-19",
        games: { termo: "completed", sudoku: "pending", nonogram: "played" },
      },
      { ...validBody, games: { ...validBody.games, sudoku: "late" } },
      { ...validBody, date: "19/08/2026" },
      "not an object",
    ];
    for (const body of malformed) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchDayTruth(), JSON.stringify(body)).toBeUndefined();
    }
    // The parse failure is silent by choice, matching `streak-client.ts` and
    // `stats-client.ts`; only the env guard is loud, and it did not fire.
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
