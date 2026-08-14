import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchStats, fetchStatsCalendar } from "../src/stats/stats-client";

// The fetch-and-parse half of the two stats reads (#29, plan 033 §6.1),
// tested without rendering — the streak-client suite's shape. This suite
// deliberately keeps the unset-env case — the bootstrap.ts guard parity —
// which every RENDERING suite must avoid by stubbing the pair.

/** A minimal body the strict stats contract accepts. */
function statsBody(): Record<string, unknown> {
  const timed = {
    solved: 0,
    bestMs: null,
    averageMs: null,
    averageSampleCount: 0,
    histogram: [0, 0, 0, 0, 0, 0],
  };
  return {
    date: "2026-08-13",
    binairo: timed,
    sudoku: {
      solved: 2,
      bestMs: 238_000,
      averageMs: 301_000,
      averageSampleCount: 2,
      histogram: [1, 0, 1, 0, 0, 0],
    },
    nonogram: timed,
    termo: { solved: 1, distribution: [0, 0, 0, 1, 0, 0, 0] },
    perfectDays: 0,
    todayTermoGuesses: 4,
  };
}

/** A minimal body the strict calendar contract accepts. */
function calendarBody(): Record<string, unknown> {
  return {
    days: [
      { date: "2026-08-12", state: "missed", perfect: false },
      { date: "2026-08-13", state: "onTime", perfect: false },
    ],
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("fetchStats and fetchStatsCalendar (T-WEB-S158)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchStats()).toBeUndefined();
    expect(await fetchStatsCalendar()).toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(2);
  });

  it("parses a valid /stats body against the strict contract, at the /stats URL", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, statsBody())),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchStats()).toEqual(statsBody());
    expect(fetchMock).toHaveBeenCalledWith("https://api.example.test/stats", {
      credentials: "include",
    });
  });

  it("parses a valid /stats/calendar body against the strict contract, at its own URL", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, calendarBody())),
    );
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchStatsCalendar()).toEqual(calendarBody());
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.example.test/stats/calendar",
      { credentials: "include" },
    );
  });

  it("answers undefined on a malformed 200 body — never a throw into the UI", async () => {
    const malformedStats: readonly unknown[] = [
      { ...statsBody(), extra: 1 },
      { ...statsBody(), todayTermoGuesses: 7 },
      { ...statsBody(), termo: { solved: 1, distribution: [0, 0, 0] } },
      "not an object",
    ];
    for (const body of malformedStats) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchStats(), JSON.stringify(body)).toBeUndefined();
    }

    const malformedCalendar: readonly unknown[] = [
      { days: [] },
      { ...calendarBody(), since: "2026-08-01" },
      {
        days: [{ date: "2026-08-13", state: "unknown", perfect: false }],
      },
      "not an object",
    ];
    for (const body of malformedCalendar) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchStatsCalendar(), JSON.stringify(body)).toBeUndefined();
    }
  });

  it("answers undefined on a non-200 and on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(401, { error: "no-session" }))),
    );
    expect(await fetchStats()).toBeUndefined();
    expect(await fetchStatsCalendar()).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    expect(await fetchStats()).toBeUndefined();
    expect(await fetchStatsCalendar()).toBeUndefined();
  });
});
