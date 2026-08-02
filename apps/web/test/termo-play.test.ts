import { termoGuessRequestSchema, type DailyTermoResponse } from "@miolos/core";
import { MAX_GUESSES } from "@miolos/games/termo";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import {
  playRecordKey,
  playRecordSchema,
  type TermoPlayRecord,
} from "../src/play/play-record";
import { useTermoPlay } from "../src/termo/use-termo-play";

/**
 * T-WEB-S77, T-WEB-S84 and T-WEB-S85 (plan 022 §14.3/§14.4, ADR-0039
 * decision 5, ADR-0044 consequence (d)).
 *
 * `buildRecord` is a per-game LOCAL — every shipped game declares its own and
 * the shared layer takes it as a prop — so it is driven where its output
 * actually lands: on the bytes a real play-through persists.
 */

// The completion queue is stubbed: a real flush would reach `fetch`, and this
// file is about what the record CONTAINS. The GUESS client is not stubbed at
// the module level — it is driven through a fetch double, because the whole
// point of T-WEB-S85 is what happens while a real response is outstanding.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";
const DAILY: DailyTermoResponse = { game: "termo", date: DATE };
const ANSWER = "praga";

/** Six words the local list really carries — `submit` checks before posting. */
const GUESSES = ["abaco", "banho", "cerca", "dorme", "festa", "gente"] as const;

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * A judge that answers every guess with a miss until `winOn` (1-based), and
 * closes the board when the sixth is spent — i.e. the real route's shape.
 */
function stubJudge(winOn: number | null) {
  const fetchMock = vi.fn((...args: unknown[]) => {
    const url = String(args[0]);
    if (url.endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }
    // Parsed against the real request contract, never cast: a body that
    // reached this double in the wrong shape must fail here rather than be
    // read through an `as`.
    const init = z.object({ body: z.string() }).parse(args[1]);
    const guesses = termoGuessRequestSchema.parse(
      JSON.parse(init.body),
    ).guesses;
    const won = winOn !== null && guesses.length === winOn;
    const lost = winOn === null && guesses.length === MAX_GUESSES;
    return Promise.resolve(
      jsonResponse(200, {
        game: "termo",
        date: DATE,
        tiles: guesses.map((_unused, index) =>
          won && index === guesses.length - 1 ? [...WIN] : [...MISS],
        ),
        status: won ? "won" : lost ? "lost" : "playing",
        ...(won || lost ? { answer: ANSWER } : {}),
      }),
    );
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** A fetch that never answers — the held turn, mid-flight. */
function stubSilence() {
  const fetchMock = vi.fn((...args: unknown[]) =>
    String(args[0]).endsWith("/session")
      ? Promise.resolve(
          jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
        )
      : new Promise<Response>(() => undefined),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** The record this device stored for the day, parsed the way sync reads it. */
function storedRecord(): TermoPlayRecord {
  const raw = window.localStorage.getItem(playRecordKey("termo", DATE));
  if (raw === null) {
    throw new Error("no record was written");
  }
  const parsed = playRecordSchema.parse(JSON.parse(raw));
  if (parsed.game !== "termo") {
    throw new Error(`the termo key holds a ${parsed.game} record`);
  }
  return parsed;
}

/**
 * Let every queued microtask run. The guess client awaits `ensureSession()`,
 * a `fetch`, and `response.json()` — a chain several turns deep — and fake
 * timers do not touch microtasks, so draining them is what makes an awaited
 * POST observable in a synchronous assertion.
 */
async function flush() {
  for (let turn = 0; turn < 12; turn += 1) {
    await Promise.resolve();
  }
}

/** Type a word into the hook, letter by letter, then submit it. */
async function play(
  result: { current: ReturnType<typeof useTermoPlay> },
  word: string,
) {
  for (const letter of word) {
    act(() => {
      result.current.type(letter);
    });
  }
  await act(async () => {
    result.current.submit();
    await flush();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
  vi.useFakeTimers({ shouldAdvanceTime: false });
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("the record a play-through writes (T-WEB-S77)", () => {
  it("writes `answer` EXACTLY when the board closes, on both sides", () => {
    // Termo's copy of T-WEB-S64, asserted on `answer` and never on `guesses`:
    // the lockstep field is the one written exclusively in the concluding
    // write, and `use-record-snapshot.ts` leans on it — its comparator does
    // NOT compare `answer`, which is safe only because the record's
    // `superRefine` makes the lockstep a parse-time invariant.
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    stubJudge(2);

    return (async () => {
      const { result } = renderHook(() => useTermoPlay(DAILY));
      act(() => {
        vi.advanceTimersByTime(0);
      });
      await play(result, GUESSES[0]);
      await play(result, ANSWER);

      const written = setItem.mock.calls.map(([, value]) => value);
      setItem.mockRestore();

      const records = written.map((raw): TermoPlayRecord => {
        const parsed = playRecordSchema.parse(JSON.parse(raw));
        if (parsed.game !== "termo") {
          throw new Error(`a ${parsed.game} record on the termo key`);
        }
        return parsed;
      });

      // Anti-vacuity: both sides of the invariant were really exercised.
      expect(
        records.filter((entry) => !entry.concluded).length,
      ).toBeGreaterThan(0);
      expect(records.filter((entry) => entry.concluded).length).toBeGreaterThan(
        0,
      );

      for (const entry of records) {
        expect(entry.answer === undefined).toBe(!entry.concluded);
        expect(entry.outcome === undefined).toBe(!entry.concluded);
      }
    })();
  });

  it('closes a WIN with `outcome: "won"`, derived from the status', async () => {
    stubJudge(2);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    await play(result, GUESSES[0]);
    await play(result, ANSWER);

    expect(result.current.state.status).toBe("solved");
    const record = storedRecord();
    expect(record).toMatchObject({
      concluded: true,
      pendingSync: true,
      outcome: "won",
      answer: ANSWER,
      hintsUsed: 0,
    });
    expect(record.guesses.map((row) => row.guess)).toEqual([
      GUESSES[0],
      ANSWER,
    ]);
    // The closing row's tiles are the SERVER's, copied across row by row.
    expect(record.guesses[1]?.tiles).toEqual([...WIN]);
    // Handed to the flush directly, not left for it to find.
    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(record);
  });

  it('closes a LOSS with `outcome: "lost"` and six judged rows', async () => {
    // The first record in the product whose `closed` and `solved` do not
    // coincide (ADR-0044). `PlayCore.status`'s `"lost"` member finally has a
    // producer, and the completion is written exactly as a win's is.
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    for (const guess of GUESSES) {
      await play(result, guess);
    }

    expect(result.current.state.status).toBe("lost");
    const record = storedRecord();
    expect(record).toMatchObject({
      concluded: true,
      pendingSync: true,
      outcome: "lost",
      answer: ANSWER,
    });
    expect(record.guesses).toHaveLength(MAX_GUESSES);
  });
});

describe("persistDeps is [state.guesses] (T-WEB-S84)", () => {
  it("writes NOTHING on a tick, and nothing on a keystroke", async () => {
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    // One judged guess first, so the persist effect has already fired once
    // and the counter below is measuring quiet, not a cold start.
    await play(result, GUESSES[0]);

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(setItem, "ten ticks").not.toHaveBeenCalled();

    for (const letter of GUESSES[1]) {
      act(() => {
        result.current.type(letter);
      });
    }
    act(() => {
      result.current.erase();
    });
    expect(setItem, "five keystrokes and an erase").not.toHaveBeenCalled();
    setItem.mockRestore();
  });

  it("writes exactly ONCE per judged guess", async () => {
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await play(result, GUESSES[0]);

    const setItem = vi.spyOn(Storage.prototype, "setItem");
    await play(result, GUESSES[1]);

    // Anti-vacuity for the two assertions above: the array identity really is
    // the thing that moves, and it really does write when it does.
    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
    expect(storedRecord().guesses).toHaveLength(2);
  });
});

describe("an un-judged guess never reaches storage (T-WEB-S85)", () => {
  it("keeps the pending row out of the record while the verdict is outstanding", async () => {
    // A persisted un-judged row could never be filled in — the client has no
    // answer to judge against — so a reload would find a row with no tiles
    // that had already spent one of six attempts (ADR-0039 decision 5).
    // Losing five typed letters to a crash is strictly better.
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await play(result, GUESSES[0]);
    expect(storedRecord().guesses).toHaveLength(1);

    // Now a turn that never comes back.
    stubSilence();
    for (const letter of GUESSES[1]) {
      act(() => {
        result.current.type(letter);
      });
    }
    await act(async () => {
      result.current.submit();
      await flush();
    });

    expect(result.current.state.pending).toBe(GUESSES[1]);
    expect(result.current.heldRow).toBe(1);
    expect(result.current.activeRow).toBeNull();
    // The record still holds ONE row: the in-flight guess is reducer state
    // and nothing else.
    expect(storedRecord().guesses).toHaveLength(1);
    expect(JSON.stringify(storedRecord())).not.toContain(GUESSES[1]);
  });

  it("never persists the draft either", async () => {
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await play(result, GUESSES[0]);

    for (const letter of GUESSES[1]) {
      act(() => {
        result.current.type(letter);
      });
    }

    expect(result.current.state.draft).toBe(GUESSES[1]);
    expect(JSON.stringify(storedRecord())).not.toContain(GUESSES[1]);
  });
});
