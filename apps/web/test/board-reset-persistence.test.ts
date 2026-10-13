import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useNonogramPlay } from "../src/nonogram/use-nonogram-play";
import {
  playRecordKey,
  playRecordSchema,
  type PlayRecord,
} from "../src/play/play-record";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

const DATE = "2026-10-13";
const SEED = 20_261_013;
const ELAPSED_MS = 3000;

interface Play {
  readonly state: { readonly entries: readonly unknown[] };
  readonly elapsed: number;
  readonly hintReady: boolean;
  readonly hintKind: string | null;
  readonly reset: () => void;
  readonly revealHint: () => void;
}

interface Daily<P extends Play> {
  readonly name: "sudoku" | "nonogram";
  readonly usePlay: () => P;
  readonly enter: (play: P) => void;
}

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: 1 });
const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU.givens,
  tier: SUDOKU.tier,
});
const SUDOKU_FIRST_PLAYABLE = SUDOKU.givens.findIndex((cell) => cell === 0);

const NONOGRAM = generateNonogram(SEED, 1);
const NONOGRAM_DAILY = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM.size,
  clues: NONOGRAM.clues,
});

function storedRecord(game: "sudoku" | "nonogram"): PlayRecord {
  const raw = window.localStorage.getItem(playRecordKey(game, DATE));
  if (raw === null) {
    throw new Error("no record was written");
  }
  return playRecordSchema.parse(JSON.parse(raw));
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function registerDaily<P extends Play>({ name, usePlay, enter }: Daily<P>) {
  describe(name, () => {
    function started() {
      const hook = renderHook(usePlay);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      return hook;
    }

    it("rewrites the record with no entries, the hint still spent and the clock not rewound", () => {
      const { result } = started();
      act(() => {
        enter(result.current);
      });
      act(() => {
        result.current.revealHint();
      });
      act(() => {
        vi.advanceTimersByTime(ELAPSED_MS);
      });
      expect(result.current.hintKind).not.toBeNull();

      act(() => {
        result.current.reset();
      });

      const record = storedRecord(name);
      expect(record.game).toBe(name);
      expect(
        "entries" in record && record.entries.every((entry) => entry === null),
      ).toBe(true);
      expect(record.hintsUsed).toBe(1);
      expect(record.elapsedMs).toBeGreaterThanOrEqual(ELAPSED_MS);
      expect(result.current.elapsed).toBeGreaterThanOrEqual(ELAPSED_MS);
      expect(result.current.hintKind).toBeNull();
      expect(result.current.hintReady).toBe(false);
    });

    it("writes nothing when the board is already empty", () => {
      const { result } = started();
      const setItem = vi.spyOn(Storage.prototype, "setItem");

      act(() => {
        result.current.reset();
      });

      expect(setItem).not.toHaveBeenCalled();
      setItem.mockRestore();
    });
  });
}

describe("Recomeçar on a daily board rewrites the play record (T-WEB-S490)", () => {
  registerDaily({
    name: "sudoku",
    usePlay: () => useSudokuPlay(SUDOKU_DAILY),
    enter: (play) => {
      play.selectCell(SUDOKU_FIRST_PLAYABLE);
      play.enterDigit(9);
    },
  });
  registerDaily({
    name: "nonogram",
    usePlay: () => useNonogramPlay(NONOGRAM_DAILY),
    enter: (play) => {
      play.selectCell(0);
      play.enterValue(1);
    },
  });
});
