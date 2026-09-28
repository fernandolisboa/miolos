import {
  completionRequestSchema,
  crosswordCompletionRequestSchema,
} from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  crosswordPlayRecordSchema,
  readPlayRecord,
  writePlayRecord,
  type CrosswordPlayRecord,
} from "../src/play/play-record";

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

const SOLVED_GRID: NonNullable<CrosswordPlayRecord["grid"]> = Array.from(
  { length: 25 },
  (_unused, index) => (index % 5 === 4 ? null : "a"),
);

function pendingCrosswordRecord(
  overrides: Partial<CrosswordPlayRecord> = {},
): CrosswordPlayRecord {
  return {
    v: 1,
    game: "crossword",
    date: DATE,
    entries: SOLVED_GRID,
    grid: SOLVED_GRID,
    elapsedMs: 301_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
    ...overrides,
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

function okBody(overrides: Record<string, unknown> = {}) {
  return {
    game: "crossword",
    date: DATE,
    outcome: "won",
    onTime: true,
    recorded: true,
    elapsedMs: 301_000,
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

describe("the record schema accepts blocks (null) but never a digit or an accent (T-WEB-S418)", () => {
  it("accepts a 25-cell grid of lowercase letters and nulls", () => {
    expect(
      crosswordPlayRecordSchema.safeParse(pendingCrosswordRecord()).success,
    ).toBe(true);
  });

  it("rejects a 24-cell entries array", () => {
    const record = pendingCrosswordRecord({ entries: SOLVED_GRID.slice(1) });
    expect(crosswordPlayRecordSchema.safeParse(record).success).toBe(false);
  });

  it("rejects an uppercase or accented letter", () => {
    for (const bad of ["A", "ç", "1"]) {
      const record = pendingCrosswordRecord({
        entries: [bad, ...SOLVED_GRID.slice(1)],
      });
      expect(crosswordPlayRecordSchema.safeParse(record).success, bad).toBe(
        false,
      );
    }
  });
});

describe("the crossword completion body (T-WEB-S418)", () => {
  it("posts the solved grid, blocks included as null, with no seed and no clues", async () => {
    writePlayRecord(pendingCrosswordRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionBodies(fetchMock);
    expect(bodies).toHaveLength(1);
    const parsed = crosswordCompletionRequestSchema.parse(bodies[0]);
    expect(parsed).toEqual({
      game: "crossword",
      date: DATE,
      grid: SOLVED_GRID,
      elapsedMs: 301_000,
      hintsUsed: 0,
    });
    expect(Object.keys(parsed).sort()).toEqual(
      ["date", "elapsedMs", "game", "grid", "hintsUsed"].sort(),
    );
  });

  it("clears the queue on 200 and records the outcome", async () => {
    writePlayRecord(pendingCrosswordRecord());
    stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord("crossword", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });

  it("drops an unbuildable pending record instead of retrying it forever", async () => {
    writePlayRecord(pendingCrosswordRecord({ grid: undefined }));
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(
      fetchMock.mock.calls.filter((call) =>
        String(call[0]).endsWith("/completions"),
      ),
    ).toHaveLength(0);
    expect(readPlayRecord("crossword", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "rejected",
    });
    errorSpy.mockRestore();
  });
});
