import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  playRecordKey,
  playRecordSchema,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import { solutionDigits } from "../src/sudoku/engine";
import type { SudokuDigit } from "../src/sudoku/state";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DATE = "2026-08-01";

const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});

function solutionOf(): readonly SudokuDigit[] {
  const digits = solutionDigits(PUZZLE.givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf();

function storedRecord(): SudokuPlayRecord {
  const raw = window.localStorage.getItem(playRecordKey("sudoku", DATE));
  if (raw === null) {
    throw new Error("no record was written");
  }
  const parsed = playRecordSchema.parse(JSON.parse(raw));
  if (parsed.game !== "sudoku") {
    throw new Error(`the sudoku key holds a ${parsed.game} record`);
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

describe("useSudokuPlay", () => {
  it("counts the clues, not 81, on a fresh board", () => {
    const { result } = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    expect(result.current.filled).toBe(PUZZLE.clueCount);
    expect(result.current.state.hydrated).toBe(true);
    expect(result.current.hintReady).toBe(true);
  });

  it("persists an in-progress board with no grid to post", () => {
    const { result } = renderHook(() => useSudokuPlay(DAILY));
    const first = PUZZLE.givens.findIndex((cell) => cell === 0);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => {
      result.current.selectCell(first);
    });
    act(() => {
      result.current.enterDigit(SOLUTION[first] ?? 1);
    });

    const record = storedRecord();

    expect(record.entries[first]).toBe(SOLUTION[first]);

    expect(record.grid).toBeUndefined();
    expect(record.concluded).toBe(false);
    expect(record.pendingSync).toBe(false);
    expect(sync.flushPendingCompletions).not.toHaveBeenCalled();
  });

  it("writes a postable completion the moment the grid closes", () => {
    const { result } = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    for (const [index, digit] of SOLUTION.entries()) {
      if (PUZZLE.givens[index] !== 0) {
        continue;
      }
      act(() => {
        result.current.selectCell(index);
      });
      act(() => {
        result.current.enterDigit(digit);
      });
    }

    expect(result.current.state.status).toBe("solved");
    expect(result.current.filled).toBe(81);

    const record = storedRecord();

    expect(record.concluded).toBe(true);
    expect(record.pendingSync).toBe(true);

    expect(record.grid).toEqual([...PUZZLE.solution]);
    expect(record.hintsUsed).toBe(0);

    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(record);
  });

  it("spends the free hint once and reports which case it fired", () => {
    const { result } = renderHook(() => useSudokuPlay(DAILY));
    act(() => {
      vi.advanceTimersByTime(0);
    });

    act(() => {
      result.current.revealHint();
    });

    const first = PUZZLE.givens.findIndex((cell) => cell === 0);

    expect(result.current.state.entries[first]).toBe(SOLUTION[first]);
    expect(result.current.hintKind).toBe("fill");
    expect(result.current.hintReady).toBe(false);

    act(() => {
      result.current.revealHint();
    });

    expect(result.current.state.hint.used).toBe(1);
    expect(storedRecord().hintsUsed).toBe(1);
  });
});
