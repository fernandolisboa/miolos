import {
  dailyCrosswordResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  dailyNonogramResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  sudokuDigitSchema,
  type DailyBinairoResponse,
} from "@miolos/core";
import { generateBinairo, solveBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  initPlayState,
  playReducer,
  type PlayState,
} from "../src/binairo/state";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordPlayState,
} from "../src/crossword/state";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramPlayState,
} from "../src/nonogram/state";
import { hasHintLeft } from "../src/play/hint-allowance";
import { resetBoard, type ResetAction } from "../src/play/reset-board";
import {
  initQueensPlayState,
  queensPlayReducer,
  type QueensPlayState,
} from "../src/queens/state";
import { solutionDigits } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const DATE = "2026-10-13";
const SEED = 20_261_013;
const RESET: ResetAction = { type: "reset" };

interface BoardCase<S extends { readonly entries: readonly unknown[] }> {
  readonly name: string;
  readonly fresh: S;
  readonly played: S;
  readonly solved: S;
  readonly reduce: (state: S, action: ResetAction) => S;
  readonly useHint: (state: S) => S;
  readonly flagged: ((state: S) => number) | null;
  readonly kept: (state: S) => unknown;
}

function run<S, A>(
  reduce: (state: S, action: A) => S,
  start: S,
  actions: readonly A[],
): S {
  return actions.reduce(reduce, start);
}

const header = {
  v: 1,
  date: DATE,
  elapsedMs: 0,
  hintsUsed: 0,
  concluded: false,
  pendingSync: false,
  syncOutcome: "pending",
} as const;

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: 1 });
const SUDOKU_DAILY = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU.givens,
  tier: SUDOKU.tier,
});
const SUDOKU_SOLUTION = solutionDigits(SUDOKU.givens) ?? [];
const SUDOKU_PLAYABLE = SUDOKU.givens.flatMap((cell, index) =>
  cell === 0 ? [index] : [],
);

function sudokuCase(): BoardCase<SudokuPlayState> {
  const reduce = sudokuPlayReducer;
  const start = initSudokuPlayState(SUDOKU_DAILY);
  const [first = 0, second = 1] = SUDOKU_PLAYABLE;
  const clash = SUDOKU.givens.find(
    (cell, index) =>
      cell !== 0 && Math.floor(index / 9) === Math.floor(second / 9),
  );
  const timed: readonly SudokuPlayAction[] = [
    { type: "resume", now: 1000 },
    { type: "tick", now: 5000 },
    { type: "select", index: first },
    { type: "use-hint", solution: SUDOKU_SOLUTION },
    { type: "select", index: second },
    { type: "enter-digit", digit: sudokuDigitSchema.parse(clash ?? 1) },
  ];
  return {
    name: "sudoku",
    fresh: start,
    played: run(reduce, start, timed),
    solved: reduce(start, {
      type: "restore",
      now: 0,
      record: {
        ...header,
        game: "sudoku",
        entries: SUDOKU_SOLUTION.map((digit, index) =>
          SUDOKU.givens[index] === 0 ? digit : null,
        ),
      },
    }),
    reduce,
    useHint: (state) =>
      reduce(state, { type: "use-hint", solution: SUDOKU_SOLUTION }),
    flagged: (state) => state.violating.size,
    kept: (state) => [state.givens, state.selected, state.tier],
  };
}

const BINAIRO = generateBinairo({ seed: SEED, weekday: 2 });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO.givens],
};
const BINAIRO_SOLUTION = solveBinairo(BINAIRO.givens) ?? [];
const BINAIRO_SIDE = Math.sqrt(BINAIRO.givens.length);
const BINAIRO_PLAYABLE = BINAIRO.givens.flatMap((cell, index) =>
  cell === null ? [index] : [],
);

function binairoCase(): BoardCase<PlayState> {
  const reduce = playReducer;
  const start = initPlayState(BINAIRO_DAILY);
  const [first = 0, second = 1] = BINAIRO_PLAYABLE;
  const played = run(reduce, start, [
    { type: "resume", now: 1000 },
    { type: "tick", now: 5000 },
    { type: "set-mode", value: 1 },
    { type: "tap", index: first, press: "tap" },
    { type: "tap", index: second, press: "tap" },
    { type: "use-hint", solution: BINAIRO_SOLUTION },
    ...BINAIRO_PLAYABLE.filter(
      (index) => index < BINAIRO_SIDE && index !== first && index !== second,
    ).map((index) => ({ type: "tap" as const, index, press: "tap" as const })),
  ]);
  return {
    name: "binairo",
    fresh: start,
    played,
    solved: reduce(start, {
      type: "restore",
      now: 0,
      record: {
        ...header,
        game: "binairo",
        entries: BINAIRO_SOLUTION.map((value, index) =>
          BINAIRO.givens[index] === null ? value : null,
        ),
      },
    }),
    reduce,
    useHint: (state) =>
      reduce(state, { type: "use-hint", solution: BINAIRO_SOLUTION }),
    flagged: (state) => state.violating.size,
    kept: (state) => [state.givens, state.paint],
  };
}

const NONOGRAM = generateNonogram(SEED, 1);
const NONOGRAM_DAILY = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM.size,
  clues: NONOGRAM.clues,
});

function nonogramCase(): BoardCase<NonogramPlayState> {
  const reduce = nonogramPlayReducer;
  const start = initNonogramPlayState(NONOGRAM_DAILY);
  const picture = start.solution ?? [];
  const played = run(reduce, start, [
    { type: "resume", now: 1000 },
    { type: "tick", now: 5000 },
    { type: "set-brush", brush: "cross" },
    { type: "mark-cell", index: 0, press: "tap" },
    { type: "mark-cell", index: 1, press: "tap" },
    { type: "use-hint" },
  ]);
  return {
    name: "nonogram",
    fresh: start,
    played,
    solved: reduce(start, {
      type: "restore",
      now: 0,
      record: {
        ...header,
        game: "nonogram",
        size: NONOGRAM_DAILY.size,
        entries: picture.map((mark) => (mark === 1 ? 1 : null)),
      },
    }),
    reduce,
    useHint: (state) => reduce(state, { type: "use-hint" }),
    flagged: null,
    kept: (state) => [state.clues, state.selected, state.brush],
  };
}

const QUEENS = generateQueens({ seed: SEED, weekday: 1 });
const QUEENS_DAILY = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: QUEENS.size,
  regions: QUEENS.regions,
});

function queensCase(): BoardCase<QueensPlayState> {
  const reduce = queensPlayReducer;
  const start = initQueensPlayState(QUEENS_DAILY);
  const played = run(reduce, start, [
    { type: "resume", now: 1000 },
    { type: "tick", now: 5000 },
    { type: "use-hint" },
    { type: "tap", index: 0, press: "tap" },
    { type: "tap", index: 0, press: "tap" },
    { type: "tap", index: 1, press: "tap" },
    { type: "tap", index: 1, press: "tap" },
  ]);
  return {
    name: "queens",
    fresh: start,
    played,
    solved: reduce(start, {
      type: "restore",
      now: 0,
      record: {
        ...header,
        game: "queens",
        size: QUEENS_DAILY.size,
        entries: QUEENS.solution.map((mark) => (mark === 1 ? 1 : null)),
      },
    }),
    reduce,
    useHint: (state) => reduce(state, { type: "use-hint" }),
    flagged: (state) => state.conflicts.size,
    kept: (state) => [state.regions, state.selected],
  };
}

const CROSSWORD_DAILY = dailyCrosswordResponseSchema.parse({
  game: "crossword",
  date: DATE,
  grid: [
    ["c", "a", "t", null, null],
    ["a", null, "o", null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
    [null, null, null, null, null],
  ],
  clues: [
    { number: 1, direction: "across", row: 0, col: 0, length: 3, clue: "a" },
    { number: 1, direction: "down", row: 0, col: 0, length: 2, clue: "b" },
    { number: 2, direction: "down", row: 0, col: 2, length: 2, clue: "c" },
  ],
});

function crosswordCase(): BoardCase<CrosswordPlayState> {
  const reduce = crosswordPlayReducer;
  const start = initCrosswordPlayState(CROSSWORD_DAILY);
  const played = run(reduce, start, [
    { type: "resume", now: 1000 },
    { type: "tick", now: 5000 },
    { type: "select-entry", index: 0, direction: "down" },
    { type: "type-letter", letter: "x" },
    { type: "select", index: 2 },
    { type: "use-hint" },
  ]);
  return {
    name: "crossword",
    fresh: start,
    played,
    solved: reduce(start, {
      type: "restore",
      now: 0,
      record: {
        ...header,
        game: "crossword",
        entries: [...start.solution],
      },
    }),
    reduce,
    useHint: (state) => reduce(state, { type: "use-hint" }),
    flagged: null,
    kept: (state) => [
      state.solution,
      state.clues,
      state.selected,
      state.direction,
    ],
  };
}

function registerCase<S extends Parameters<typeof resetBoard>[0]>(
  board: BoardCase<S>,
): void {
  describe(board.name, () => {
    const { played } = board;
    const after = board.reduce(played, RESET);

    it("starts from a board with decided cells, a spent hint and a running clock", () => {
      expect(played.entries.some((entry) => entry !== null)).toBe(true);
      expect(played.hint.used).toBe(1);
      expect(played.timer.runningSince).not.toBeNull();
      if (board.flagged !== null) {
        expect(board.flagged(played)).toBeGreaterThan(0);
      }
    });

    it("undecides every cell and leaves the givens, status and flags clean", () => {
      expect(after.entries.every((entry) => entry === null)).toBe(true);
      expect(after.entries).toHaveLength(played.entries.length);
      expect(after.status).toBe("playing");
      expect(board.kept(after)).toEqual(board.kept(played));
      if (board.flagged !== null) {
        expect(board.flagged(after)).toBe(0);
      }
    });

    it("keeps the hint spent, the clock and the sync flag, and drops the hinted cell", () => {
      expect(after.hint).toMatchObject({
        used: played.hint.used,
        lastIndex: null,
      });
      expect(after.timer).toBe(played.timer);
      expect(after.now).toBe(played.now);
      expect(after.pendingSync).toBe(played.pendingSync);
    });

    it("does not refund a hint: the count carries on, and a spent cap stays spent", () => {
      expect(board.useHint(after).hint.used).toBe(played.hint.used + 1);
      let spent = played;
      for (let i = played.hint.used; i < FREE_HINTS_PER_PUZZLE; i += 1) {
        spent = board.useHint(spent);
      }
      const cleared = board.reduce(spent, RESET);
      expect(cleared.status).toBe("playing");
      expect(cleared.hint.used).toBe(FREE_HINTS_PER_PUZZLE);
      expect(hasHintLeft(cleared.hint.used, FREE_HINTS_PER_PUZZLE)).toBe(false);
    });

    it("returns the same object when no cell is decided and on a solved board", () => {
      expect(board.reduce(board.fresh, RESET)).toBe(board.fresh);
      expect(board.solved.status).toBe("solved");
      expect(board.reduce(board.solved, RESET)).toBe(board.solved);
    });
  });
}

describe("Recomeçar clears the board and refunds nothing (T-WEB-S514)", () => {
  registerCase(sudokuCase());
  registerCase(binairoCase());
  registerCase(nonogramCase());
  registerCase(queensCase());
  registerCase(crosswordCase());
});
