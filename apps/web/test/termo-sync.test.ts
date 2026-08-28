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

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

const GUESSES = ["cafes", "acoes"] as const;

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
      const raw: unknown = JSON.parse(requestInitSchema.parse(call[1]).body);
      return completionRequestSchema.parse(raw);
    });
}

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

    const raw = JSON.stringify(bodies[0]);
    expect(raw).not.toContain("tiles");
    expect(raw).not.toContain("outcome");
    expect(raw).not.toContain("correct");
    expect(raw).not.toContain("answer");
    expect(raw).not.toContain(ANSWER);
  });

  it("clamps `elapsedMs` at BOTH ends, on the memory-queue path too", async () => {
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

    expect(readPlayRecord("termo", DATE)).toMatchObject({
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });
});

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
