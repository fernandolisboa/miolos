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

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const API_URL = "https://api.example.test";
const DATE = "2026-07-30";
const DAILY: DailyTermoResponse = { game: "termo", date: DATE };
const ANSWER = "praga";

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

function stubJudge(winOn: number | null) {
  const fetchMock = vi.fn((...args: unknown[]) => {
    const url = String(args[0]);
    if (url.endsWith("/session")) {
      return Promise.resolve(
        jsonResponse(200, { userId: crypto.randomUUID(), created: true }),
      );
    }

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

async function flush() {
  for (let turn = 0; turn < 12; turn += 1) {
    await Promise.resolve();
  }
}

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

    expect(record.guesses[1]?.tiles).toEqual([...WIN]);

    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(record);
  });

  it('closes a LOSS with `outcome: "lost"` and six judged rows', async () => {
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

    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
    expect(storedRecord().guesses).toHaveLength(2);
  });
});

describe("an un-judged guess never reaches storage (T-WEB-S85)", () => {
  it("keeps the pending row out of the record while the verdict is outstanding", async () => {
    stubJudge(null);
    const { result } = renderHook(() => useTermoPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    await play(result, GUESSES[0]);
    expect(storedRecord().guesses).toHaveLength(1);

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
