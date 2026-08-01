import { binairoCompletionRequestSchema } from "@miolos/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  readPlayRecord,
  writePlayRecord,
  type PlayRecord,
} from "../src/binairo/play-record";

// T-WEB-16 / T-WEB-16b (plan 017 §15). The flush is proved with NO play
// screen mounted: the record IS the queue (D18), so seeding localStorage
// and importing the module is the whole fixture. That is exactly the
// situation AC 3 cares about — a completion that syncs from a cold mount,
// an `online` event or a retry, long after the grid left the screen.

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";

const SOLVED_GRID: NonNullable<PlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

function pendingRecord(overrides: Partial<PlayRecord> = {}): PlayRecord {
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
  return await import("../src/binairo/sync");
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

    expect(readPlayRecord(DATE)).toMatchObject({
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

    expect(readPlayRecord(DATE)).toMatchObject({
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

    expect(readPlayRecord(DATE)).toMatchObject({
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
    expect(readPlayRecord(DATE)?.pendingSync).toBe(true);
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
    expect(readPlayRecord(DATE)).toMatchObject({
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

      expect(readPlayRecord(DATE)).toMatchObject({
        pendingSync: false,
        syncOutcome: "rejected",
      });
      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    },
  );

  it.each([500, 502, 503])("keeps the record pending on %i", async (status) => {
    writePlayRecord(pendingRecord());
    stubFetch(() => jsonResponse(status, { error: "boom" }));

    const { flushPendingCompletions } = await freshSync();
    await flushPendingCompletions();

    expect(readPlayRecord(DATE)).toMatchObject({
      pendingSync: true,
      syncOutcome: "pending",
    });
  });

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
    expect(readPlayRecord(DATE)).toMatchObject({
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

    expect(readPlayRecord(DATE)).toMatchObject({
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
    expect(readPlayRecord(DATE)?.pendingSync).toBe(true);

    online = true;
    window.dispatchEvent(new Event("online"));
    await settle();

    expect(readPlayRecord(DATE)).toMatchObject({
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
    expect(readPlayRecord(DATE)?.syncOutcome).toBe("recorded");

    // Terminal: the ladder is cancelled, not merely exhausted.
    await vi.advanceTimersByTimeAsync(120_000);
    expect(completionCalls(fetchMock)).toHaveLength(3);
    stop();
  });
});
