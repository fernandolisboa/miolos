import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  binairoCompletionRequestSchema,
  completionRequestSchema,
  nonogramCompletionRequestSchema,
  sudokuCompletionRequestSchema,
} from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

const SOLVED_GRID: NonNullable<BinairoPlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SOLVED_DIGITS: NonNullable<SudokuPlayRecord["grid"]> = Array.from(
  { length: 9 },
  () => DIGITS,
).flat();

const SUBMITTED_PICTURE: NonNullable<NonogramPlayRecord["grid"]> = Array.from(
  { length: 25 },
  (_unused, index) => (index % 6 === 0 ? 1 : 0),
);

function pendingNonogramRecord(): NonogramPlayRecord {
  return {
    v: 1,
    game: "nonogram",
    date: DATE,
    size: 5,
    entries: Array.from({ length: 25 }, (_unused, index) =>
      index % 6 === 0 ? 1 : null,
    ),
    grid: SUBMITTED_PICTURE,
    elapsedMs: 133_000,
    hintsUsed: 0,
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
    grid: SOLVED_DIGITS,
    elapsedMs: 411_000,
    hintsUsed: 0,
    concluded: true,
    pendingSync: true,
    syncOutcome: "pending",
  };
}

function pendingRecord(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    grid: SOLVED_GRID,
    elapsedMs: 272_000,
    hintsUsed: 1,
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
    game: "binairo",
    date: DATE,
    outcome: "won",
    onTime: true,
    recorded: true,
    elapsedMs: 272_000,
    hintsUsed: 1,
    ...overrides,
  };
}

function stubFetch(respond: (attempt: number) => Response | Promise<Response>) {
  let attempt = 0;
  const fetchMock = vi.fn((...args: unknown[]) => {
    if (String(args[0]).endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }
    attempt += 1;
    return Promise.resolve(respond(attempt));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function completionCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).endsWith("/completions"),
  );
}

function sessionCalls(fetchMock: ReturnType<typeof stubFetch>) {
  return fetchMock.mock.calls.filter((call) =>
    String(call[0]).endsWith("/session"),
  );
}

async function freshSync() {
  vi.resetModules();
  return await import("../src/play/sync");
}

async function settle() {
  for (let turn = 0; turn < 6; turn += 1) {
    await new Promise((resolve) => setImmediate(resolve));
  }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("flushPendingCompletions", () => {
  it("posts a body built from the record's solved grid alone", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const [call] = completionCalls(fetchMock);
    expect(call).toBeDefined();
    expect(String(call?.[0])).toBe(`${API_URL}/completions`);

    const init = requestInitSchema.parse(call?.[1]);
    expect(init).toEqual({
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: init.body,
    });

    const parsed = binairoCompletionRequestSchema.parse(JSON.parse(init.body));
    expect(parsed).toEqual({
      game: "binairo",
      date: DATE,
      grid: SOLVED_GRID,
      elapsedMs: 272_000,
      hintsUsed: 1,
    });
  });

  it("mints the session before the first POST, so a fast solve never races it", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(sessionCalls(fetchMock)).toHaveLength(1);
    const order = fetchMock.mock.calls.map((call) =>
      String(call[0]).endsWith("/session") ? "session" : "completions",
    );
    expect(order).toEqual(["session", "completions"]);
  });

  it("clears the queue on 200 and records the outcome", async () => {
    writePlayRecord(pendingRecord());
    stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });

  it("writes the server's stored statistics back on recorded: false", async () => {
    writePlayRecord(pendingRecord());
    stubFetch(() =>
      jsonResponse(
        200,
        okBody({ recorded: false, elapsedMs: 195_000, hintsUsed: 0 }),
      ),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      elapsedMs: 195_000,
      hintsUsed: 0,
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });

  it("keeps the record pending when the network fails", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = vi.fn((input: unknown) =>
      String(input).endsWith("/session")
        ? Promise.resolve(
            jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
          )
        : Promise.reject(new TypeError("offline")),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: true,
      syncOutcome: "pending",
    });
  });

  it("posts once when two triggers fire concurrently", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await Promise.all([flushPendingCompletions(), flushPendingCompletions()]);

    expect(completionCalls(fetchMock)).toHaveLength(1);
  });

  it("posts a completion handed to a flush that was already running (T-WEB-S61)", async () => {
    vi.useFakeTimers();
    writePlayRecord(pendingRecord());

    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
      release = () => {
        resolve();
      };
    });
    let call = 0;
    const fetchMock = vi.fn(async (input: unknown) => {
      if (String(input).endsWith("/session")) {
        return jsonResponse(200, {
          userId: crypto.randomUUID(),
          created: true,
        });
      }
      call += 1;

      if (call === 1) {
        await held;
        return jsonResponse(200, okBody());
      }
      return jsonResponse(200, okBody({ game: "nonogram" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { flushPendingCompletions } = await freshSync();
    const inFlight = flushPendingCompletions();
    await vi.advanceTimersByTimeAsync(0);
    expect(completionCalls(fetchMock)).toHaveLength(1);

    const nonogram = pendingNonogramRecord();
    writePlayRecord(nonogram);
    await flushPendingCompletions(nonogram);
    expect(completionCalls(fetchMock)).toHaveLength(1);

    release();
    await inFlight;
    await vi.advanceTimersByTimeAsync(0);
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(false);

    await vi.advanceTimersByTimeAsync(2_000);
    const posted = completionCalls(fetchMock).map((entry) => {
      const init = requestInitSchema.parse(entry[1]);
      return z.object({ game: z.string() }).parse(JSON.parse(init.body)).game;
    });
    expect(posted).toEqual(["binairo", "nonogram"]);
    expect(readPlayRecord("nonogram", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });

  it("posts the completion it was handed even with no usable localStorage", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("access denied", "SecurityError");
      },
    });
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    try {
      const { flushPendingCompletions } = await freshSync();
      await flushPendingCompletions(pendingRecord());

      const [call] = completionCalls(fetchMock);
      expect(call).toBeDefined();
      const init = requestInitSchema.parse(call?.[1]);
      expect(
        binairoCompletionRequestSchema.parse(JSON.parse(init.body)),
      ).toEqual({
        game: "binairo",
        date: DATE,
        grid: SOLVED_GRID,
        elapsedMs: 272_000,
        hintsUsed: 1,
      });

      await flushPendingCompletions();
      expect(completionCalls(fetchMock)).toHaveLength(1);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("clamps a backwards clock step on the memory-queue path too", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("access denied", "SecurityError");
      },
    });
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    try {
      const { flushPendingCompletions } = await freshSync();

      await flushPendingCompletions(pendingRecord({ elapsedMs: -3_600_000 }));

      const [call] = completionCalls(fetchMock);
      expect(call).toBeDefined();
      const init = requestInitSchema.parse(call?.[1]);
      expect(
        binairoCompletionRequestSchema.parse(JSON.parse(init.body)),
      ).toMatchObject({ grid: SOLVED_GRID, elapsedMs: 0 });
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("keeps a handed completion queued in memory when the network fails", async () => {
    const original = Object.getOwnPropertyDescriptor(window, "localStorage");
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("access denied", "SecurityError");
      },
    });
    let online = false;
    const fetchMock = vi.fn((input: unknown) => {
      if (String(input).endsWith("/session")) {
        return Promise.resolve(
          jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
        );
      }
      return online
        ? Promise.resolve(jsonResponse(200, okBody()))
        : Promise.reject(new TypeError("offline"));
    });
    vi.stubGlobal("fetch", fetchMock);

    try {
      const { flushPendingCompletions } = await freshSync();
      await flushPendingCompletions(pendingRecord());

      online = true;
      await flushPendingCompletions();

      expect(completionCalls(fetchMock)).toHaveLength(2);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("posts one record of EACH game, once each — the one-module property (T-WEB-S12)", async () => {
    writePlayRecord(pendingRecord());
    writePlayRecord(pendingSudokuRecord());
    writePlayRecord(pendingNonogramRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionCalls(fetchMock).map((call) => {
      const raw: unknown = JSON.parse(requestInitSchema.parse(call[1]).body);
      return completionRequestSchema.parse(raw);
    });
    expect(bodies).toHaveLength(3);
    expect(
      binairoCompletionRequestSchema.parse(
        bodies.find((body) => body.game === "binairo"),
      ),
    ).toEqual({
      game: "binairo",
      date: DATE,
      grid: SOLVED_GRID,
      elapsedMs: 272_000,
      hintsUsed: 1,
    });
    expect(
      sudokuCompletionRequestSchema.parse(
        bodies.find((body) => body.game === "sudoku"),
      ),
    ).toEqual({
      game: "sudoku",
      date: DATE,
      grid: SOLVED_DIGITS,
      elapsedMs: 411_000,
      hintsUsed: 0,
    });

    expect(
      nonogramCompletionRequestSchema.parse(
        bodies.find((body) => body.game === "nonogram"),
      ),
    ).toEqual({
      game: "nonogram",
      date: DATE,
      grid: SUBMITTED_PICTURE,
      elapsedMs: 133_000,
      hintsUsed: 0,
    });
    expect(readPlayRecord("sudoku", DATE)?.pendingSync).toBe(false);
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(false);
    expect(readPlayRecord("nonogram", DATE)?.pendingSync).toBe(false);
  });

  it("does nothing when there is nothing queued", async () => {
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never falls back to a relative fetch when the api origin is unset", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", undefined);
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(errorSpy).toHaveBeenCalled();
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(true);
    errorSpy.mockRestore();
  });

  it("drops an unbuildable pending record instead of retrying it forever", async () => {
    writePlayRecord(pendingRecord({ grid: undefined }));
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(completionCalls(fetchMock)).toHaveLength(0);
    expect(errorSpy).toHaveBeenCalled();
    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "rejected",
    });
    errorSpy.mockRestore();
  });
});

describe("terminal versus retryable statuses (T-WEB-16b)", () => {
  it.each([404, 422, 400, 415, 403])(
    "stops retrying on %i and marks the result rejected",
    async (status) => {
      writePlayRecord(pendingRecord());
      stubFetch(() => jsonResponse(status, { error: "nope" }));
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { flushPendingCompletions } = await freshSync();
      await flushPendingCompletions();

      expect(readPlayRecord("binairo", DATE)).toMatchObject({
        pendingSync: false,
        syncOutcome: "rejected",
      });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    },
  );

  it.each([429, 500, 502, 503])(
    "keeps the record pending on %i",
    async (status) => {
      writePlayRecord(pendingRecord());
      stubFetch(() => jsonResponse(status, { error: "boom" }));

      const { flushPendingCompletions } = await freshSync();
      await flushPendingCompletions();

      expect(readPlayRecord("binairo", DATE)).toMatchObject({
        pendingSync: true,
        syncOutcome: "pending",
      });
    },
  );

  it("posts today's daily BEFORE a late record that will take the 429", async () => {
    const LATE = "2026-07-01";
    const TODAY = "2026-08-14";

    writePlayRecord(pendingRecord({ date: LATE }));
    writePlayRecord(pendingRecord({ date: TODAY }));

    const fetchMock = vi.fn((...args: unknown[]) => {
      if (String(args[0]).endsWith("/session")) {
        return Promise.resolve(
          jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
        );
      }
      const parsed: unknown = JSON.parse(
        String((args[1] as { body?: unknown }).body),
      );
      const date = (parsed as { date: string }).date;
      return Promise.resolve(
        date === TODAY
          ? jsonResponse(200, okBody({ date: TODAY }))
          : jsonResponse(429, { error: "archive-cap" }),
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const posted = completionCalls(fetchMock).map((call) => {
      const parsed: unknown = JSON.parse(
        String((call[1] as { body?: unknown }).body),
      );
      return (parsed as { date: string }).date;
    });

    expect(posted).toEqual([TODAY, LATE]);
    expect(readPlayRecord("binairo", TODAY)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });

    expect(readPlayRecord("binairo", LATE)).toMatchObject({
      pendingSync: true,
      syncOutcome: "pending",
    });
  });

  it("stops at the first 429 — every record still ahead of it is older, so certain to be capped", async () => {
    for (const date of ["2026-07-01", "2026-07-02", "2026-07-03"]) {
      writePlayRecord(pendingRecord({ date }));
    }
    const fetchMock = stubFetch(() => jsonResponse(429, { error: "cap" }));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const bodies = completionCalls(fetchMock).map((call) => {
      const parsed: unknown = JSON.parse(
        String((call[1] as { body?: unknown }).body),
      );
      return (parsed as { date: string }).date;
    });
    expect(bodies).toEqual(["2026-07-03"]);
    for (const date of ["2026-07-01", "2026-07-02", "2026-07-03"]) {
      expect(readPlayRecord("binairo", date)).toMatchObject({
        pendingSync: true,
      });
    }
  });

  it("re-mints once on a 401 and retries once, then stops for this page load", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() =>
      jsonResponse(401, { error: "no-session" }),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(sessionCalls(fetchMock)).toHaveLength(2);
    expect(completionCalls(fetchMock)).toHaveLength(2);
    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: true,
      syncOutcome: "pending",
    });

    await flushPendingCompletions();

    expect(sessionCalls(fetchMock)).toHaveLength(2);
    expect(completionCalls(fetchMock)).toHaveLength(3);
  });

  it("accepts the completion when the re-mint fixes the 401", async () => {
    writePlayRecord(pendingRecord());
    stubFetch((attempt) =>
      attempt === 1
        ? jsonResponse(401, { error: "no-session" })
        : jsonResponse(200, okBody()),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });
});

describe("startCompletionSync", () => {
  it("flushes on mount and again on an online event", async () => {
    writePlayRecord(pendingRecord());
    let online = false;
    const fetchMock = vi.fn((input: unknown) => {
      if (String(input).endsWith("/session")) {
        return Promise.resolve(
          jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
        );
      }
      return online
        ? Promise.resolve(jsonResponse(200, okBody()))
        : Promise.reject(new TypeError("offline"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { startCompletionSync } = await freshSync();
    const stop = startCompletionSync();
    await settle();
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(true);

    online = true;
    window.dispatchEvent(new Event("online"));
    await settle();

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
    stop();
  });

  it("stops flushing once it has been torn down", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(503, { error: "boom" }));

    const { startCompletionSync } = await freshSync();
    const stop = startCompletionSync();
    await settle();
    const before = completionCalls(fetchMock).length;
    expect(before).toBeGreaterThan(0);

    stop();
    window.dispatchEvent(new Event("online"));
    await settle();

    expect(completionCalls(fetchMock)).toHaveLength(before);
  });

  it("a retry armed by a flush lives on this file's virtual clock, so it cannot outlive the test (T-WEB-S359)", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(503, { error: "boom" }));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();
    await settle();
    expect(completionCalls(fetchMock)).toHaveLength(1);

    expect(
      vi.getTimerCount(),
      "a real retry timer would survive vi.resetModules() and post into the NEXT test's fetch stub",
    ).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(completionCalls(fetchMock)).toHaveLength(2);
  });

  it("retries on a bounded backoff after a 5xx and stops once recorded", async () => {
    vi.useFakeTimers();
    writePlayRecord(pendingRecord());
    let status = 503;
    const fetchMock = stubFetch(() =>
      status === 503
        ? jsonResponse(503, { error: "boom" })
        : jsonResponse(200, okBody()),
    );

    const { startCompletionSync } = await freshSync();
    const stop = startCompletionSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(completionCalls(fetchMock)).toHaveLength(1);

    await vi.advanceTimersByTimeAsync(2_000);
    expect(completionCalls(fetchMock)).toHaveLength(2);

    status = 200;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(completionCalls(fetchMock)).toHaveLength(3);
    expect(readPlayRecord("binairo", DATE)?.syncOutcome).toBe("recorded");

    await vi.advanceTimersByTimeAsync(120_000);
    expect(completionCalls(fetchMock)).toHaveLength(3);
    stop();
  });
});

describe("the extension point #27 widens", () => {
  it("makes an unhandled game a compile error, not a dropped completion", () => {
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
      /switch \(record\.game\)[\s\S]*?default: \{[\s\S]*?const unhandled: never = record;/,
    );
  });
});

describe("the late-sync credit needs NO client change (#58, ADR-0066) (T-WEB-S283)", () => {
  it("posts a queued yesterday record byte-unchanged in shape and settles recorded on the credited 200", async () => {
    const YESTERDAY = "2026-08-13";
    writePlayRecord(pendingRecord({ date: YESTERDAY }));
    const fetchMock = stubFetch(() =>
      jsonResponse(200, okBody({ date: YESTERDAY, onTime: true })),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const calls = completionCalls(fetchMock);
    expect(calls).toHaveLength(1);
    const init = requestInitSchema.parse(calls[0]?.[1]);
    const body: unknown = JSON.parse(init.body);
    const parsed = completionRequestSchema.parse(body);
    expect(parsed.date).toBe(YESTERDAY);
    expect(Object.keys(body as Record<string, unknown>).sort()).toEqual([
      "date",
      "elapsedMs",
      "game",
      "grid",
      "hintsUsed",
    ]);

    expect(readPlayRecord("binairo", YESTERDAY)).toMatchObject({
      pendingSync: false,
      syncOutcome: "recorded",
    });
  });
});

describe("422 multi-date-sync settles the record with no retry (#58, ADR-0066) (T-WEB-S284)", () => {
  it("marks the record rejected and never re-posts it", async () => {
    vi.useFakeTimers();
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() =>
      jsonResponse(422, { error: "multi-date-sync" }),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const { flushPendingCompletions } = await freshSync();
    const flushed = flushPendingCompletions();
    await vi.runAllTimersAsync();
    await flushed;

    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: false,
      syncOutcome: "rejected",
    });
    expect(completionCalls(fetchMock)).toHaveLength(1);

    await vi.runAllTimersAsync();
    expect(completionCalls(fetchMock)).toHaveLength(1);
    errorSpy.mockRestore();
  });
});
