import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fetchMedals } from "../src/medals/medals-client";

// The fetch-and-parse half of the medals read (#30, ADR-0052), tested
// without rendering — the streak-client suite's shape. This suite
// deliberately keeps the unset-env case — the bootstrap.ts guard parity —
// which every RENDERING suite must avoid by mocking the client module.
// Every stubbed fetch hands out a FRESH Response per call (the shared-
// Response poisoning trap: a Response body reads once).

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

describe("fetchMedals (T-WEB-S160)", () => {
  it("logs loudly and fetches nothing when NEXT_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await fetchMedals()).toBeUndefined();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("parses a valid body against the strict contract — a shape-valid UNKNOWN id included, which PASSES (the skew posture)", async () => {
    // "some-future-medal" is not in the bundled catalog: ids are validated
    // by SHAPE, never enum (ADR-0052), so catalog growth is additive and
    // the drop happens at render, not here.
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          jsonResponse(200, {
            medals: ["first-win", "streak-7", "some-future-medal"],
          }),
        ),
      ),
    );

    expect(await fetchMedals()).toEqual({
      medals: ["first-win", "streak-7", "some-future-medal"],
    });
  });

  it("answers undefined on a malformed 200 body — never a throw into the UI", async () => {
    const malformed: readonly unknown[] = [
      {},
      { medals: ["Not-A-Slug"] },
      { medals: ["first-win", "first-win"] },
      { medals: ["first-win"], extra: 1 },
      { medals: "first-win" },
      "not an object",
    ];
    for (const body of malformed) {
      vi.stubGlobal(
        "fetch",
        vi.fn(() => Promise.resolve(jsonResponse(200, body))),
      );
      expect(await fetchMedals(), JSON.stringify(body)).toBeUndefined();
    }
  });

  it("answers undefined on a non-200 and on a network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(401, { error: "no-session" }))),
    );
    expect(await fetchMedals()).toBeUndefined();

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new TypeError("network down"))),
    );
    expect(await fetchMedals()).toBeUndefined();
  });
});
