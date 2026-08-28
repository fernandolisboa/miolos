import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchStreak } from "../src/streak/streak-client";

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

describe("fetchStreak (T-WEB-S126)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchStreak()).toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("parses a valid body against the strict contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            date: "2026-07-31",
            streak: 7,
            todayCounts: false,
          }),
        ),
      ),
    );

    expect(await fetchStreak()).toEqual({
      date: "2026-07-31",
      streak: 7,
      todayCounts: false,
    });
  });

  it("answers undefined on a malformed 200 body — never a throw into the UI", async () => {
    const malformed: readonly unknown[] = [
      { streak: 7 },
      { date: "2026-07-31", streak: -1, todayCounts: false },
      { date: "2026-07-31", streak: 7, todayCounts: false, extra: 1 },
      "not an object",
    ];
    for (const body of malformed) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchStreak(), JSON.stringify(body)).toBeUndefined();
    }
  });

  it("answers undefined on a non-200 and on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(401, { error: "no-session" }))),
    );
    expect(await fetchStreak()).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    expect(await fetchStreak()).toBeUndefined();
  });
});
