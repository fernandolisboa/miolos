import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { solutionDigits } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DAILY: DailySudokuResponse = dailySudokuResponseSchema.parse({
  game: "sudoku",
  date: "2026-08-01",
  givens: PUZZLE.givens,
  tier: PUZZLE.tier,
});

const SOLUTION = solutionDigits(PUZZLE.givens) ?? [];

const EMPTIES = PUZZLE.givens.flatMap((given, index) =>
  given === 0 ? [index] : [],
);
const FIRST = EMPTIES[0] ?? 0;
const SECOND = EMPTIES[1] ?? 0;
const GIVEN = PUZZLE.givens.findIndex((given) => given !== 0);

function play(
  state: SudokuPlayState,
  ...actions: readonly SudokuPlayAction[]
): SudokuPlayState {
  return actions.reduce(
    (current, action) => sudokuPlayReducer(current, action),
    state,
  );
}

const FRESH = initSudokuPlayState(DAILY);

function lockedOn(digit: SudokuDigit): SudokuPlayState {
  return play(FRESH, { type: "lock-digit", digit, undo: null });
}

describe("the Sudoku digit lock in the reducer (T-WEB-S591)", () => {
  it("starts unlocked", () => {
    expect(FRESH.locked).toBeNull();
  });

  it("lock-digit locks the digit and, with no undo, leaves the board alone", () => {
    const state = lockedOn(4);

    expect(state.locked).toBe(4);
    expect(state.entries).toEqual(FRESH.entries);
  });

  it.each([
    ["an empty cell", null, 3],
    ["a cell that held the same digit", 3, 3],
    ["a cell that held another digit", 8, 3],
  ] as const)(
    "lock-digit restores %s to what it held before the first tap",
    (_name, before, digit) => {
      const prepared = play(
        FRESH,
        { type: "select", index: FIRST },
        ...(before === null
          ? []
          : [{ type: "enter-digit", digit: before } as const]),
      );
      const afterFirstTap = play(prepared, { type: "enter-digit", digit });

      const locked = play(afterFirstTap, {
        type: "lock-digit",
        digit,
        undo: { index: FIRST, value: before },
      });

      expect(locked.locked).toBe(digit);
      expect(locked.entries).toEqual(prepared.entries);
    },
  );

  it("lock-digit never writes to a given, whatever the undo says", () => {
    const locked = play(FRESH, {
      type: "lock-digit",
      digit: 5,
      undo: { index: GIVEN, value: 5 },
    });

    expect(locked.entries).toEqual(FRESH.entries);
    expect(locked.locked).toBe(5);
  });

  it("unlock releases the digit and is a no-op when nothing is locked", () => {
    expect(play(lockedOn(2), { type: "unlock" }).locked).toBeNull();
    expect(play(FRESH, { type: "unlock" })).toBe(FRESH);
  });

  it("tap-cell selects the cell and writes the locked digit there", () => {
    const state = play(lockedOn(6), { type: "tap-cell", index: FIRST });

    expect(state.selected).toBe(FIRST);
    expect(state.entries[FIRST]).toBe(6);
    expect(state.locked).toBe(6);
  });

  it("tap-cell on a cell already holding the locked digit clears it", () => {
    const state = play(
      lockedOn(6),
      { type: "tap-cell", index: FIRST },
      { type: "tap-cell", index: FIRST },
    );

    expect(state.entries[FIRST]).toBeNull();
    expect(state.locked).toBe(6);
  });

  it("tap-cell on a cell holding another digit overwrites it", () => {
    const state = play(
      lockedOn(6),
      { type: "select", index: SECOND },
      { type: "enter-digit", digit: 9 },
      { type: "tap-cell", index: SECOND },
    );

    expect(state.entries[SECOND]).toBe(6);
  });

  it("tap-cell on a given selects it and changes nothing else", () => {
    const state = play(lockedOn(6), { type: "tap-cell", index: GIVEN });

    expect(state.selected).toBe(GIVEN);
    expect(state.entries).toEqual(FRESH.entries);
  });

  it("tap-cell does nothing while no digit is locked", () => {
    expect(play(FRESH, { type: "tap-cell", index: FIRST })).toBe(FRESH);
  });

  it("is kept by Recomeçar and by a restore with no record", () => {
    const written = play(lockedOn(6), { type: "tap-cell", index: FIRST });

    expect(play(written, { type: "reset" }).locked).toBe(6);
    expect(
      play(written, { type: "restore", record: undefined, now: 1 }).locked,
    ).toBe(6);
  });

  describe("once the board is solved", () => {
    const nearly = EMPTIES.slice(1).reduce(
      (state, index) =>
        play(
          state,
          { type: "select", index },
          { type: "enter-digit", digit: SOLUTION[index] ?? 1 },
        ),
      lockedOn(SOLUTION[FIRST] ?? 1),
    );
    const solved = play(nearly, { type: "tap-cell", index: FIRST });

    it("a lock tap that completes the board solves it", () => {
      expect(nearly.status).toBe("playing");
      expect(solved.status).toBe("solved");
    });

    it("lock-digit and tap-cell are no-ops, so nothing un-solves it", () => {
      const lock = play(solved, {
        type: "lock-digit",
        digit: 1,
        undo: { index: FIRST, value: null },
      });
      const tap = play(solved, { type: "tap-cell", index: SECOND });

      expect(lock).toBe(solved);
      expect(tap).toBe(solved);
      expect(lock.status).toBe("solved");
    });
  });

  it("lock-digit is a no-op once the board is solved even with no undo", () => {
    const state = EMPTIES.reduce(
      (current, index) =>
        play(
          current,
          { type: "select", index },
          { type: "enter-digit", digit: SOLUTION[index] ?? 1 },
        ),
      FRESH,
    );

    expect(state.status).toBe("solved");
    expect(play(state, { type: "lock-digit", digit: 2, undo: null })).toBe(
      state,
    );
  });
});
