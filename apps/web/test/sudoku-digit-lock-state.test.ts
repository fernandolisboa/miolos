import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import { asDigit, solutionDigits } from "../src/sudoku/engine";
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

const GIVEN_DIGIT = asDigit(PUZZLE.givens[GIVEN]) ?? 1;
const OTHER = asDigit((GIVEN_DIGIT % 9) + 1) ?? 1;

function tapCell(index: number): SudokuPlayAction {
  return { type: "tap-cell", index, cleanNotes: true };
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
          : [
              { type: "enter-digit", digit: before, cleanNotes: true } as const,
            ]),
      );
      const afterFirstTap = play(prepared, {
        type: "enter-digit",
        digit,
        cleanNotes: true,
      });

      const locked = play(afterFirstTap, {
        type: "lock-digit",
        digit,
        undo: { index: FIRST, value: before, notes: FRESH.notes },
      });

      expect(locked.locked).toBe(digit);
      expect(locked.entries).toEqual(prepared.entries);
    },
  );

  it("lock-digit never writes to a given, whatever the undo says", () => {
    const locked = play(FRESH, {
      type: "lock-digit",
      digit: 5,
      undo: { index: GIVEN, value: 5, notes: FRESH.notes },
    });

    expect(locked.entries).toEqual(FRESH.entries);
    expect(locked.locked).toBe(5);
  });

  it("unlock releases the digit and is a no-op when nothing is locked", () => {
    expect(play(lockedOn(2), { type: "unlock" }).locked).toBeNull();
    expect(play(FRESH, { type: "unlock" })).toBe(FRESH);
  });

  it("tap-cell selects the cell and writes the locked digit there", () => {
    const state = play(lockedOn(6), {
      type: "tap-cell",
      index: FIRST,
      cleanNotes: true,
    });

    expect(state.selected).toBe(FIRST);
    expect(state.entries[FIRST]).toBe(6);
    expect(state.locked).toBe(6);
  });

  it("tap-cell on a cell already holding the locked digit clears it", () => {
    const state = play(
      lockedOn(6),
      { type: "tap-cell", index: FIRST, cleanNotes: true },
      { type: "tap-cell", index: FIRST, cleanNotes: true },
    );

    expect(state.entries[FIRST]).toBeNull();
    expect(state.locked).toBe(6);
  });

  it("tap-cell on a cell holding another digit locks that digit and keeps the entry", () => {
    const state = play(
      lockedOn(6),
      { type: "select", index: SECOND },
      { type: "enter-digit", digit: 9, cleanNotes: true },
      { type: "tap-cell", index: SECOND, cleanNotes: true },
    );

    expect(state.entries[SECOND]).toBe(9);
    expect(state.locked).toBe(9);
  });

  it("tap-cell on a given selects it, locks its digit and changes no entry", () => {
    const state = play(lockedOn(OTHER), {
      type: "tap-cell",
      index: GIVEN,
      cleanNotes: true,
    });

    expect(state.selected).toBe(GIVEN);
    expect(state.locked).toBe(GIVEN_DIGIT);
    expect(state.entries).toEqual(FRESH.entries);
  });

  it("tap-cell does nothing while no digit is locked", () => {
    expect(
      play(FRESH, { type: "tap-cell", index: FIRST, cleanNotes: true }),
    ).toBe(FRESH);
  });

  it("is kept by Recomeçar and by a restore with no record", () => {
    const written = play(lockedOn(6), {
      type: "tap-cell",
      index: FIRST,
      cleanNotes: true,
    });

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
          {
            type: "enter-digit",
            digit: SOLUTION[index] ?? 1,
            cleanNotes: true,
          },
        ),
      lockedOn(SOLUTION[FIRST] ?? 1),
    );
    const solved = play(nearly, {
      type: "tap-cell",
      index: FIRST,
      cleanNotes: true,
    });

    it("a lock tap that completes the board solves it", () => {
      expect(nearly.status).toBe("playing");
      expect(solved.status).toBe("solved");
    });

    it("lock-digit and tap-cell are no-ops, so nothing un-solves it", () => {
      const lock = play(solved, {
        type: "lock-digit",
        digit: 1,
        undo: { index: FIRST, value: null, notes: FRESH.notes },
      });
      const tap = play(solved, {
        type: "tap-cell",
        index: SECOND,
        cleanNotes: true,
      });

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
          {
            type: "enter-digit",
            digit: SOLUTION[index] ?? 1,
            cleanNotes: true,
          },
        ),
      FRESH,
    );

    expect(state.status).toBe("solved");
    expect(play(state, { type: "lock-digit", digit: 2, undo: null })).toBe(
      state,
    );
  });
});

describe("a tap on a filled cell switches the locked digit (T-WEB-S950)", () => {
  function withEntry(index: number, digit: SudokuDigit): SudokuPlayState {
    return play(
      FRESH,
      { type: "select", index },
      { type: "enter-digit", digit, cleanNotes: true },
    );
  }

  it("on an entry holding another digit, locks that digit with no undo step", () => {
    const start = play(withEntry(FIRST, 2), {
      type: "lock-digit",
      digit: 8,
      undo: null,
    });
    const state = play(start, tapCell(FIRST));

    expect(state.locked).toBe(2);
    expect(state.selected).toBe(FIRST);
    expect(state.entries).toBe(start.entries);
    expect(state.notes).toBe(start.notes);
    expect(state.history).toBe(start.history);
  });

  it("then writes the new digit into an empty cell", () => {
    const state = play(lockedOn(OTHER), tapCell(GIVEN), tapCell(SECOND));

    expect(state.entries[SECOND]).toBe(GIVEN_DIGIT);
  });

  it("leaves a given holding the locked digit locked", () => {
    const state = play(lockedOn(GIVEN_DIGIT), tapCell(GIVEN));

    expect(state.locked).toBe(GIVEN_DIGIT);
    expect(state.selected).toBe(GIVEN);
  });

  it("switches in Rascunho too, and notes nothing on the filled cell", () => {
    const start = play(
      withEntry(FIRST, 2),
      { type: "toggle-noting" },
      { type: "lock-digit", digit: 8, undo: null },
    );
    const onEntry = play(start, tapCell(FIRST));
    expect(onEntry.locked).toBe(2);
    expect(onEntry.notes).toBe(start.notes);

    const onGiven = play(onEntry, tapCell(GIVEN));
    expect(onGiven.locked).toBe(GIVEN_DIGIT);
    expect(onGiven.noting).toBe(true);
  });
});
