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
import { solutionMarks } from "../src/nonogram/engine";
import { useNonogramPlay } from "../src/nonogram/use-nonogram-play";
import {
  FreeHintsContext,
  useFreeHintsPerPuzzle,
} from "../src/play/free-hints";
import {
  playRecordKey,
  playRecordSchema,
  type PlayRecord,
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
const SUDOKU_SOLUTION = solutionDigits(SUDOKU_PUZZLE.givens) ?? [];

const BINAIRO_PUZZLE = generateBinairo({ seed: 20_260_801, weekday: 6 });
const BINAIRO: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO_PUZZLE.givens],
};

const NONOGRAM_PUZZLE = generateNonogram(20_260_801, 6);
const NONOGRAM = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM_PUZZLE.size,
  clues: NONOGRAM_PUZZLE.clues,
});
const NONOGRAM_SOLUTION = solutionMarks(NONOGRAM.clues) ?? [];

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
const CROSSWORD_LETTERS = CROSSWORD.grid.flat();

const HEADER = {
  v: 1,
  date: DATE,
  elapsedMs: 60_000,
  concluded: false,
  pendingSync: false,
  syncOutcome: "pending",
} as const;

function lastIndexWhere<T>(cells: readonly T[], keep: (cell: T) => boolean) {
  return cells.findLastIndex(keep);
}

function value<T>(cell: T | undefined): T {
  if (cell === undefined) {
    throw new Error("the fixture's solution covers every cell");
  }
  return cell;
}

const SUDOKU_LAST = lastIndexWhere(
  SUDOKU_PUZZLE.givens,
  (given) => given === 0,
);
const BINAIRO_LAST = lastIndexWhere(BINAIRO.givens, (given) => given === null);
const NONOGRAM_LAST = lastIndexWhere(NONOGRAM_SOLUTION, (mark) => mark === 1);
const QUEENS_LAST = lastIndexWhere(
  QUEENS_PUZZLE.solution,
  (mark) => mark === 1,
);
const CROSSWORD_LAST = lastIndexWhere(
  CROSSWORD_LETTERS,
  (letter) => letter !== null,
);

interface HintedPlay {
  readonly state: {
    readonly hint: HintState<unknown>;
    readonly hydrated: boolean;
  };
  readonly hintReady: boolean;
  readonly revealHint: () => void;
  readonly finish: () => void;
}

interface Case {
  readonly game: PlayRecord["game"];
  readonly useHook: () => HintedPlay;
  readonly oneMoveFromSolved: (hintsUsed: number) => PlayRecord;
}

const HOOKS: readonly Case[] = [
  {
    game: "sudoku",
    useHook: () => {
      const play = useSudokuPlay(SUDOKU);
      return {
        ...play,
        finish: () => {
          play.selectCell(SUDOKU_LAST);
          play.enterDigit(value(SUDOKU_SOLUTION[SUDOKU_LAST]));
        },
      };
    },
    oneMoveFromSolved: (hintsUsed) => ({
      ...HEADER,
      hintsUsed,
      game: "sudoku",
      entries: SUDOKU_PUZZLE.givens.map((given, index) =>
        given === 0 && index !== SUDOKU_LAST
          ? value(SUDOKU_SOLUTION[index])
          : null,
      ),
    }),
  },
  {
    game: "binairo",
    useHook: () => {
      const play = useBinairoPlay(BINAIRO);
      return {
        ...play,
        finish: () => {
          play.toggleMode(value(BINAIRO_PUZZLE.solution[BINAIRO_LAST]));
          play.tapCell(BINAIRO_LAST, "tap");
        },
      };
    },
    oneMoveFromSolved: (hintsUsed) => ({
      ...HEADER,
      hintsUsed,
      game: "binairo",
      entries: BINAIRO.givens.map((given, index) =>
        given === null && index !== BINAIRO_LAST
          ? value(BINAIRO_PUZZLE.solution[index])
          : null,
      ),
    }),
  },
  {
    game: "nonogram",
    useHook: () => {
      const play = useNonogramPlay(NONOGRAM);
      return {
        ...play,
        finish: () => {
          play.selectCell(NONOGRAM_LAST);
          play.enterValue(1);
        },
      };
    },
    oneMoveFromSolved: (hintsUsed) => ({
      ...HEADER,
      hintsUsed,
      game: "nonogram",
      size: NONOGRAM.size,
      entries: NONOGRAM_SOLUTION.map((mark, index) =>
        index === NONOGRAM_LAST ? null : mark,
      ),
    }),
  },
  {
    game: "queens",
    useHook: () => {
      const play = useQueensPlay(QUEENS);
      return {
        ...play,
        finish: () => {
          play.selectCell(QUEENS_LAST);
          play.enterValue(1);
        },
      };
    },
    oneMoveFromSolved: (hintsUsed) => ({
      ...HEADER,
      hintsUsed,
      game: "queens",
      size: QUEENS.size,
      entries: QUEENS_PUZZLE.solution.map((mark, index) =>
        index === QUEENS_LAST ? null : mark,
      ),
    }),
  },
  {
    game: "crossword",
    useHook: () => {
      const play = useCrosswordPlay(CROSSWORD);
      return {
        ...play,
        finish: () => {
          play.selectCell(CROSSWORD_LAST);
          play.typeLetter(
            value(CROSSWORD_LETTERS[CROSSWORD_LAST] ?? undefined),
          );
        },
      };
    },
    oneMoveFromSolved: (hintsUsed) => ({
      ...HEADER,
      hintsUsed,
      game: "crossword",
      entries: CROSSWORD_LETTERS.map((letter, index) =>
        index === CROSSWORD_LAST ? null : letter,
      ),
    }),
  },
];

function allowanceOf(allowance: number | null) {
  return function Allowance({ children }: { children: ReactNode }) {
    return <FreeHintsContext value={allowance}>{children}</FreeHintsContext>;
  };
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

function stubFetch(answer: () => Promise<Response>) {
  const fetchMock = vi.fn(answer);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function deferredFetch() {
  let resolve: (response: Response) => void = () => undefined;
  const fetchMock = stubFetch(
    () =>
      new Promise<Response>((settle) => {
        resolve = settle;
      }),
  );
  return {
    fetchMock,
    answer: (body: unknown) => {
      resolve(jsonResponse(200, body));
    },
  };
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
  it.each(HOOKS)(
    "$game: restores three hints under an allowance of two, offers none, and the completion carries three",
    ({ game, useHook, oneMoveFromSolved }) => {
      vi.useFakeTimers();
      window.localStorage.setItem(
        playRecordKey(game, DATE),
        JSON.stringify(oneMoveFromSolved(3)),
      );

      const { result } = renderHook(useHook, { wrapper: allowanceOf(2) });
      hydrate();

      expect(result.current.state.hint.used).toBe(3);
      expect(result.current.hintReady).toBe(false);
      reveal(result, 1);
      expect(result.current.state.hint.used).toBe(3);

      act(() => {
        result.current.finish();
      });

      expect(sync.flushPendingCompletions).toHaveBeenCalledWith(
        expect.objectContaining({ game, concluded: true, hintsUsed: 3 }),
      );
    },
  );
});

describe("the fetched allowance: loading, then the served value (T-WEB-S541)", () => {
  it("is null while /hints is in flight and the served value after", async () => {
    const { fetchMock, answer } = deferredFetch();

    const { result } = renderHook(useFreeHintsPerPuzzle, {
      wrapper: FetchedFreeHints,
    });
    expect(result.current).toBeNull();

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
    expect(fetchMock).toHaveBeenCalledWith(`${API_URL}/hints`, {
      credentials: "include",
    });
    answer({ freeHintsPerPuzzle: 5 });

    await waitFor(() => {
      expect(result.current).toBe(5);
    });
  });

  it.each(HOOKS)(
    "$game: mounted while loading it offers no hint, then reveals up to the loaded value",
    async ({ useHook }) => {
      const { answer } = deferredFetch();

      const { result } = renderHook(useHook, { wrapper: FetchedFreeHints });
      await waitFor(() => {
        expect(result.current.state.hydrated).toBe(true);
      });
      expect(result.current.hintReady).toBe(false);
      reveal(result, 1);
      expect(result.current.state.hint.used).toBe(0);

      answer({ freeHintsPerPuzzle: 5 });
      await waitFor(() => {
        expect(result.current.hintReady).toBe(true);
      });
      reveal(result, 6);

      expect(result.current.state.hint.used).toBe(5);
      expect(result.current.hintReady).toBe(false);
    },
  );
});

describe("a failed allowance read falls back to the default (T-WEB-S542)", () => {
  const FAILURES: readonly {
    readonly name: string;
    readonly arrange: () => void;
  }[] = [
    {
      name: "a network error",
      arrange: () => stubFetch(() => Promise.reject(new TypeError("down"))),
    },
    {
      name: "a 500",
      arrange: () =>
        stubFetch(() =>
          Promise.resolve(jsonResponse(500, { error: "internal" })),
        ),
    },
    {
      name: "a 404 from an api without the route",
      arrange: () =>
        stubFetch(() => Promise.resolve(new Response("", { status: 404 }))),
    },
    {
      name: "a body outside the contract",
      arrange: () =>
        stubFetch(() =>
          Promise.resolve(jsonResponse(200, { freeHintsPerPuzzle: 10 })),
        ),
    },
    {
      name: "a failed mint",
      arrange: () => {
        bootstrap.ensureSession.mockRejectedValue(new Error("mint"));
        stubFetch(() =>
          Promise.resolve(jsonResponse(200, { freeHintsPerPuzzle: 5 })),
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
        { wrapper: FetchedFreeHints },
      );

      await waitFor(() => {
        expect(result.current.allowance).toBe(FREE_HINTS_PER_PUZZLE);
      });
      expect(result.current.play.hintReady).toBe(true);
    },
  );
});
