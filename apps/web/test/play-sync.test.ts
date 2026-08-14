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

// T-WEB-16 / T-WEB-16b (plan 017 §15). The flush is proved with NO play
// screen mounted: the record IS the queue (D18), so seeding localStorage
// and importing the module is the whole fixture. That is exactly the
// situation AC 3 cares about — a completion that syncs from a cold mount,
// an `online` event or a retry, long after the grid left the screen.

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

const SOLVED_GRID: NonNullable<BinairoPlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

/**
 * The sudoku queue item: 81 digits and no zero, because `0` means EMPTY in
 * the engine grid and a submission is a COMPLETE board. Built by repeating
 * the digit row rather than by asserting a type — the repo bans `as` in
 * tests, and this shape is the schema's own.
 */
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;
const SOLVED_DIGITS: NonNullable<SudokuPlayRecord["grid"]> = Array.from(
  { length: 9 },
  () => DIGITS,
).flat();

/**
 * The nonogram queue item: a 5×5 board's SUBMITTED bitmap, 25 cells of 0/1.
 * Crossed and undecided cells are both `0` here, because the completion
 * predicate is "the picture is painted" (ADR-0032) — so on a closed board
 * this array IS the solution, and a cross never crosses the wire.
 */
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

/**
 * Fetch double that answers `/session` unconditionally and delegates every
 * `/completions` call to `respond`, which receives the 1-based attempt
 * number so a test can change its mind between retries.
 */
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

/** Module state (the in-flight guard, the re-mint latch) is per-import. */
async function freshSync() {
  vi.resetModules();
  return await import("../src/play/sync");
}

async function settle() {
  for (let turn = 0; turn < 6; turn += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
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

describe("flushPendingCompletions", () => {
  it("posts a body built from the record's solved grid alone", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    const [call] = completionCalls(fetchMock);
    expect(call).toBeDefined();
    expect(String(call?.[0])).toBe(`${API_URL}/completions`);

    // Parsed rather than cast: the repo bans `as` in tests, and a schema
    // says exactly which request shape is being pinned.
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
    // The interleaving AC 3 loses to: a fast finish on a slow network, or a
    // restored near-complete board, closes while a mount flush is still
    // awaiting its own fetch. The in-flight flush built `pending` before this
    // record existed, so it never posts it — and if its own records all
    // settle it used to call `cancelRetries()`, clearing the ladder and
    // stranding the just-finished puzzle until a new mount, an `online` or a
    // `visibilitychange`. The player is ONLINE and the conclusion says
    // "pendente" (finding `handed-completion-dropped-by-a-concurrent-flush`).
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
      // Only the FIRST POST hangs: it is the flush that must not swallow the
      // record handed to it while it was in the air.
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

    // The board closes mid-flight. `writePlayRecord` is what the real caller
    // does first, so the record is in the store AND handed over.
    const nonogram = pendingNonogramRecord();
    writePlayRecord(nonogram);
    await flushPendingCompletions(nonogram);
    expect(completionCalls(fetchMock)).toHaveLength(1);

    release();
    await inFlight;
    await vi.advanceTimersByTimeAsync(0);
    expect(readPlayRecord("binairo", DATE)?.pendingSync).toBe(false);

    // No new mount, no `online`, no `visibilitychange` — only the ladder the
    // handed record armed. It must fire, and it must carry the nonogram.
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
    // An Android WebView with DOM storage off (the default) throws on the
    // property itself, so `writePlayRecord` is a silent no-op and the queue
    // reads back EMPTY: without the in-memory fallback the flush returns
    // before it ever reaches `ensureSession`, no POST is ever issued on any
    // trigger, and the day is lost for the streak while the conclusion
    // claims the result is safe on the device (finding
    // `completion-lost-when-localstorage-is-unavailable`).
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

      // And settled, so no later trigger re-posts a completion the server
      // has already answered (D15).
      await flushPendingCompletions();
      expect(completionCalls(fetchMock)).toHaveLength(1);
    } finally {
      if (original !== undefined) {
        Object.defineProperty(window, "localStorage", original);
      }
    }
  });

  it("clamps a backwards clock step on the memory-queue path too", async () => {
    // The store's own clamp is two-sided, but a handed record never reaches
    // it when `localStorage` throws: `memoryQueue` keeps the object verbatim
    // and `buildBody` is the FIRST bound the number meets. Clamped on one
    // side only, `elapsedMs: z.number().int().min(0)` failed the request
    // parse, `buildBody` returned `undefined`, and the flush dropped an
    // intact completion with "has no solved grid to post" — permanently, on
    // exactly the devices the fallback exists for (finding
    // `memory-queue-record-bypasses-the-two-sided-clamp`).
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
      // An NTP correction mid-session: `now - runningSince` goes negative.
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

      // The reconnect is the whole point of AC 3: the record is the only
      // copy, and here the store is not holding it.
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
    // `listPendingRecords()` is game-blind by design, and this module's
    // guards are module-level: if the extraction had left a second copy of
    // sync.ts behind, each copy would post BOTH records and settle the
    // other's (ADR-0029, plan 018 S1). One module, two records, two POSTs.
    writePlayRecord(pendingRecord());
    writePlayRecord(pendingSudokuRecord());
    writePlayRecord(pendingNonogramRecord());
    const fetchMock = stubFetch(() => jsonResponse(200, okBody()));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    // Parsed against the request union, never cast — `JSON.parse` hands back
    // `any`, and a body that reached the wrong branch of `buildBody` fails
    // right here.
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
    // The nonogram body carries NO `size` (P4): a `size` key would be a
    // second place for the client to lie, and the stored row's solution is
    // what decides the size anyway. `gridBody` builds all three.
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

  // 429 joined this list at #31 (ADR-0053 decision 13): the completion
  // route's late-write ceiling is the first 429 this repo emits, and it is
  // a RATE refusal — the record is real and must survive to flush after
  // the next São Paulo rollover, which is exactly why it is not terminal.
  // The behavioural assertion lives here rather than in the source scan
  // `apps/api` carries (step-6 finding F13).
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

  it("re-mints once on a 401 and retries once, then stops for this page load", async () => {
    writePlayRecord(pendingRecord());
    const fetchMock = stubFetch(() =>
      jsonResponse(401, { error: "no-session" }),
    );

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    // One mint before the first POST, one re-mint after the 401.
    expect(sessionCalls(fetchMock)).toHaveLength(2);
    expect(completionCalls(fetchMock)).toHaveLength(2);
    expect(readPlayRecord("binairo", DATE)).toMatchObject({
      pendingSync: true,
      syncOutcome: "pending",
    });

    await flushPendingCompletions();

    // The latch holds: a second flush posts once more and never re-mints.
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

    // Terminal: the ladder is cancelled, not merely exhausted.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(completionCalls(fetchMock)).toHaveLength(3);
    stop();
  });
});

/**
 * The one per-game branch in the module, and the one place a new game can
 * fail OPEN (finding `buildbody-switch-fails-open-for-a-new-game`).
 *
 * The guarantee is a COMPILE-TIME one and `pnpm typecheck` is what enforces
 * it: `PlayRecord` has exactly three members today, both handled, so no runtime
 * input can reach the default — a test that manufactured one would have to
 * cast, which is precisely the lie the guard exists to prevent. What this
 * reads instead is the source, the way `./css-source.ts` reads a stylesheet:
 * the tripwire cannot be deleted silently, and the note travels with it.
 */
describe("the extension point #27 widens", () => {
  it("makes an unhandled game a compile error, not a dropped completion", () => {
    // `path` rather than `new URL(..., import.meta.url)`: the jsdom
    // environment's own `URL` resolves the relative specifier against the
    // document's http base, not against the module.
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
