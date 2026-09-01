import { streakResponseSchema } from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiGet, apiPost, apiPostRaw } from "../src/api/client";
import { webCodeOf, webSources } from "./ts-source";

const API_URL = "https://api.example.test";

function modulesContaining(needle: string): string[] {
  return webSources()
    .filter((module) => webCodeOf(module).includes(needle))
    .map((module) => module.replace(/^src\//, ""))
    .sort();
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const ABSENCE_SITES: readonly (readonly [string, string])[] = [
  [
    "day/day-client.ts",
    "day fetch skipped, the hub keeps this device's own day state",
  ],
  [
    "streak/streak-client.ts",
    "streak fetch skipped, the hub keeps the zero state",
  ],
  [
    "medals/medals-client.ts",
    "medals fetch skipped, the screen keeps the zero state",
  ],
  [
    "stats/stats-client.ts",
    "stats fetch skipped, the screen keeps the zero state",
  ],
  [
    "stats/stats-client.ts",
    "stats calendar fetch skipped, the screen keeps the zero state",
  ],
  ["push/push-client.ts", "notification calls skipped, the card stays absent"],
  [
    "onboarding/onboarding-client.ts",
    "onboarding calls skipped, the card stays absent",
  ],
  ["attach/attach-client.ts", "attach calls skipped, the prompt stays absent"],
  [
    "termo/guess-client.ts",
    "the termo guess cannot be judged, the turn is held",
  ],
  [
    "play/sync.ts",
    "the completion sync cannot run, results stay queued on this device",
  ],
  [
    "session/bootstrap.ts",
    "session bootstrap skipped, no identity will be minted",
  ],
  ["telemetry/client.ts", "puzzle_started not reported, telemetry stays blind"],
];

describe("the one API client every credentialed request goes through (T-WEB-S363)", () => {
  it("all twelve absence clauses survive the move, each still in the module it describes", () => {
    for (const [module, absence] of ABSENCE_SITES) {
      expect(webCodeOf(`src/${module}`), `${module} — ${absence}`).toContain(
        absence,
      );
    }

    expect(
      new Set(ABSENCE_SITES.map(([, absence]) => absence)).size,
      "no two screens claim the same consequence",
    ).toBe(ABSENCE_SITES.length);

    expect(
      webCodeOf("src/api/client.ts"),
      "the prefix is single-sourced and the tails are not",
    ).toContain("`NEXT_PUBLIC_API_URL is unset: ${absence}`");
  });

  it("only the client and the telemetry relay still read the environment variable", () => {
    expect(modulesContaining("process.env.NEXT_PUBLIC_API_URL")).toEqual([
      "api/client.ts",
      "telemetry/client.ts",
    ]);
  });

  it("three modules build a credentialed request: the client, the mint and the telemetry relay", () => {
    expect(modulesContaining('credentials: "include"')).toEqual([
      "api/client.ts",
      "session/bootstrap.ts",
      "telemetry/client.ts",
    ]);
  });

  it("apiGet sends a bare credentialed GET and nothing else", async () => {
    const fetchMock = vi.fn(() =>
      Promise.resolve(jsonResponse(200, { current: 3, best: 5 })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await apiGet("/streak", streakResponseSchema, "unused");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${API_URL}/streak`);
    expect(init).toEqual({ credentials: "include" });
  });

  it("apiPostRaw sends exactly four options, and apiPost reads only the status off it", async () => {
    const fetchMock = vi.fn(() => Promise.resolve(jsonResponse(200, {})));
    vi.stubGlobal("fetch", fetchMock);

    await apiPostRaw("/attach/dismiss", { a: 1 }, "unused");

    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe(`${API_URL}/attach/dismiss`);
    expect(init).toEqual({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: '{"a":1}',
    });

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(null, { status: 204 }))),
    );
    expect(await apiPost("/attach/dismiss", {}, "unused")).toBe(true);

    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(jsonResponse(500, {}))),
    );
    expect(await apiPost("/attach/dismiss", {}, "unused")).toBe(false);
  });

  it("a missing URL logs the caller's own clause and reaches the network on no path", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(await apiGet("/streak", streakResponseSchema, "a tail")).toBe(
      undefined,
    );
    expect(await apiPostRaw("/x", {}, "another tail")).toBe(undefined);
    expect(await apiPost("/x", {}, "a third tail")).toBe(false);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy.mock.calls.map((call) => String(call[0]))).toEqual([
      "NEXT_PUBLIC_API_URL is unset: a tail",
      "NEXT_PUBLIC_API_URL is unset: another tail",
      "NEXT_PUBLIC_API_URL is unset: a third tail",
    ]);
  });

  it("the client reaches no session module — the mint ordering stays where ADR-0072 put it", () => {
    const client = webCodeOf("src/api/client.ts");
    expect(client).not.toContain("session/bootstrap");
    expect(client).not.toContain("ensureSession");
    expect(
      client,
      "not a component, so no client boundary marker",
    ).not.toContain('"use client"');
  });
});
