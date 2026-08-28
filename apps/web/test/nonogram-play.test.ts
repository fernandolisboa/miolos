import {
  dailyNonogramResponseSchema,
  type DailyNonogramResponse,
} from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  playRecordKey,
  playRecordSchema,
  type NonogramPlayRecord,
} from "../src/play/play-record";
import { solutionMarks } from "../src/nonogram/engine";
import type { NonogramMark } from "../src/nonogram/state";
import { useNonogramPlay } from "../src/nonogram/use-nonogram-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const PUZZLE = generateNonogram(20_260_801, 1);

const DATE = "2026-08-01";

const DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: PUZZLE.size,
  clues: PUZZLE.clues,
});

function solutionOf(): readonly NonogramMark[] {
  const marks = solutionMarks(DAILY.clues);
  if (marks === null) {
    throw new Error("a published daily solves by construction");
  }
  return marks;
}

const SOLUTION = solutionOf();

const PICTURE: readonly number[] = SOLUTION.flatMap((mark, index) =>
  mark === 1 ? [index] : [],
);

function storedRecord(): NonogramPlayRecord {
  const raw = window.localStorage.getItem(playRecordKey("nonogram", DATE));
  if (raw === null) {
    throw new Error("no record was written");
  }
  const parsed = playRecordSchema.parse(JSON.parse(raw));
  if (parsed.game !== "nonogram") {
    throw new Error(`the nonogram key holds a ${parsed.game} record`);
  }
  return parsed;
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useNonogramPlay", () => {
  it("writes nothing on ten ticks of the real interval, and once on a mark", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));

    act(() => {
      vi.advanceTimersByTime(0);
    });
    const before = result.current.state.now;
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    expect(result.current.state.now).toBeGreaterThan(before);
    expect(result.current.elapsed).toBeGreaterThanOrEqual(10_000);
    expect(setItem).not.toHaveBeenCalled();

    act(() => {
      result.current.markCell(0);
    });

    expect(setItem).toHaveBeenCalledTimes(1);
    setItem.mockRestore();
  });

  it("writes nothing when a drag re-paints a cell it already painted", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      result.current.paintOver(1);
    });
    expect(setItem).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.paintOver(1);
    });
    act(() => {
      result.current.paintOver(1);
    });

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(result.current.state.entries[1]).toBe(1);
    setItem.mockRestore();
  });

  it("counts painted cells only, against a denominator summed from the clues", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.filled).toBe(0);
    expect(result.current.target).toBe(PICTURE.length);
    expect(result.current.hintReady).toBe(true);

    act(() => {
      result.current.setBrush("cross");
    });
    act(() => {
      result.current.markCell(SOLUTION.indexOf(0));
    });

    expect(result.current.filled).toBe(0);
  });

  it("persists an in-progress board with no grid to post", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      result.current.markCell(PICTURE[0] ?? 0);
    });

    const record = storedRecord();

    expect(record.size).toBe(PUZZLE.size);
    expect(record.entries[PICTURE[0] ?? 0]).toBe(1);

    expect(record.grid).toBeUndefined();
    expect(record.concluded).toBe(false);
    expect(record.pendingSync).toBe(false);
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });

  it("writes a postable completion from a FILL-ONLY finish, crossing nothing", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    for (const index of PICTURE) {
      act(() => {
        result.current.markCell(index);
      });
    }

    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.state.status).toBe("solved");
    expect(result.current.filled).toBe(result.current.target);

    const record = storedRecord();

    expect(record.concluded).toBe(true);
    expect(record.pendingSync).toBe(true);

    expect(record.grid).toEqual([...SOLUTION]);
    expect(record.hintsUsed).toBe(0);

    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(record);
  });

  it("writes `grid` ONLY in the write that flips `concluded` — the lockstep `use-record-snapshot` leans on (T-WEB-S64)", () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });
    for (const index of PICTURE) {
      act(() => {
        result.current.markCell(index);
      });
    }
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const written = setItem.mock.calls.map(([, value]) => value);
    setItem.mockRestore();

    const records = written.map((raw): NonogramPlayRecord => {
      const parsed = playRecordSchema.parse(JSON.parse(raw));
      if (parsed.game !== "nonogram") {
        throw new Error(`a ${parsed.game} record on the nonogram key`);
      }
      return parsed;
    });

    expect(records.filter((entry) => !entry.concluded).length).toBeGreaterThan(
      0,
    );
    expect(records.filter((entry) => entry.concluded).length).toBeGreaterThan(
      0,
    );

    for (const entry of records) {
      expect(entry.grid === undefined).toBe(!entry.concluded);
    }
  });

  it("spends the free hint once and reports which case it fired", () => {
    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    act(() => {
      result.current.revealHint();
    });

    expect(result.current.hintKind).toBe("fill");
    expect(result.current.state.hint.used).toBe(1);
    expect(result.current.hintReady).toBe(false);
    expect(result.current.filled).toBe(1);

    act(() => {
      result.current.revealHint();
    });

    expect(result.current.state.hint.used).toBe(1);
    expect(storedRecord().hintsUsed).toBe(1);
  });

  it("restores a stored board on mount without re-posting a settled day", () => {
    const stored: NonogramPlayRecord = {
      v: 1,
      game: "nonogram",
      date: DATE,
      size: DAILY.size,
      entries: SOLUTION.map((mark) => (mark === 1 ? 1 : null)),
      grid: [...SOLUTION],
      elapsedMs: 133_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: false,
      syncOutcome: "recorded",
    };
    window.localStorage.setItem(
      playRecordKey("nonogram", DATE),
      JSON.stringify(stored),
    );

    const { result } = renderHook(() => useNonogramPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.state.status).toBe("solved");
    expect(result.current.state.pendingSync).toBe(false);
    expect(result.current.elapsed).toBe(133_000);

    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});
