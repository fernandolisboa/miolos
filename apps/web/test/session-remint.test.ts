import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BinairoPlayRecord } from "../src/play/play-record";

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";
const GUESSES = ["cafes"] as const;

const SOLVED_GRID: NonNullable<BinairoPlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

function pendingRecord(): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: SOLVED_GRID.map((value) => value),
    grid: SOLVED_GRID,
    elapsedMs: 91_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
  };
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function settle(): Promise<void> {
  for (let round = 0; round < 50; round += 1) {
    await Promise.resolve();
  }
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("one page load mints one identity, however many callers ask (T-WEB-S105)", () => {
  it("makes exactly ONE forced `POST /session` for a completion flush and a Termo turn racing on 401", async () => {
    const sessionUrls: string[] = [];
    let held: (() => void) | undefined;

    const fetchMock = vi.fn((...args: unknown[]) => {
      const url = String(args[0]);
      if (url.endsWith("/session")) {
        sessionUrls.push(url);
        const body = jsonResponse(200, {
          userId: crypto.randomUUID(),
          created: true,
        });

        if (sessionUrls.length === 1) {
          return Promise.resolve(body);
        }
        return new Promise<Response>((resolve) => {
          const earlier = held;
          held = () => {
            earlier?.();
            resolve(body);
          };
        });
      }

      return Promise.resolve(jsonResponse(401, { error: "no-session" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { writePlayRecord } = await import("../src/play/play-record");
    const { flushPendingCompletions } = await import("../src/play/sync");
    const { postGuesses } = await import("../src/termo/guess-client");

    writePlayRecord(pendingRecord());

    const flush = flushPendingCompletions();
    const turn = postGuesses(DATE, GUESSES);
    await settle();

    expect(sessionUrls).toHaveLength(2);

    held?.();
    const [, outcome] = await Promise.all([flush, turn]);

    expect(sessionUrls).toHaveLength(2);
    expect(outcome).toEqual({ kind: "held", reason: "server" });
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("/session"),
      ).length,
    ).toBe(2);
  });
});

describe("a re-mint the server refused spends nothing (T-WEB-S108)", () => {
  it("re-arms the allowance after a failed mint, and burns it on a successful one", async () => {
    //

    const sessionCalls: number[] = [];

    const script = [200, 500, 200];

    const fetchMock = vi.fn((...args: unknown[]) => {
      const url = String(args[0]);
      if (url.endsWith("/session")) {
        const status = script[sessionCalls.length] ?? 200;
        sessionCalls.push(status);
        return Promise.resolve(
          status === 200
            ? jsonResponse(200, { userId: crypto.randomUUID(), created: true })
            : jsonResponse(status, { error: "boom" }),
        );
      }

      return Promise.resolve(jsonResponse(401, { error: "no-session" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { postGuesses } = await import("../src/termo/guess-client");

    const held = { kind: "held", reason: "server" };

    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(sessionCalls).toEqual([200, 500]);

    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(sessionCalls).toEqual([200, 500, 200]);

    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(sessionCalls).toEqual([200, 500, 200]);
  });

  it("does NOT re-arm on a 200 whose body the contract refuses — that one minted", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const sessionCalls: string[] = [];

    const fetchMock = vi.fn((...args: unknown[]) => {
      const url = String(args[0]);
      if (url.endsWith("/session")) {
        const first = sessionCalls.length === 0;
        sessionCalls.push(first ? "well-formed" : "malformed");
        return Promise.resolve(
          first
            ? jsonResponse(200, { userId: crypto.randomUUID(), created: true })
            : jsonResponse(200, { userId: 17 }),
        );
      }
      return Promise.resolve(jsonResponse(401, { error: "no-session" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    vi.resetModules();
    const { postGuesses } = await import("../src/termo/guess-client");

    const held = { kind: "held", reason: "server" };

    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(sessionCalls).toEqual(["well-formed", "malformed"]);

    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(await postGuesses(DATE, GUESSES)).toEqual(held);
    expect(sessionCalls).toEqual(["well-formed", "malformed"]);

    expect(
      errors.mock.calls.some((call) =>
        String(call[0]).includes("the contract has drifted"),
      ),
    ).toBe(true);
  });
});
