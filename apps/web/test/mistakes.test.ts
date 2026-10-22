import {
  dailyCrosswordResponseSchema,
  dailyNonogramResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  type DailyBinairoResponse,
} from "@miolos/core";
import { generateBinairo, solveBinairo } from "@miolos/games/binairo";
import { generateColoredNonogram } from "@miolos/games/colored-nonogram";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  BINAIRO_MISTAKES,
  initPlayState,
  playReducer,
  type PlayAction,
  type PlayState,
} from "../src/binairo/state";
import {
  coloredNonogramReducers,
  initColoredNonogramState,
} from "../src/colored-nonogram/state";
import {
  CROSSWORD_MISTAKES,
  crosswordPlayReducer,
  initCrosswordPlayState,
} from "../src/crossword/state";
import {
  initNonogramPlayState,
  nonogramReducers,
  type NonogramPlayAction,
} from "../src/nonogram/state";
import { wrongWrite } from "../src/play/grid-hint";
import {
  mistakeRecord,
  NO_MISTAKES,
  SOLUTION_MISTAKES,
  withMistakes,
  type MistakeRules,
} from "../src/play/mistakes";
import {
  binairoPlayRecordSchema,
  crosswordPlayRecordSchema,
  nonogramPlayRecordSchema,
  queensPlayRecordSchema,
  sudokuPlayRecordSchema,
  type PlayRecord,
} from "../src/play/play-record";
import type { Editable, UndoAction } from "../src/play/undo";
import {
  autoCrossingReducer,
  initQueensPlayState,
  QUEENS_MISTAKES,
  queensPlayReducer,
  type QueensPlayAction,
} from "../src/queens/state";
import { solutionDigits } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuMistakes,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const DATE = "2026-10-16";
const SEED = 20_261_016;
const UNDO: UndoAction = { type: "undo" };
const REDO: UndoAction = { type: "redo" };
const RESET = { type: "reset" } as const;
const RESTORE = { type: "restore", record: undefined, now: 0 } as const;

function limited<S extends Editable, A extends { readonly type: string }>(
  reduce: (state: S, action: A) => S,
  rules: MistakeRules<S, A>,
  enabled = true,
): (state: S, ...actions: readonly A[]) => S {
  const reducer = withMistakes(reduce, rules, enabled);
  return (state, ...actions) => actions.reduce(reducer, state);
}

function defined<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) {
    throw new Error(`${what} is missing`);
  }
  return value;
}

const SUDOKU = generateDailySudoku({ seed: SEED, weekday: 1 });
const SUDOKU_DAILY = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: DATE,
  givens: SUDOKU.givens,
  tier: SUDOKU.tier,
});
const SUDOKU_SOLUTION = defined(solutionDigits(SUDOKU.givens), "solution");
const SUDOKU_RULES = sudokuMistakes(SUDOKU_SOLUTION, SUDOKU.givens);
const sudoku = limited(sudokuPlayReducer, SUDOKU_RULES);
const SUDOKU_OPEN = SUDOKU.givens.flatMap((given, index) =>
  given === 0 ? [index] : [],
);
const [S0 = 0, S1 = 0, S2 = 0, S3 = 0] = SUDOKU_OPEN;

const sudokuBoard = (): SudokuPlayState =>
  sudoku(initSudokuPlayState(SUDOKU_DAILY), RESTORE);

const rightDigit = (index: number) => SUDOKU_SOLUTION[index] as SudokuDigit;
const wrongDigit = (index: number) =>
  ((rightDigit(index) % 9) + 1) as SudokuDigit;

const write = (
  index: number,
  digit: SudokuDigit,
  pointer?: true,
): SudokuPlayAction[] => [
  { type: "select", index },
  { type: "enter-digit", digit, cleanNotes: true, ...(pointer && { pointer }) },
];

const BINAIRO = generateBinairo({ seed: SEED, weekday: 1 });
const BINAIRO_DAILY: DailyBinairoResponse = {
  game: "binairo",
  date: DATE,
  size: 8,
  givens: [...BINAIRO.givens],
};
const BINAIRO_SOLUTION = defined(solveBinairo(BINAIRO.givens), "solution");
const binairo = limited<PlayState, PlayAction | UndoAction>(
  playReducer,
  BINAIRO_MISTAKES,
);
const BINAIRO_OPEN = BINAIRO.givens.flatMap((given, index) =>
  given === null ? [index] : [],
);
const [B0 = 0, B1 = 0] = BINAIRO_OPEN;
const binairoBoard = () =>
  binairo(initPlayState(BINAIRO_DAILY, BINAIRO_SOLUTION), RESTORE);
const cycleTap = (index: number, first: 0 | 1): PlayAction => ({
  type: "tap",
  index,
  press: "tap",
  first,
});
const binairoRight = (index: number) => BINAIRO_SOLUTION[index] ?? 0;
const binairoWrong = (index: number) => (binairoRight(index) === 1 ? 0 : 1);

const NONOGRAM = generateNonogram(SEED, 1);
const NONOGRAM_DAILY = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM.size,
  clues: NONOGRAM.clues,
});
const nonogram = limited(nonogramReducers.off, SOLUTION_MISTAKES);
const nonogramBoard = () =>
  nonogram(initNonogramPlayState(NONOGRAM_DAILY), RESTORE);
const NONOGRAM_SOLUTION = defined(
  nonogramBoard().solution,
  "nonogram solution",
);
const NONOGRAM_EMPTY = NONOGRAM_SOLUTION.flatMap((mark, index) =>
  mark === 0 ? [index] : [],
);
const NONOGRAM_FILLED = NONOGRAM_SOLUTION.flatMap((mark, index) =>
  mark === 1 ? [index] : [],
);
const mark = (index: number): NonogramPlayAction => ({
  type: "mark-cell",
  index,
  press: "tap",
});

const QUEENS = generateQueens({ seed: SEED, weekday: 1 });
const QUEENS_DAILY = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: QUEENS.size,
  regions: QUEENS.regions,
});
const queens = limited(queensPlayReducer, QUEENS_MISTAKES);
const crossing = limited(autoCrossingReducer, QUEENS_MISTAKES);
const queensBoard = () => queens(initQueensPlayState(QUEENS_DAILY), RESTORE);
const QUEENS_SOLUTION = defined(queensBoard().solution, "queens solution");
const NOT_QUEEN = QUEENS_SOLUTION.flatMap((cell, index) =>
  cell === 0 ? [index] : [],
);
const QUEEN = QUEENS_SOLUTION.flatMap((cell, index) =>
  cell === 1 ? [index] : [],
);
const tapQueen = (index: number): QueensPlayAction => ({
  type: "tap",
  index,
  press: "tap",
});
const rightClick = (index: number): QueensPlayAction => ({
  type: "tap",
  index,
  press: "right",
});

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
const crossword = limited(crosswordPlayReducer, CROSSWORD_MISTAKES);

describe("wrongWrite finds the first new wrong fill, queen, digit, value or letter (T-WEB-S840)", () => {
  const solution = [1, 0, 1, 0];

  it("ignores givens, erasing and correct values", () => {
    expect(
      wrongWrite(
        solution,
        [1, null, null, null],
        [null, null, null, null],
        [0, null, null, null],
        undefined,
      ),
    ).toBeNull();
    expect(
      wrongWrite(
        solution,
        null,
        [0, null, null, null],
        [null, null, null, null],
        undefined,
      ),
    ).toBeNull();
    expect(
      wrongWrite(
        solution,
        null,
        [null, null, null, null],
        [1, 0, 1, null],
        undefined,
      ),
    ).toBeNull();
  });

  it("never counts a cross, on a Nonogram fill or a Rainhas queen", () => {
    expect(
      wrongWrite(
        solution,
        null,
        [null, null, null, null],
        [0, null, null, null],
        0,
      ),
    ).toBeNull();
    const filled = defined(NONOGRAM_FILLED[0], "a filled cell");
    const crossed = nonogram(
      nonogramBoard(),
      { type: "set-brush", brush: "cross" },
      mark(filled),
    );
    expect(crossed.entries[filled]).toBe(0);
    expect(crossed.mistakes.cells).toEqual([]);
    const queen = defined(QUEEN[0], "a queen cell");
    expect(
      queens(
        queensBoard(),
        tapQueen(queen),
        tapQueen(defined(QUEEN[1], "a second queen")),
      ).mistakes.cells,
    ).toEqual([]);
  });

  it("counts a Binairo 0 that should be 1, and the first changed cell only", () => {
    expect(
      wrongWrite(
        solution,
        null,
        [null, null, null, null],
        [0, 1, null, null],
        undefined,
      ),
    ).toBe(0);
    expect(
      wrongWrite(
        solution,
        null,
        [0, null, null, null],
        [0, 1, null, null],
        undefined,
      ),
    ).toBe(1);
  });
});

describe("a gesture counts at most one mistake, and undo, restore, hints and notes count none (T-WEB-S841)", () => {
  it("counts one Nonogram drag over many wrong cells once, and two taps twice", () => {
    const [a = 0, b = 0, c = 0] = NONOGRAM_EMPTY;
    const dragged = nonogram(
      nonogramBoard(),
      { type: "stroke-start", index: a, press: "tap" },
      { type: "paint-over", index: b },
      { type: "paint-over", index: c },
    );
    expect([a, b, c].map((index) => dragged.entries[index])).toEqual([1, 1, 1]);
    expect(dragged.mistakes.cells).toEqual([a]);

    const tapped = nonogram(nonogramBoard(), mark(a), mark(b));
    expect(tapped.mistakes.cells).toEqual([a, b]);
  });

  it("counts one drag once even when the clock ticks inside it", () => {
    const [a = 0, b = 0, c = 0, d = 0] = NONOGRAM_EMPTY;
    const ticked = nonogram(
      nonogramBoard(),
      { type: "stroke-start", index: a, press: "tap" },
      { type: "paint-over", index: b },
      { type: "tick", now: 1_000 },
      { type: "paint-over", index: c },
      { type: "pause", now: 2_000 },
      { type: "resume", now: 3_000 },
      { type: "paint-over", index: d },
    );
    expect(ticked.mistakes.cells).toEqual([a]);
  });

  it("counts a later drag after a counted one", () => {
    const [a = 0, b = 0, c = 0] = NONOGRAM_EMPTY;
    const twice = nonogram(
      nonogramBoard(),
      { type: "stroke-start", index: a, press: "tap" },
      { type: "paint-over", index: b },
      { type: "stroke-start", index: c, press: "tap" },
    );
    expect(twice.mistakes.cells).toEqual([a, c]);
  });

  it("counts a wrong Rainhas queen once, its automatic crosses never", () => {
    const wrong = defined(NOT_QUEEN[0], "a non-queen cell");
    const placed = crossing(queensBoard(), rightClick(wrong));
    expect(placed.entries[wrong]).toBe(1);
    expect(
      placed.entries.filter((entry) => entry === 0).length,
    ).toBeGreaterThan(0);
    expect(placed.mistakes.cells).toEqual([wrong]);
  });

  it("never refunds on undo, and counts nothing for undo, restore, hints or notes", () => {
    const wrong = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0)));
    expect(wrong.mistakes.cells).toEqual([S0]);

    const undone = sudoku(wrong, UNDO);
    expect(undone.entries[S0]).toBeNull();
    expect(undone.mistakes.cells).toEqual([S0]);

    const hinted = sudoku(wrong, {
      type: "use-hint",
      solution: SUDOKU_SOLUTION,
      cleanNotes: true,
    });
    expect(hinted.hint.used).toBe(1);
    expect(hinted.mistakes.cells).toEqual([S0]);

    const noted = sudoku(
      sudokuBoard(),
      { type: "select", index: S1 },
      { type: "toggle-note", digit: wrongDigit(S1) },
    );
    expect(noted.mistakes).toBe(NO_MISTAKES);

    expect(sudoku(wrong, RESTORE).mistakes).toBe(wrong.mistakes);
  });
});

describe("redo neither counts a mistake nor refunds one, and a frozen board has none (T-WEB-S961)", () => {
  it("puts a counted wrong digit back without counting it again", () => {
    const wrong = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0)));
    const redone = sudoku(wrong, UNDO, REDO);
    expect(redone.entries[S0]).toBe(wrongDigit(S0));
    expect(redone.mistakes.cells).toEqual([S0]);
    expect(sudoku(redone, UNDO).mistakes.cells).toEqual([S0]);
  });

  it("re-arms a held write on redo, so undo then redo never makes it free", () => {
    const held = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0), true));
    expect(held.mistakes.held).toEqual({ index: S0, before: null });

    const redone = sudoku(held, UNDO, { type: "select", index: S3 }, REDO);
    expect(redone.entries[S0]).toBe(wrongDigit(S0));
    expect(redone.mistakes.held).toEqual({ index: S0, before: null });
    expect(sudoku(redone, ...write(S1, rightDigit(S1))).mistakes.cells).toEqual(
      [S0],
    );

    const moved = sudoku(
      held,
      UNDO,
      ...write(S1, rightDigit(S1)),
      ...write(S2, rightDigit(S2)),
    );
    expect(moved.mistakes).toMatchObject({
      cells: [],
      held: null,
      parked: null,
    });
  });

  it("re-arms only on the redo of the held write, never an older one", () => {
    const written = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0)),
      { type: "clear-cell" },
      ...write(S0, ((wrongDigit(S0) % 9) + 1) as SudokuDigit, true),
    );
    expect(written.mistakes.cells).toEqual([S0]);
    const older = sudoku(written, UNDO, UNDO, UNDO, REDO);
    expect(older.entries[S0]).toBe(wrongDigit(S0));
    expect(older.mistakes.held).toBeNull();
    expect(sudoku(older, ...write(S1, rightDigit(S1))).mistakes.cells).toEqual([
      S0,
    ]);
  });

  it("never re-arms a hold on the redo of a move written after its undo", () => {
    const other = ((wrongDigit(S0) % 9) + 1) as SudokuDigit;
    const rewritten = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      UNDO,
      ...write(S0, other),
      UNDO,
      REDO,
    );
    expect(rewritten.entries[S0]).toBe(other);
    expect(rewritten.mistakes).toMatchObject({
      cells: [S0],
      held: null,
      parked: null,
    });
    expect(
      sudoku(rewritten, ...write(S1, rightDigit(S1))).mistakes.cells,
    ).toEqual([S0]);
  });

  it("keeps a parked hold across a Número fixo double tap that gives redo back", () => {
    const held = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0), true));
    const undone = sudoku(held, UNDO);
    const tapped = sudoku(
      undone,
      ...write(S0, rightDigit(S0), true),
      { type: "unlock" },
      {
        type: "lock-digit",
        digit: rightDigit(S0),
        undo: { index: S0, value: null, notes: undone.notes },
      },
    );
    expect(tapped.history.redo).toHaveLength(1);
    const redone = sudoku(tapped, REDO);
    expect(redone.entries[S0]).toBe(wrongDigit(S0));
    expect(sudoku(redone, ...write(S1, rightDigit(S1))).mistakes.cells).toEqual(
      [S0],
    );
  });

  it("clears redo on a Recomeçar that only reset the count", () => {
    const undone = sudoku(
      sudokuBoard(),
      ...write(S1, rightDigit(S1)),
      ...write(S0, wrongDigit(S0)),
      UNDO,
      UNDO,
    );
    expect(undone.mistakes.cells).toEqual([S0]);
    const reset = sudoku(undone, RESET);
    expect(reset.mistakes.cells).toEqual([]);
    expect(reset.history.redo).toHaveLength(0);
    expect(sudoku(reset, REDO, REDO).entries[S0]).toBeNull();
  });

  it("drops redo on a frozen board", () => {
    const board = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0)),
      ...write(S1, wrongDigit(S1)),
      ...write(S2, wrongDigit(S2)),
    );
    const withRedo = {
      ...board,
      history: { ...board.history, redo: board.history.steps.slice(-1) },
    };
    expect(sudoku(withRedo, REDO)).toBe(withRedo);
  });
});

describe("a held tap is judged when the player leaves its cell (T-WEB-S842)", () => {
  it("counts nothing when a Binairo cycle passes a wrong value on the way to the right one", () => {
    const passed = binairo(
      binairoBoard(),
      cycleTap(B0, binairoWrong(B0)),
      cycleTap(B0, binairoWrong(B0)),
      cycleTap(B1, binairoRight(B1)),
    );
    expect(passed.entries[B0]).toBe(binairoRight(B0));
    expect(passed.mistakes.cells).toEqual([]);
  });

  it("counts once a Binairo cell left wrong, when the next write lands elsewhere", () => {
    const held = binairo(binairoBoard(), cycleTap(B0, binairoWrong(B0)));
    expect(held.mistakes).toMatchObject({ cells: [], held: { index: B0 } });
    const left = binairo(held, cycleTap(B1, binairoRight(B1)));
    expect(left.mistakes.cells).toEqual([B0]);
    expect(left.mistakes.held).toEqual({ index: B1, before: null });
  });

  it("judges the held cell first when a hint lands", () => {
    const hinted = binairo(binairoBoard(), cycleTap(B0, binairoWrong(B0)), {
      type: "use-hint",
    });
    expect(hinted.hint.used).toBe(1);
    expect(hinted.mistakes.cells).toEqual([B0]);
  });

  it("keeps the hold through undo, and ends it uncounted once undo brings the old value back", () => {
    const twice = binairo(
      binairoBoard(),
      cycleTap(B0, binairoWrong(B0)),
      cycleTap(B0, binairoWrong(B0)),
    );
    const back = binairo(twice, UNDO);
    expect(back.entries[B0]).toBe(binairoWrong(B0));
    expect(back.mistakes.held).toEqual({ index: B0, before: null });
    const cleared = binairo(back, UNDO);
    expect(cleared.mistakes).toMatchObject({ cells: [], held: null });
    expect(
      binairo(back, cycleTap(B1, binairoRight(B1))).mistakes.cells,
    ).toEqual([B0]);
  });

  it("counts nothing when the automatic ✕ is on and a ✕ is tapped twice back to empty", () => {
    const cell = defined(NOT_QUEEN[0], "a non-queen cell");
    const crossed = crossing(queensBoard(), {
      type: "stroke-start",
      index: cell,
      press: "tap",
    });
    expect(crossed.entries[cell]).toBe(0);
    const cleared = crossing(crossed, tapQueen(cell), tapQueen(cell));
    expect(cleared.entries[cell]).toBeNull();
    const next = crossing(cleared, rightClick(defined(QUEEN[0], "a queen")));
    expect(next.mistakes.cells).toEqual([]);
    expect(next.entries[defined(QUEEN[0], "a queen")]).toBe(1);
  });

  it("counts nothing for a Número fixo double tap, and once for a pointer digit left wrong", () => {
    const lockedBack = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      {
        type: "lock-digit",
        digit: wrongDigit(S0),
        undo: { index: S0, value: null, notes: sudokuBoard().notes },
      },
      ...write(S1, rightDigit(S1)),
    );
    expect(lockedBack.entries[S0]).toBeNull();
    expect(lockedBack.mistakes.cells).toEqual([]);

    const leftWrong = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      ...write(S1, rightDigit(S1)),
    );
    expect(leftWrong.mistakes.cells).toEqual([S0]);

    const notedElsewhere = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      { type: "select", index: S1 },
      { type: "toggle-note", digit: wrongDigit(S1) },
    );
    expect(notedElsewhere.mistakes.cells).toEqual([S0]);
  });

  it("replaces the hold, uncounted, when a direct write lands on the held cell", () => {
    const keyed = binairo(binairoBoard(), cycleTap(B0, binairoWrong(B0)), {
      type: "tap",
      index: B0,
      press: "right",
      first: binairoWrong(B0),
    });
    expect(keyed.mistakes.held).toBeNull();
  });
});

describe("three mistakes freeze the board until Recomeçar (T-WEB-S843)", () => {
  const frozen = () =>
    sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0)),
      ...write(S1, wrongDigit(S1)),
      ...write(S2, wrongDigit(S2)),
    );

  it("drops writes, notes, hints and undo, but keeps selection and the clock", () => {
    const board = frozen();
    expect(board.mistakes.cells).toEqual([S0, S1, S2]);
    expect(board.status).toBe("playing");
    expect(
      sudoku(board, { type: "enter-digit", digit: 1, cleanNotes: true }),
    ).toBe(board);
    expect(
      sudoku(board, {
        type: "use-hint",
        solution: SUDOKU_SOLUTION,
        cleanNotes: true,
      }),
    ).toBe(board);
    expect(sudoku(board, UNDO)).toBe(board);
    const selected = sudoku(board, { type: "select", index: S3 });
    expect(selected.selected).toBe(S3);
    expect(sudoku(selected, { type: "toggle-note", digit: 1 })).toBe(selected);
    expect(sudoku(board, { type: "tick", now: 5000 }).now).toBe(5000);
  });

  it("drops the action whose held judgement is the third mistake", () => {
    const B2 = defined(BINAIRO_OPEN[2], "a third open cell");
    const B3 = defined(BINAIRO_OPEN[3], "a fourth open cell");
    const counted = binairo(
      binairoBoard(),
      cycleTap(B0, binairoWrong(B0)),
      cycleTap(B1, binairoWrong(B1)),
      cycleTap(B2, binairoWrong(B2)),
    );
    expect(counted.mistakes.cells).toEqual([B0, B1]);
    const third = binairo(counted, cycleTap(B3, binairoRight(B3)));
    expect(third.mistakes.cells).toEqual([B0, B1, B2]);
    expect(third.entries[B3]).toBeNull();
    expect(third.mistakes.held).toBeNull();
  });

  it("unfreezes on Recomeçar, which clears the board and the count", () => {
    const reset = sudoku(frozen(), RESET);
    expect(reset.entries.every((entry) => entry === null)).toBe(true);
    expect(reset.mistakes).toEqual(NO_MISTAKES);
    expect(sudoku(reset, ...write(S0, rightDigit(S0))).entries[S0]).toBe(
      rightDigit(S0),
    );
  });

  it("clears the count on an empty board too", () => {
    const erased = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0)), {
      type: "clear-cell",
    });
    expect(erased.entries[S0]).toBeNull();
    expect(erased.mistakes.cells).toEqual([S0]);
    expect(sudoku(erased, RESET).mistakes).toEqual(NO_MISTAKES);
  });

  it("with the switch off counts nothing, takes writes on a frozen board and keeps the count", () => {
    const off = limited(sudokuPlayReducer, SUDOKU_RULES, false);
    const board = frozen();
    const written = off(board, ...write(S3, wrongDigit(S3)));
    expect(written.entries[S3]).toBe(wrongDigit(S3));
    expect(written.mistakes.cells).toEqual([S0, S1, S2]);
    expect(off(sudokuBoard(), ...write(S0, wrongDigit(S0))).mistakes).toBe(
      NO_MISTAKES,
    );
  });
});

describe("a Número fixo note tap in Rascunho counts nothing itself (T-WEB-S934)", () => {
  const notedTap = (index: number): SudokuPlayAction[] => [
    { type: "tap-cell", index, cleanNotes: true },
  ];
  const lockedInRascunho = (digit: SudokuDigit): SudokuPlayAction[] => [
    { type: "toggle-noting" },
    { type: "lock-digit", digit, undo: null },
  ];

  it("notes uncounted, and settles a pointer digit left wrong elsewhere", () => {
    const clean = sudoku(
      sudokuBoard(),
      ...lockedInRascunho(1),
      ...notedTap(S0),
    );
    expect(clean.notes[S0]).not.toBe(0);
    expect(clean.mistakes.cells).toEqual([]);

    const leftWrong = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      ...lockedInRascunho(1),
      ...notedTap(S1),
    );
    expect(leftWrong.mistakes.cells).toEqual([S0]);
    expect(leftWrong.notes[S1]).not.toBe(0);
  });

  it("drops the note tap whose held judgement is the third mistake", () => {
    const two = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0)),
      ...write(S1, wrongDigit(S1)),
      ...write(S2, wrongDigit(S2), true),
    );
    expect(two.mistakes.cells).toEqual([S0, S1]);
    const third = sudoku(two, ...lockedInRascunho(1), ...notedTap(S3));
    expect(third.mistakes.cells).toEqual([S0, S1, S2]);
    expect(third.notes[S3]).toBe(0);
  });
});

describe("the play record keeps one to three counted cells, never on a closed board (T-WEB-S844)", () => {
  const header = {
    v: 1,
    date: DATE,
    elapsedMs: 0,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
  } as const;
  const sudokuRecord = (mistakes: unknown) =>
    sudokuPlayRecordSchema.safeParse({
      ...header,
      game: "sudoku",
      entries: Array.from({ length: 81 }, () => null),
      mistakes,
    }).success;

  it("takes one to three in-range indices and refuses none, four or one off the board", () => {
    expect(sudokuRecord([0])).toBe(true);
    expect(sudokuRecord([0, 80, 80])).toBe(true);
    expect(sudokuRecord(undefined)).toBe(true);
    expect(sudokuRecord([])).toBe(false);
    expect(sudokuRecord([0, 1, 2, 3])).toBe(false);
    expect(sudokuRecord([81])).toBe(false);
    expect(
      binairoPlayRecordSchema.safeParse({
        ...header,
        game: "binairo",
        entries: Array.from({ length: 64 }, () => null),
        mistakes: [64],
      }).success,
    ).toBe(false);
    const sized = (
      schema: typeof nonogramPlayRecordSchema | typeof queensPlayRecordSchema,
      game: "nonogram" | "queens",
      size: number,
      mistakes: number[],
    ) =>
      schema.safeParse({
        ...header,
        game,
        size,
        entries: Array.from({ length: size ** 2 }, () => null),
        mistakes,
      }).success;
    expect(sized(nonogramPlayRecordSchema, "nonogram", 5, [24])).toBe(true);
    expect(sized(nonogramPlayRecordSchema, "nonogram", 5, [25])).toBe(false);
    expect(sized(queensPlayRecordSchema, "queens", 7, [49])).toBe(false);
    const crosswordRecord = (mistakes: number[]) =>
      crosswordPlayRecordSchema.safeParse({
        ...header,
        game: "crossword",
        entries: Array.from({ length: 25 }, () => null),
        mistakes,
      }).success;
    expect(crosswordRecord([24])).toBe(true);
    expect(crosswordRecord([25])).toBe(false);
  });

  it("restores the counted cells, a repeat included, and refuses a record that does not fit the board", () => {
    const record: PlayRecord = {
      ...header,
      game: "sudoku",
      entries: Array.from({ length: 81 }, () => null),
      mistakes: [S0, S0],
    };
    const restored = sudoku(initSudokuPlayState(SUDOKU_DAILY), {
      type: "restore",
      record,
      now: 0,
    });
    expect(restored.mistakes.cells).toEqual([S0, S0]);

    const otherSize = NONOGRAM.size === 5 ? 10 : 5;
    const misfit = nonogramPlayRecordSchema.parse({
      ...header,
      game: "nonogram",
      size: otherSize,
      entries: Array.from({ length: otherSize ** 2 }, () => null),
      mistakes: [0],
    });
    const refused = nonogram(initNonogramPlayState(NONOGRAM_DAILY), {
      type: "restore",
      record: misfit,
      now: 0,
    });
    expect(refused.mistakes).toBe(NO_MISTAKES);
  });

  it("omits the field with no mistake and on a closed board", () => {
    const board = sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0)));
    expect(mistakeRecord(sudokuBoard(), false)).toBeUndefined();
    expect(mistakeRecord(board, false)).toEqual([S0]);
    expect(mistakeRecord(board, true)).toBeUndefined();
  });
});

describe("one wrong write takes one mark in every limited game, daily and free (T-WEB-S848)", () => {
  const COLORED = generateColoredNonogram(20_260_801, 10);
  const toned = COLORED.solution.findIndex((tone) => tone !== 0);
  const otherTone = COLORED.solution[toned] === 1 ? 2 : 1;

  it.each([
    ["Sudoku", () => sudoku(sudokuBoard(), ...write(S0, wrongDigit(S0))), [S0]],
    [
      "Binairo",
      () =>
        binairo(binairoBoard(), {
          type: "tap",
          index: B0,
          press: "right",
          first: binairoRight(B0),
        }),
      [B0],
    ],
    [
      "Nonogram",
      () =>
        nonogram(nonogramBoard(), mark(defined(NONOGRAM_EMPTY[0], "empty"))),
      [NONOGRAM_EMPTY[0]],
    ],
    [
      "Rainhas",
      () =>
        queens(queensBoard(), rightClick(defined(NOT_QUEEN[0], "not queen"))),
      [NOT_QUEEN[0]],
    ],
    [
      "Cruzadinha",
      () =>
        crossword(
          initCrosswordPlayState(CROSSWORD_DAILY),
          RESTORE,
          { type: "select", index: 0 },
          { type: "type-letter", letter: "x", skipFilled: false },
        ),
      [0],
    ],
    [
      "Cores",
      () =>
        limited(coloredNonogramReducers.off, SOLUTION_MISTAKES)(
          initColoredNonogramState({ date: DATE, ...COLORED }),
          RESTORE,
          { type: "set-brush", brush: "cross" },
          { type: "mark-cell", index: toned, press: "tap" },
          { type: "mark-cell", index: toned, press: "tap" },
          { type: "set-tone", tone: otherTone },
          { type: "mark-cell", index: toned, press: "tap" },
        ),
      [toned],
    ],
  ] as const)("%s", (_game, play, cells) => {
    expect(play().mistakes.cells).toEqual(cells);
  });
});

describe("a held tap that fills the last cell (T-WEB-S849)", () => {
  const allButLast = () => {
    const last = defined(BINAIRO_OPEN.at(-1), "an open cell");
    const filled = binairo(
      binairoBoard(),
      ...BINAIRO_OPEN.slice(0, -1).map((index): PlayAction => ({
        type: "tap",
        index,
        press: "right",
        first: binairoRight(index) === 1 ? 0 : 1,
      })),
    );
    return { filled, last };
  };

  it("solves uncounted when it is right, and closes with no mistakes field", () => {
    const { filled, last } = allButLast();
    expect(
      BINAIRO_OPEN.slice(0, -1).every(
        (index) => filled.entries[index] === binairoRight(index),
      ),
    ).toBe(true);
    const solved = binairo(filled, cycleTap(last, binairoRight(last)));
    expect(solved.status).toBe("solved");
    expect(solved.mistakes).toMatchObject({ cells: [], held: null });
    expect(mistakeRecord(solved, true)).toBeUndefined();
  });

  it("stays held when it is wrong, can still solve uncounted, and counts once the player leaves", () => {
    const { filled, last } = allButLast();
    const wrong = binairo(filled, cycleTap(last, binairoWrong(last)));
    expect(wrong.status).toBe("playing");
    expect(wrong.mistakes).toMatchObject({ cells: [], held: { index: last } });

    const fixed = binairo(wrong, cycleTap(last, binairoWrong(last)));
    expect(fixed.status).toBe("solved");
    expect(fixed.mistakes.cells).toEqual([]);

    const other = defined(BINAIRO_OPEN[0], "another open cell");
    const left = binairo(wrong, {
      type: "tap",
      index: other,
      press: "right",
      first: binairoRight(other) === 1 ? 0 : 1,
    });
    expect(left.mistakes.cells).toEqual([last]);
  });
});

describe("a Número fixo switch tap judges nothing (T-WEB-S951)", () => {
  const given = SUDOKU.givens.findIndex((cell) => cell !== 0);
  const shown = SUDOKU.givens[given] as SudokuDigit;

  it("leaves a held wrong write waiting, and the next write elsewhere counts it", () => {
    const switched = sudoku(
      sudokuBoard(),
      ...write(S0, wrongDigit(S0), true),
      {
        type: "lock-digit",
        digit: ((shown % 9) + 1) as SudokuDigit,
        undo: null,
      },
      { type: "tap-cell", index: given, cleanNotes: true },
    );
    expect(switched.locked).toBe(shown);
    expect(switched.mistakes.cells).toEqual([]);
    expect(switched.mistakes.held).not.toBeNull();

    const next = sudoku(switched, ...write(S2, rightDigit(S2)));
    expect(next.mistakes.cells).toEqual([S0]);
  });
});
