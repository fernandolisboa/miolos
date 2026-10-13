import {
  dailyCrosswordResponseSchema,
  dailyNonogramResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  type DailyBinairoResponse,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FetchedFreeHints } from "../src/api/free-hints-provider";
import { useBinairoPlay } from "../src/binairo/use-binairo-play";
import { useCrosswordPlay } from "../src/crossword/use-crossword-play";
import { useNonogramPlay } from "../src/nonogram/use-nonogram-play";
import {
  FreeHintsContext,
  useFreeHintsPerPuzzle,
} from "../src/play/free-hints";
import {
  playRecordKey,
  playRecordSchema,
  type PlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import type { HintState } from "../src/play/types";
import { useQueensPlay } from "../src/queens/use-queens-play";
import { solutionDigits } from "../src/sudoku/engine";
import { useSudokuPlay } from "../src/sudoku/use-sudoku-play";

const sync = vi.hoisted(() => ({
  startCompletionSync: vi.fn(() => () => undefined),
  flushPendingCompletions: vi.fn(() => Promise.resolve()),
}));
vi.mock("../src/play/sync", () => sync);

vi.mock("../src/telemetry/client", () => ({ postPuzzleStarted: vi.fn() }));

const bootstrap = vi.hoisted(() => ({
  ensureSession: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));
vi.mock("../src/session/bootstrap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../src/session/bootstrap")>()),
  ensureSession: bootstrap.ensureSession,
}));

const API_URL = "https://api.example.test";
const DATE = "2026-08-01";

const SUDOKU_PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 6 });
const SUDOKU: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU_PUZZLE.givens,
  tier: SUDOKU_PUZZLE.tier,
});

const BINAIRO: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...generateBinairo({ seed: 20_260_801, weekday: 6 }).givens],
};

const NONOGRAM_PUZZLE = generateNonogram(20_260_801, 6);
const NONOGRAM = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM_PUZZLE.size,
  clues: NONOGRAM_PUZZLE.clues,
});

const QUEENS_PUZZLE = generateQueens({ seed: 20_260_801, weekday: 6 });
const QUEENS = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: QUEENS_PUZZLE.size,
  regions: QUEENS_PUZZLE.regions,
});

const CROSSWORD = dailyCrosswordResponseSchema.parse({
  game: "crossword",
  date: DATE,
  grid: [
    ["c", "a", "s", "a", "s"],
    [null, null, null, null, null],
    ["m", "e", "s", "a", "s"],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  clues: [
    {
      number: 1,
      direction: "across",
      row: 0,
      col: 0,
      length: 5,
      clue: "lares",
    },
    {
      number: 2,
      direction: "across",
      row: 2,
      col: 0,
      length: 5,
      clue: "móveis",
    },
  ],
});

interface HintedPlay {
  readonly state: { readonly hint: HintState };
  readonly hintReady: boolean;
  readonly revealHint: () => void;
}

const HOOKS: readonly {
  readonly game: PlayRecord["game"];
  readonly useHook: () => HintedPlay;
}[] = [
  { game: "sudoku", useHook: () => useSudokuPlay(SUDOKU) },
  { game: "binairo", useHook: () => useBinairoPlay(BINAIRO) },
  { game: "nonogram", useHook: () => useNonogramPlay(NONOGRAM) },
  { game: "queens", useHook: () => useQueensPlay(QUEENS) },
  { game: "crossword", useHook: () => useCrosswordPlay(CROSSWORD) },
];

function allowanceOf(value: number | null) {
  return function Allowance({ children }: { children: ReactNode }) {
    return <FreeHintsContext value={value}>{children}</FreeHintsContext>;
  };
}

function Fetched({ children }: { children: ReactNode }) {
  return <FetchedFreeHints>{children}</FetchedFreeHints>;
}

function storedRecord(game: PlayRecord["game"]): PlayRecord {
  const raw = window.localStorage.getItem(playRecordKey(game, DATE));
  if (raw === null) {
    throw new Error(`no ${game} record was written`);
  }
  return playRecordSchema.parse(JSON.parse(raw));
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function hydrate(): void {
  act(() => {
    vi.advanceTimersByTime(0);
  });
}

function reveal(play: { current: HintedPlay }, times: number): void {
  for (let press = 0; press < times; press += 1) {
    act(() => {
      play.current.revealHint();
    });
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  bootstrap.ensureSession.mockImplementation(() => Promise.resolve());
  window.localStorage.clear();
  vi.stubEnv("NEXT_PUBLIC_API_URL", API_URL);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("each daily hook offers the served allowance (T-WEB-S539)", () => {
  it.each(HOOKS)(
    "$game: five hints under an allowance of five, then the button is spent",
    ({ game, useHook }) => {
      vi.useFakeTimers();
      const { result } = renderHook(useHook, { wrapper: allowanceOf(5) });
      hydrate();

      reveal(result, 4);
      expect(result.current.hintReady).toBe(true);
      reveal(result, 2);

      expect(result.current.hintReady).toBe(false);
      expect(result.current.state.hint.used).toBe(5);
      expect(storedRecord(game).hintsUsed).toBe(5);
    },
  );
});

describe("a record past a lowered allowance still plays and completes (T-WEB-S540)", () => {
  it("restores three hints under an allowance of two, offers none, and the completion carries three", () => {
    vi.useFakeTimers();
    const solution = solutionDigits(SUDOKU_PUZZLE.givens);
    if (solution === null) {
      throw new Error("a published daily is uniquely solvable by construction");
    }
    const open = SUDOKU_PUZZLE.givens.flatMap((given, index) =>
      given === 0 ? [index] : [],
    );
    const last = open.at(-1) ?? -1;
    const record: SudokuPlayRecord = {
      v: 1,
      game: "sudoku",
      date: DATE,
      entries: SUDOKU_PUZZLE.givens.map((given, index) =>
        given === 0 && index !== last ? (solution[index] ?? null) : null,
      ),
      elapsedMs: 60_000,
      hintsUsed: 3,
      concluded: false,
      pendingSync: false,
      syncOutcome: "pending",
    };
    window.localStorage.setItem(
      playRecordKey("sudoku", DATE),
      JSON.stringify(record),
    );

    const { result } = renderHook(() => useSudokuPlay(SUDOKU), {
      wrapper: allowanceOf(2),
    });
    hydrate();

    expect(result.current.state.hydrated).toBe(true);
    expect(result.current.state.hint.used).toBe(3);
    expect(result.current.hintReady).toBe(false);
    reveal(result, 1);
    expect(result.current.state.hint.used).toBe(3);

    const digit = solution[last];
    if (digit === undefined) {
      throw new Error("the last open cell has a solution digit");
    }
    act(() => {
      result.current.selectCell(last);
    });
    act(() => {
      result.current.enterDigit(digit);
    });

    expect(sync.flushPendingCompletions).toHaveBeenCalledWith(
      expect.objectContaining({ concluded: true, hintsUsed: 3 }),
    );
  });
});

describe("the fetched allowance: loading, then the served value (T-WEB-S541)", () => {
  it("is null while /hints is in flight and the served value after", async () => {
    let answer: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          answer = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const { result } = renderHook(useFreeHintsPerPuzzle, { wrapper: Fetched });
    expect(result.current).toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/hints`, {
      credentials: "include",
    });
    answer(jsonResponse(200, { freeHintsPerPuzzle: 5 }));

    await waitFor(() => {
      expect(result.current).toBe(5);
    });
  });

  it("a hook mounted while loading offers no hint, then reveals up to the loaded value", async () => {
    let answer: (response: Response) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            answer = resolve;
          }),
      ),
    );

    const { result } = renderHook(() => useSudokuPlay(SUDOKU), {
      wrapper: Fetched,
    });
    await waitFor(() => {
      expect(result.current.state.hydrated).toBe(true);
    });
    expect(result.current.hintReady).toBe(false);
    reveal(result, 1);
    expect(result.current.state.hint.used).toBe(0);

    answer(jsonResponse(200, { freeHintsPerPuzzle: 5 }));
    await waitFor(() => {
      expect(result.current.hintReady).toBe(true);
    });
    reveal(result, 6);

    expect(result.current.state.hint.used).toBe(5);
    expect(result.current.hintReady).toBe(false);
  });
});

describe("a failed allowance read falls back to the default (T-WEB-S542)", () => {
  const FAILURES: readonly {
    readonly name: string;
    readonly arrange: () => void;
  }[] = [
    {
      name: "a network error",
      arrange: () => {
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.reject(new TypeError("down"))),
        );
      },
    },
    {
      name: "a 500",
      arrange: () => {
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(jsonResponse(500, { error: "internal" })),
          ),
        );
      },
    },
    {
      name: "a 404 from an api without the route",
      arrange: () => {
        vi.stubGlobal(
          "fetch",
          vi.fn(() => Promise.resolve(new Response("", { status: 404 }))),
        );
      },
    },
    {
      name: "a body outside the contract",
      arrange: () => {
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(jsonResponse(200, { freeHintsPerPuzzle: 10 })),
          ),
        );
      },
    },
    {
      name: "a failed mint",
      arrange: () => {
        bootstrap.ensureSession.mockRejectedValue(new Error("mint"));
        vi.stubGlobal(
          "fetch",
          vi.fn(() =>
            Promise.resolve(jsonResponse(200, { freeHintsPerPuzzle: 5 })),
          ),
        );
      },
    },
  ];

  it.each(FAILURES)(
    "$name: the allowance settles on FREE_HINTS_PER_PUZZLE and a hint is ready",
    async ({ arrange }) => {
      arrange();
      const { result } = renderHook(
        () => ({
          allowance: useFreeHintsPerPuzzle(),
          play: useSudokuPlay(SUDOKU),
        }),
        { wrapper: Fetched },
      );

      await waitFor(() => {
        expect(result.current.allowance).toBe(FREE_HINTS_PER_PUZZLE);
      });
      expect(result.current.play.hintReady).toBe(true);
    },
  );
});
