import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  completionRequestSchema,
  termoCompletionRequestSchema,
} from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  ELAPSED_CAP_MS,
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";

/**
 * T-WEB-S76 (plan 022 §14.2, ADR-0044 decisions 7-9). Termo's completion body
 * carries the guess WORDS, oldest first, and no verdict: the server re-judges
 * them against its stored answer and decides won or lost itself, which keeps
 * `outcome` off the one surface ADR-0026's rejected list calls forgeable.
 *
 * The TILES stay on the device — they are the client's rendering state, and
 * posting them would be a second place to lie about a fact the stored row
 * owns (ADR-0032 decision 4's argument for keeping `size` off the wire).
 */

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const GUESSES = ["cafes", "acoes"] as const;
/**
 * The canonical ACCENTED answer (ADR-0015). Deliberately the accented
 * spelling of the winning guess: it is five codepoints, it is what the
 * record stores, and it is a string no honest body may ever contain — the
 * wire is normalized, and the answer is not on the wire at all.
 */
const ANSWER = "ações";

function pendingTermoRecord(
  overrides: Partial<TermoPlayRecord> = {},
): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: GUESSES[0], tiles: [...MISS] },
      { guess: GUESSES[1], tiles: [...WIN] },
    ],
    answer: ANSWER,
    outcome: "won",
    elapsedMs: 188_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
    ...overrides,
  };
}

function pendingBinairoRecord(): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: Array.from({ length: 64 }, (_unused, index) =>
      index % 2 === 0 ? 0 : 1,
    ),
    elapsedMs: 272_000,
    hintsUsed: 1,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
  };
}

function pendingSudokuRecord(): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    grid: Array.from({ length: 9 }, () => DIGITS).flat(),
    elapsedMs: 411_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
  };
}

/** The exact `fetch` init the flush is expected to build. */
const requestInitSchema = z.strictObject({
  method: z.string(),
  credentials: z.string(),
  headers: z.record(z.string(), z.string()),
  body: z.string(),
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function okBody(game: string, overrides: Record<string, unknown> = {}) {
  return {
    game,
    date: DATE,
    outcome: "won",
    onTime: true,
    recorded: true,
    elapsedMs: 1_000,
    hintsUsed: 0,
    ...overrides,
  };
}

function stubFetch(respond: (url: string) => Response) {
  const fetchMock = vi.fn((...args: unknown[]) => {
    const url = String(args[0]);
    if (url.endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }
    return Promise.resolve(respond(url));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function completionBodies(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls
    .filter((call) => String(call[0]).endsWith("/completions"))
    .map((call) => {
      // Parsed against the request union, never cast: `JSON.parse` hands back
      // `any`, and a body that reached the wrong branch of `buildBody` fails
      // right here.
      const raw: unknown = JSON.parse(requestInitSchema.parse(call[1]).body);
      return completionRequestSchema.parse(raw);
    });
}

/** Module state (the in-flight guard, the re-mint latch) is per-import. */
async function freshSync() {
  vi.resetModules();
  return await import("../src/play/sync");
}

beforeEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("the termo completion body (T-WEB-S76)", () => {
  it("posts the guess WORDS, oldest first, and no verdict at all", async () => {
    writePlayRecord(pendingTermoRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody("termo")));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionBodies(fetchMock);
    expect(bodies).toHaveLength(1);
    expect(termoCompletionRequestSchema.parse(bodies[0])).toEqual({
      game: "termo",
      date: DATE,
      guesses: [...GUESSES],
      elapsedMs: 188_000,
      hintsUsed: 0,
    });
    // Neither the tiles nor the outcome cross the wire — the server
    // re-judges from the guess list and the stored answer (ADR-0044
    // decision 7). `strictObject` would have rejected either, but the
    // assertion is written out so a widened contract cannot pass silently.
    const raw = JSON.stringify(bodies[0]);
    expect(raw).not.toContain("tiles");
    expect(raw).not.toContain("outcome");
    expect(raw).not.toContain("correct");
    expect(raw).not.toContain("answer");
    expect(raw).not.toContain(ANSWER);
  });

  it("clamps `elapsedMs` at BOTH ends, on the memory-queue path too", async () => {
    // The two-sided clamp is not a restatement of the schema: `memoryQueue`
    // holds a record that never reached the store, so on the devices the
    // fallback exists for (DOM storage off) `buildBody` is the FIRST bound
    // this number meets. A backwards wall-clock step makes it negative and
    // the request contract's `min(0)` would then fail the parse, dropping an
    // intact completion (finding
    // `memory-queue-record-bypasses-the-two-sided-clamp`).
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new Error("DOM storage is disabled");
      },
    });
    try {
      const fetchMock = stubFetch(() => jsonResponse(200, okBody("termo")));
      const { flushPendingCompletions } = await freshSync();

      await flushPendingCompletions(pendingTermoRecord({ elapsedMs: -5 }));
      await flushPendingCompletions(
        pendingTermoRecord({
          date: "2026-07-29",
          elapsedMs: ELAPSED_CAP_MS * 3,
        }),
      );

      const bodies = completionBodies(fetchMock).map((body) =>
        termoCompletionRequestSchema.parse(body),
      );
      expect(bodies.map((body) => body.elapsedMs)).toEqual([0, ELAPSED_CAP_MS]);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("posts one record of EACH game, once each — termo beside the grids", async () => {
    // The queue is game-blind and this module is exactly one module
    // (ADR-0029): three records, three POSTs, each through its own branch of
    // `buildBody`.
    writePlayRecord(pendingBinairoRecord());
    writePlayRecord(pendingSudokuRecord());
    writePlayRecord(pendingTermoRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody("termo")));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionBodies(fetchMock);
    expect(bodies).toHaveLength(3);
    expect(bodies.map((body) => body.game).sort()).toEqual([
      "binairo",
      "sudoku",
      "termo",
    ]);
    expect(readPlayRecord("termo", DATE)?.pendingSync).toBe(false);
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(false);
    expect(readPlayRecord("sudoku", DATE)?.pendingSync).toBe(false);
  });

  it("keeps a six-guess LOSS a 200, never a rejected settle", async () => {
    // ADR-0044 decision 8 / the inversion §14.2 states in both halves: a loss
    // is a legitimately played Termo, so `TERMINAL_STATUSES.has(422)` must
    // never see it. A 422 here would render `conclusion.sync.rejected` on a
    // game the player really played, and #29's distribution would never get
    // its fail row.
    const guesses: TermoPlayRecord["guesses"] = "abcdef"
      .split("")
      .map((letter) => ({ guess: letter.repeat(5), tiles: [...MISS] }));
    writePlayRecord(pendingTermoRecord({ guesses, outcome: "lost" }));
    const fetchMock = stubFetch(() =>
      jsonResponse(200, okBody("termo", { outcome: "lost" })),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionBodies(fetchMock).map((body) =>
      termoCompletionRequestSchema.parse(body),
    );
    expect(bodies[0]?.guesses).toEqual(guesses.map((row) => row.guess));
    // `concluded: true` survives any sync outcome — for a grid game a
    // rejected completion leaves a solvable board, but for Termo it leaves a
    // SPENT one and there is no honest way to re-offer six guesses.
    expect(readPlayRecord("termo", DATE)).toMatchObject({
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });
});

/**
 * The source tripwire, re-asserted here rather than trusted: `buildBody`'s
 * `default` branch is what makes a fifth game a RED TYPECHECK instead of a
 * silently dropped completion. #27 is the ticket that fired it, so the
 * assertion has to survive the ticket that satisfied it.
 */
describe("the `never` tripwire survives the termo case", () => {
  it("still makes an unhandled game a compile error", () => {
    const source = readFileSync(
      path.join(
        path.dirname(fileURLToPath(import.meta.url)),
        "..",
        "src",
        "play",
        "sync.ts",
      ),
      "utf8",
    );

    expect(source).toMatch(
      /switch \(record\.game\)[\s\S]*?case "termo":[\s\S]*?default: \{[\s\S]*?const unhandled: never = record;/,
    );
  });
});
