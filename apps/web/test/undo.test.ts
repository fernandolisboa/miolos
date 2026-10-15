import {
  dailyCrosswordResponseSchema,
  dailyNonogramResponseSchema,
  dailyQueensResponseSchema,
  dailySudokuResponseSchema,
  type DailyBinairoResponse,
} from "@miolos/core";
import { generateBinairo } from "@miolos/games/binairo";
import { generateNonogram } from "@miolos/games/nonogram";
import { generateQueens } from "@miolos/games/queens";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  initPlayState,
  playReducer,
  type PlayAction,
  type PlayState,
} from "../src/binairo/state";
import {
  crosswordPlayReducer,
  initCrosswordPlayState,
  type CrosswordPlayAction,
  type CrosswordPlayState,
} from "../src/crossword/state";
import {
  initNonogramPlayState,
  nonogramPlayReducer,
  type NonogramPlayAction,
  type NonogramPlayState,
} from "../src/nonogram/state";
import type { UndoAction } from "../src/play/undo";
import {
  autoCrossingReducer,
  initQueensPlayState,
  queensPlayReducer,
  type QueensPlayAction,
  type QueensPlayState,
} from "../src/queens/state";
import { solutionDigits } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const DATE = "2026-10-15";
const UNDO: UndoAction = { type: "undo" };
const RESTORE = { type: "restore", record: undefined, now: 0 } as const;

function runWith<S, A>(
  reduce: (state: S, action: A | UndoAction) => S,
): (state: S, ...actions: readonly (A | UndoAction)[]) => S {
  return (state, ...actions) => actions.reduce(reduce, state);
}

const sudoku = runWith<SudokuPlayState, SudokuPlayAction>(sudokuPlayReducer);
const binairo = runWith<PlayState, PlayAction>(playReducer);
const nonogram = runWith<NonogramPlayState, NonogramPlayAction>(
  nonogramPlayReducer,
);
const queens = runWith<QueensPlayState, QueensPlayAction>(queensPlayReducer);
const crossing = runWith<QueensPlayState, QueensPlayAction>(
  autoCrossingReducer,
);
const crossword = runWith<CrosswordPlayState, CrosswordPlayAction>(
  crosswordPlayReducer,
);

const SUDOKU = generateDailySudoku({ seed: 20_261_015, weekday: 1 });

function sudokuBoard(givens: readonly number[]): SudokuPlayState {
  return sudoku(
    initSudokuPlayState(
      dailySudokuResponseSchema.parse({
        game: "sudoku",
        date: DATE,
        givens,
        tier: SUDOKU.tier,
      }),
    ),
    RESTORE,
  );
}

const blankSudoku = () => sudokuBoard(Array.from({ length: 81 }, () => 0));

const write = (index: number, digit: SudokuDigit): SudokuPlayAction[] => [
  { type: "select", index },
  { type: "enter-digit", digit },
];

const NONOGRAM = generateNonogram(20_261_015, 1);
const NONOGRAM_DAILY = dailyNonogramResponseSchema.parse({
  game: "nonogram",
  date: DATE,
  size: NONOGRAM.size,
  clues: NONOGRAM.clues,
});

const nonogramBoard = () =>
  nonogram(initNonogramPlayState(NONOGRAM_DAILY), RESTORE);

const QUEENS = generateQueens({ seed: 20_261_015, weekday: 1 });
const QUEENS_DAILY = dailyQueensResponseSchema.parse({
  game: "queens",
  date: DATE,
  size: QUEENS.size,
  regions: QUEENS.regions,
});

const queen = (index: number): QueensPlayAction[] => [
  { type: "select", index },
  { type: "enter-value", value: 1 },
];

const stroke = (
  index: number,
): { type: "stroke-start"; index: number; press: "tap" } => ({
  type: "stroke-start",
  index,
  press: "tap",
});

const over = (index: number) => ({ type: "paint-over", index }) as const;

describe("undoable keeps one step per board change (T-WEB-S820)", () => {
  it("steps back one entry at a time and then has nothing left", () => {
    const written = sudoku(blankSudoku(), ...write(0, 3), ...write(1, 5));
    expect(written.history.steps).toHaveLength(2);

    const once = sudoku(written, UNDO);
    expect(once.entries.slice(0, 2)).toEqual([3, null]);
    const twice = sudoku(once, UNDO);
    expect(twice.entries.slice(0, 2)).toEqual([null, null]);
    expect(twice.history.steps).toHaveLength(0);
    expect(sudoku(twice, UNDO)).toBe(twice);
  });

  it("records nothing for selection, ticks, pauses or tools", () => {
    const written = sudoku(blankSudoku(), ...write(0, 3));
    const moved = sudoku(
      written,
      { type: "select", index: 40 },
      { type: "move-selection", rows: 1, columns: 0 },
      { type: "tick", now: 1000 },
      { type: "pause", now: 2000 },
      { type: "resume", now: 3000 },
      { type: "lock-digit", digit: 7, undo: null },
    );
    expect(moved.history).toBe(written.history);
  });

  it("keeps the last 200 steps", () => {
    const actions = Array.from({ length: 205 }, (_unused, at) =>
      write(at % 81, ((at % 9) + 1) as SudokuDigit),
    ).flat();
    expect(sudoku(blankSudoku(), ...actions).history.steps).toHaveLength(200);
  });

  it("clears on restore, on Recomeçar and on a hint", () => {
    const written = sudoku(blankSudoku(), ...write(0, 3));
    expect(sudoku(written, RESTORE).history.steps).toHaveLength(0);
    expect(sudoku(written, { type: "reset" }).history.steps).toHaveLength(0);

    const solution = solutionDigits(SUDOKU.givens);
    if (solution === null) {
      throw new Error("a daily sudoku is uniquely solvable");
    }
    const open = SUDOKU.givens.indexOf(0);
    const hinted = sudoku(
      sudokuBoard(SUDOKU.givens),
      ...write(open, solution[open] === 1 ? 2 : 1),
      { type: "use-hint", solution },
    );
    expect(hinted.hint.used).toBe(1);
    expect(hinted.history.steps).toHaveLength(0);
    expect(sudoku(hinted, UNDO)).toBe(hinted);
  });

  it("does nothing on a solved board", () => {
    const solution = solutionDigits(SUDOKU.givens);
    if (solution === null) {
      throw new Error("a daily sudoku is uniquely solvable");
    }
    const solved = sudoku(
      sudokuBoard(SUDOKU.givens),
      ...SUDOKU.givens.flatMap((given, index) =>
        given === 0 ? write(index, solution[index] as SudokuDigit) : [],
      ),
    );
    expect(solved.status).toBe("solved");
    expect(solved.history.steps.length).toBeGreaterThan(0);
    expect(sudoku(solved, UNDO)).toBe(solved);
  });
});

describe("a gesture undoes as one step (T-WEB-S821)", () => {
  it("groups a drag, ticks included", () => {
    const dragged = nonogram(
      nonogramBoard(),
      stroke(0),
      over(1),
      { type: "tick", now: 500 },
      over(2),
    );
    expect(dragged.entries.slice(0, 3)).toEqual([1, 1, 1]);
    expect(dragged.history.steps).toHaveLength(1);
    expect(nonogram(dragged, UNDO).entries.slice(0, 3)).toEqual([
      null,
      null,
      null,
    ]);
  });

  it("groups a drag whose first cell changed nothing", () => {
    const placed = queens(
      queens(initQueensPlayState(QUEENS_DAILY), RESTORE),
      ...queen(0),
    );
    const dragged = queens(placed, stroke(0), over(1), over(2));
    expect(dragged.entries.slice(0, 3)).toEqual([1, 0, 0]);
    expect(dragged.history.steps).toHaveLength(2);
    expect(queens(dragged, UNDO).entries.slice(0, 3)).toEqual([1, null, null]);
  });

  it("never merges a new drag into the one before it", () => {
    const first = queens(
      queens(initQueensPlayState(QUEENS_DAILY), RESTORE),
      stroke(5),
      over(6),
    );
    const second = queens(first, ...queen(5), stroke(5), over(7));
    expect(queens(second, UNDO).entries[7]).toBeNull();
    expect(queens(second, UNDO).entries[5]).toBe(1);
  });

  it("drops a Número fixo double tap that put the cell back", () => {
    const tapped = sudoku(blankSudoku(), ...write(0, 3), ...write(1, 5));
    const locked = sudoku(tapped, {
      type: "lock-digit",
      digit: 5,
      undo: { index: 1, value: null },
    });
    expect(locked.locked).toBe(5);
    expect(locked.history.steps).toHaveLength(1);
    expect(sudoku(locked, UNDO).entries.slice(0, 2)).toEqual([null, null]);
  });

  it("closes the drag on Ctrl+Z, so the rest of it is a new step", () => {
    const dragged = nonogram(nonogramBoard(), stroke(0), over(1), UNDO);
    expect(dragged.entries.slice(0, 2)).toEqual([null, null]);
    const resumed = nonogram(dragged, over(2));
    expect(resumed.history.steps).toHaveLength(1);
    expect(nonogram(resumed, UNDO).entries[2]).toBeNull();
  });
});

describe("Sudoku undo restores the board and keeps the clock and tools (T-WEB-S822)", () => {
  it("brings back entries, conflicts and the selection", () => {
    const clashing = sudoku(
      blankSudoku(),
      ...write(0, 5),
      ...write(1, 5),
      { type: "select", index: 40 },
      { type: "tick", now: 4000 },
      { type: "lock-digit", digit: 7, undo: null },
    );
    expect(clashing.violating.size).toBe(2);

    const undone = sudoku(clashing, UNDO);
    expect(undone.entries.slice(0, 2)).toEqual([5, null]);
    expect(undone.violating.size).toBe(0);
    expect(undone.selected).toBe(1);
    expect(undone.timer).toBe(clashing.timer);
    expect(undone.locked).toBe(7);
    expect(undone.hint.used).toBe(clashing.hint.used);
  });
});

describe("Binairo and Nonogram undo a drag and keep the brush (T-WEB-S823)", () => {
  it("Binairo", () => {
    const puzzle = generateBinairo({ seed: 20_261_015, weekday: 1 });
    const daily: DailyBinairoResponse = {
      game: "binairo",
      date: DATE,
      size: 8,
      givens: [...puzzle.givens],
    };
    const board = binairo(initPlayState(daily), RESTORE, {
      type: "set-mode",
      value: 1,
    });
    const open = daily.givens.flatMap((given, index) =>
      given === null ? [index] : [],
    );
    const [a = 0, b = 0, c = 0] = open;
    const dragged = binairo(board, stroke(a), over(b), over(c));
    const undone = binairo(dragged, UNDO);
    expect([a, b, c].map((index) => undone.entries[index])).toEqual([
      null,
      null,
      null,
    ]);
    expect(undone.paint).toEqual({ kind: "paint", value: 1 });
  });

  it("Nonogram, with the hinted cell's marker back", () => {
    const crossed = nonogram(nonogramBoard(), {
      type: "set-brush",
      brush: "cross",
    });
    const hinted = nonogram(crossed, { type: "use-hint" });
    const cell = hinted.hint.lastIndex;
    if (cell === null) {
      throw new Error("a fresh daily always has a hint");
    }
    const overwritten = nonogram(
      hinted,
      { type: "select", index: cell },
      { type: "clear-cell" },
    );
    expect(overwritten.hint.lastIndex).toBeNull();

    const undone = nonogram(overwritten, UNDO);
    expect(undone.hint.lastIndex).toBe(cell);
    expect(undone.entries[cell]).toBe(hinted.entries[cell]);
    expect(undone.brush).toBe("cross");
    expect(undone.hint.used).toBe(1);
  });
});

describe("Rainhas undo brings the automatic crosses back (T-WEB-S824)", () => {
  it("under the auto-crossing reducer", () => {
    const board = crossing(initQueensPlayState(QUEENS_DAILY), RESTORE);
    const first = crossing(board, ...queen(0));
    const second = crossing(first, ...queen(QUEENS_DAILY.size + 3));
    expect(second.autoCrossed.size).toBeGreaterThan(first.autoCrossed.size);

    const undone = crossing(second, UNDO);
    expect(undone.entries).toEqual(first.entries);
    expect(undone.autoCrossed).toBe(first.autoCrossed);
    expect(
      crossing(undone, UNDO).entries.every((entry) => entry === null),
    ).toBe(true);
  });

  it("under the plain reducer, conflicts included", () => {
    const board = queens(initQueensPlayState(QUEENS_DAILY), RESTORE);
    const clash = queens(board, ...queen(0), ...queen(1));
    expect(clash.conflicts.size).toBeGreaterThan(0);
    const undone = queens(clash, UNDO);
    expect(undone.conflicts.size).toBe(0);
    expect(undone.entries[1]).toBeNull();
  });

  it("a drag only crosses: it never clears an ✕ or a queen, whatever the button", () => {
    const board = queens(
      queens(initQueensPlayState(QUEENS_DAILY), RESTORE),
      { type: "tap", index: 0, press: "tap" },
      ...queen(2),
    );
    const dragged = queens(
      board,
      { type: "stroke-start", index: 0, press: "right" },
      over(1),
      over(2),
    );
    expect(dragged.entries.slice(0, 3)).toEqual([0, 0, 1]);
  });
});

describe("Cruzadinha undo restores the cursor (T-WEB-S825)", () => {
  const daily = dailyCrosswordResponseSchema.parse({
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
      {
        number: 1,
        direction: "across",
        row: 0,
        col: 0,
        length: 3,
        clue: "felino",
      },
      {
        number: 1,
        direction: "down",
        row: 0,
        col: 0,
        length: 2,
        clue: "pronome",
      },
      {
        number: 2,
        direction: "down",
        row: 0,
        col: 2,
        length: 2,
        clue: "verbo",
      },
    ],
  });
  const board = () =>
    crossword(initCrosswordPlayState(daily), RESTORE, {
      type: "select",
      index: 0,
    });
  const letter = (value: string): CrosswordPlayAction => ({
    type: "type-letter",
    letter: value,
    skipFilled: false,
  });

  it("takes the letter back and puts the cursor where it was", () => {
    const typed = crossword(board(), letter("c"), letter("a"));
    expect(typed.selected).toBe(2);
    const undone = crossword(typed, UNDO);
    expect(undone.entries.slice(0, 2)).toEqual(["c", null]);
    expect(undone.selected).toBe(1);
  });

  it("restores a backspace that stepped back as one step", () => {
    const typed = crossword(board(), letter("c"), letter("a"));
    const erased = crossword(typed, { type: "backspace" });
    expect(erased.entries[1]).toBeNull();
    expect(erased.selected).toBe(1);
    const undone = crossword(erased, UNDO);
    expect(undone.entries[1]).toBe("a");
    expect(undone.selected).toBe(2);
  });
});
