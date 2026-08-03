import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { BinairoPlayRecord } from "../src/play/play-record";

/**
 * T-WEB-S105 (step-6 finding B-1). THE ONLY TEST IN THE SUITE THAT DRIVES
 * BOTH 401 RE-MINTERS AT ONE `/session`, and the reason it has to exist is
 * that neither module can see the defect alone.
 *
 * `session/bootstrap.ts` holds ONE module-level mint promise, and a forced
 * re-mint replaces it. `POST /session` mints a BRAND-NEW USER for any
 * cookieless request. So when `play/sync.ts` and `termo/guess-client.ts` each
 * guarded their own `reminted` boolean, a stale cookie plus one unsynced
 * completion plus a live Termo turn put two cookieless mints in flight at
 * once: two identities, the browser keeps whichever `Set-Cookie` lands last,
 * and the completion is written for the one that lost — write-once under
 * ADR-0026 decision 1, so a permanently lost streak day through the
 * identity-overwrite class ADR-0003 calls the worst failure there is.
 *
 * The `/session` response is DEFERRED here, deliberately: the two callers are
 * both parked on the re-mint before either is allowed to finish, which is the
 * interleaving the finding describes and the one an instantly-resolving stub
 * could reach only by luck.
 */

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

/** Let every already-queued microtask run, several rounds deep. */
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
        // The FIRST mint is the ordinary bootstrap and resolves at once; every
        // later one is a forced re-mint and is parked, so both callers are
        // inside it together before any of them is released.
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
      // Every authenticated call 401s, forever: this is the stale-cookie day.
      return Promise.resolve(jsonResponse(401, { error: "no-session" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    // ONE module graph, so both callers reach the SAME `session/bootstrap`.
    vi.resetModules();
    const { writePlayRecord } = await import("../src/play/play-record");
    const { flushPendingCompletions } = await import("../src/play/sync");
    const { postGuesses } = await import("../src/termo/guess-client");

    writePlayRecord(pendingRecord());

    const flush = flushPendingCompletions();
    const turn = postGuesses(DATE, GUESSES);
    await settle();

    // Both are now parked on the forced re-mint. ONE bootstrap plus ONE
    // re-mint: the number that must never come back is 3, which is what two
    // local `reminted` booleans produced.
    expect(sessionUrls).toHaveLength(2);

    held?.();
    const [, outcome] = await Promise.all([flush, turn]);

    // Still two after both settle, and the turn survived rather than being
    // spent on an identity problem.
    expect(sessionUrls).toHaveLength(2);
    expect(outcome).toEqual({ kind: "held", reason: "server" });
    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("/session"),
      ).length,
    ).toBe(2);
  });
});
