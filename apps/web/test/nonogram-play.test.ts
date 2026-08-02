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

// T-WEB-S39 (plan 020 §19). The record `buildRecord` actually writes, parsed
// against the schema the sync queue reads it back with — plus the property
// neither shipped game has a test for on its own hook: `state.now` must
// NEVER enter `persistDeps` (landmine 21). Including it writes a
// readPlayRecord + Zod parse + JSON.stringify + setItem cycle every second,
// forever, and every other test in this suite is blind to it.

// The queue is stubbed: a real flush would reach `fetch`, and this file is
// about what the record CONTAINS, not about sending it.
const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

/** Weekday 1 is the 5×5 class — 0.0354 ms to generate and validate. */
const PUZZLE = generateNonogram(20_260_801, 1);

const DATE = "2026-08-01";

const DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: PUZZLE.size,
  clues: PUZZLE.clues,
});

/** The picture, narrowed by a throw rather than by a cast. */
function solutionOf(): readonly NonogramMark[] {
  const marks = solutionMarks(DAILY.clues);
  if (marks === null) {
    throw new Error("a published daily solves by construction");
  }
  return marks;
}

const SOLUTION = solutionOf();

/** The row-major indices the finished picture paints. */
const PICTURE: readonly number[] = SOLUTION.flatMap((mark, index) =>
  mark === 1 ? [index] : [],
);

/** The record this device stored for the day, parsed the way sync reads it. */
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
    // Let the mount effect's restore, the derived resume and their persists
    // settle, so what the spy sees afterwards is only what the ticks cause.
    act(() => {
      vi.advanceTimersByTime(0);
    });
    const before = result.current.state.now;
    const setItem = vi.spyOn(Storage.prototype, "setItem");

    act(() => {
      vi.advanceTimersByTime(10_000);
    });

    // Anti-vacuity: the clock really did move ten seconds, so "zero writes"
    // is a property of `persistDeps` and not of a stalled timer.
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
    // `withEntry`'s identity guard (§10.3 divergence 4). A drag dispatches
    // one `paint-over` per `pointermove`, so without it a 225-cell board
    // allocates a fresh `entries` array — and runs the persist effect — on
    // every move event. Binairo lacks this guard; the gap is filed, not
    // fixed here.
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

    // A cross is not progress (P13): the meter measures how close the
    // PICTURE is, never how much work was performed.
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
    // `grid` is the COMPLETION's body: an unfinished board has none, and
    // writing one would let the queue POST a partial picture.
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
    // The clock freeze is a passive effect; let it run before reading the
    // record the completion effect writes.
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.state.status).toBe("solved");
    expect(result.current.filled).toBe(result.current.target);

    const record = storedRecord();

    expect(record.concluded).toBe(true);
    expect(record.pendingSync).toBe(true);
    // Crossed and undecided cells are both 0 on the wire (ADR-0032), so on a
    // closed board this array IS the solution — exactly what
    // `nonogramCompletionRequestSchema` accepts at one of its four lengths.
    expect(record.grid).toEqual([...SOLUTION]);
    expect(record.hintsUsed).toBe(0);
    // Handed to the flush directly, not left for it to find (the
    // `completion-lost-when-localstorage-is-unavailable` finding).
    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(record);
  });

  it("writes `grid` ONLY in the write that flips `concluded` — the lockstep `use-record-snapshot` leans on (T-WEB-S64)", () => {
    // `sameToTheReader` (play/use-record-snapshot.ts) compares five CHROME
    // fields and NOT `size`/`grid`, which the nonogram conclusion renders.
    // Its TSDoc argues that is safe because `buildRecord` writes `grid`
    // exclusively in the same write that flips `concluded` — an argued
    // invariant nothing checked, over a wrong-picture render (step-6 round-3
    // finding NONO-Q5). This is the check. `buildRecord` is module-private,
    // so the assertion is made where its output actually lands: on every
    // persisted byte of a full play-through.
    // A call-through spy, not a replacement: the writes must really land, so
    // the lifecycle's own read-back behaves exactly as it does in play.
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

    // Anti-vacuity: both sides of the invariant were actually exercised.
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

    // Pass 2 guarantees the fill branch lands on a picture cell (P17): a
    // fresh board's hint is never a cross.
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
    // A day that was already finished before this mount must never re-queue:
    // the row is write-once server-side (D15).
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });
});
