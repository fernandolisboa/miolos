import {
  dailyNonogramResponseSchema,
  dailySudokuResponseSchema,
  type DailyBinairoResponse,
  type DailyNonogramResponse,
  type DailySudokuResponse,
  type DailyTermoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useBinairoPlay } from "../src/binairo/use-binairo-play";
import { useNonogramPlay } from "../src/nonogram/use-nonogram-play";
import type { PlayCore } from "../src/play/types";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";
import { useTermoPlay } from "../src/termo/use-termo-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

vi.mock("../src/telemetry/client", () => ({ postPuzzleStarted: vi.fn() }));

const DATE = "2026-07-30";

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_730, weekday: 3 });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
};

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_730, weekday: 3 });
const SUDOKU_DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const NONOGRAM_PUZZLE = generateNonogram(20_260_730, 3);
const NONOGRAM_DAILY: DailyNonogramResponse = dailyNonogramResponseSchema.parse(
  {
    game: "nonogram",
    date: DATE,
    size: NONOGRAM_PUZZLE.size,
    clues: NONOGRAM_PUZZLE.clues,
  },
);

const TERMO_DAILY: DailyTermoResponse = { game: "termo", date: DATE };

interface Case {
  readonly name: string;
  readonly useHook: (claimed: boolean) => { readonly state: PlayCore };
}

const CASES: readonly Case[] = [
  {
    name: "binairo",
    useHook: (claimed) => useBinairoPlay(BINAIRO_DAILY, claimed),
  },
  {
    name: "sudoku",
    useHook: (claimed) => useSudokuPlay(SUDOKU_DAILY, claimed),
  },
  {
    name: "nonogram",
    useHook: (claimed) => useNonogramPlay(NONOGRAM_DAILY, claimed),
  },
  { name: "termo", useHook: (claimed) => useTermoPlay(TERMO_DAILY, claimed) },
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("a claim arriving after mount pauses a running clock (T-WEB-S370)", () => {
  it.each(CASES)(
    "$name: hydrates running, then a remote claim pauses it",
    ({ useHook }) => {
      const { result, rerender } = renderHook(useHook, {
        initialProps: false,
      });
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(result.current.state.timer.runningSince).not.toBeNull();

      rerender(true);
      act(() => {
        vi.advanceTimersByTime(0);
      });
      expect(result.current.state.timer.runningSince).toBeNull();
    },
  );
});
