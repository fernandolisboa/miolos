import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import { generateDailySudoku, sudokuPeers } from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import {
  sudokuPlayRecordSchema,
  type SudokuPlayRecord,
} from "../src/play/play-record";
import type { UndoAction } from "../src/play/undo";
import { solutionDigits } from "../src/sudoku/engine";
import { noteDigits } from "../src/sudoku/notes";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const DATE = "2026-10-15";
const UNDO: UndoAction = { type: "undo" };
const PUZZLE = generateDailySudoku({ seed: 20_261_015, weekday: 1 });
const SOLUTION = solutionDigits(PUZZLE.givens) ?? [];

function dailyOf(givens: readonly number[]): DailySudokuResponse {
  return dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: DATE,
    givens,
    tier: PUZZLE.tier,
  });
}

function play(
  state: SudokuPlayState,
  ...actions: readonly (SudokuPlayAction | UndoAction)[]
): SudokuPlayState {
  return actions.reduce(
    (current, action) => sudokuPlayReducer(current, action),
    state,
  );
}

const restored = (state: SudokuPlayState) =>
  play(state, { type: "restore", record: undefined, now: 0 });

const blank = () =>
  restored(initSudokuPlayState(dailyOf(Array.from({ length: 81 }, () => 0))));
const puzzle = () => restored(initSudokuPlayState(dailyOf(PUZZLE.givens)));

const select = (index: number): SudokuPlayAction => ({ type: "select", index });
const note = (digit: SudokuDigit): SudokuPlayAction => ({
  type: "toggle-note",
  digit,
});
const noting: SudokuPlayAction = { type: "toggle-noting" };

const write = (digit: SudokuDigit, cleanNotes = true): SudokuPlayAction => ({
  type: "enter-digit",
  digit,
  cleanNotes,
});

const bit = (digit: number) => 1 << (digit - 1);

const FULL = 0b1_1111_1111;

function withEveryNote(state: SudokuPlayState): SudokuPlayState {
  const digits: SudokuDigit[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];
  return play(
    state,
    ...state.givens.flatMap((given, index) =>
      given === 0 ? [select(index), ...digits.map(note)] : [],
    ),
  );
}

describe("toggle-note and Rascunho write notes, not values (T-WEB-S830)", () => {
  it("toggles one digit's bit in the selected empty cell", () => {
    const on = play(blank(), select(4), note(3), note(7));
    expect(on.notes[4]).toBe(bit(3) | bit(7));
    expect(noteDigits(on.notes[4] ?? 0)).toEqual([3, 7]);

    const off = play(on, note(3));
    expect(off.notes[4]).toBe(bit(7));
    expect(off.entries[4]).toBeNull();
  });

  it("holds all nine notes in one cell", () => {
    const full = play(
      blank(),
      select(0),
      ...([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).map(note),
    );
    expect(full.notes[0]).toBe(FULL);
  });

  it("makes a digit toggle a note while Rascunho is on, and write once it is off", () => {
    const asNote = play(blank(), select(0), noting, write(5));
    expect(asNote.noting).toBe(true);
    expect(asNote.notes[0]).toBe(bit(5));
    expect(asNote.entries[0]).toBeNull();

    const again = play(asNote, write(5));
    expect(again.notes[0]).toBe(0);

    const value = play(asNote, noting, write(5));
    expect(value.noting).toBe(false);
    expect(value.entries[0]).toBe(5);
  });

  it("does nothing on a given, a filled cell or without a selection", () => {
    const start = puzzle();
    const given = PUZZLE.givens.findIndex((cell) => cell !== 0);
    const empty = PUZZLE.givens.findIndex((cell) => cell === 0);

    expect(play(start, select(given), note(1)).notes).toBe(start.notes);
    expect(play(start, note(1)).notes).toBe(start.notes);

    const filled = play(start, select(empty), write(2));
    expect(play(filled, note(1)).notes).toBe(filled.notes);
  });

  it("does nothing on a solved board", () => {
    let solved = puzzle();
    for (const [index, digit] of SOLUTION.entries()) {
      if (PUZZLE.givens[index] === 0) {
        solved = play(solved, select(index), write(digit));
      }
    }
    expect(solved.status).toBe("solved");
    expect(play(solved, note(1), noting, write(1)).notes).toBe(solved.notes);
  });

  it("starts with 81 empty masks", () => {
    const start = blank();
    expect(start.notes).toEqual(Array.from({ length: 81 }, () => 0));
    expect(start.noting).toBe(false);
  });
});

describe("a value clears notes (T-WEB-S831)", () => {
  const noted = () => play(withEveryNote(blank()), select(0));

  it("always clears the written cell's own notes, even with cleanNotes off", () => {
    expect(play(noted(), write(4, false)).notes[0]).toBe(0);
    expect(play(noted(), write(4, true)).notes[0]).toBe(0);
  });

  it("strips the digit from row, column and box peers, and only those", () => {
    const next = play(noted(), write(4, true));
    const peers = new Set(sudokuPeers(0));
    for (const [index, mask] of next.notes.entries()) {
      if (index === 0) {
        continue;
      }
      expect(mask, `cell ${String(index)}`).toBe(
        peers.has(index) ? FULL & ~bit(4) : FULL,
      );
    }
  });

  it("keeps every peer note with cleanNotes off", () => {
    const next = play(noted(), write(4, false));
    expect(next.notes.slice(1)).toEqual(noted().notes.slice(1));
  });

  it("strips nothing when a value is removed", () => {
    const written = play(noted(), write(4, false));
    const erased = play(written, write(4, true));
    expect(erased.entries[0]).toBeNull();
    expect(erased.notes).toBe(written.notes);

    const cleared = play(written, { type: "clear-cell" });
    expect(cleared.notes).toBe(written.notes);
  });

  it("clears notes through a Número fixo tap too", () => {
    const next = play(
      withEveryNote(blank()),
      { type: "lock-digit", digit: 6, undo: null },
      { type: "tap-cell", index: 0, cleanNotes: true },
    );
    expect(next.entries[0]).toBe(6);
    expect(next.notes[0]).toBe(0);
    expect(next.notes[1]).toBe(FULL & ~bit(6));
    expect(next.notes[40]).toBe(FULL);
  });
});

describe("a hint, Recomeçar and the eraser (T-WEB-S832)", () => {
  const hinted = (cleanNotes: boolean) =>
    play(withEveryNote(puzzle()), {
      type: "use-hint",
      solution: SOLUTION,
      cleanNotes,
    });

  it("clears the hinted cell's notes whatever cleanNotes says", () => {
    for (const cleanNotes of [true, false]) {
      const next = hinted(cleanNotes);
      const at = next.hint.lastIndex ?? -1;
      expect(next.entries[at]).not.toBeNull();
      expect(next.notes[at]).toBe(0);
    }
  });

  it("strips the hinted digit from its peers only with cleanNotes", () => {
    const before = withEveryNote(puzzle());
    const on = hinted(true);
    const at = on.hint.lastIndex ?? -1;
    const digit = on.entries[at] ?? 1;
    const peers = new Set(sudokuPeers(at));
    for (const [index, mask] of on.notes.entries()) {
      if (index !== at && before.givens[index] === 0) {
        expect(mask, `cell ${String(index)}`).toBe(
          peers.has(index) ? FULL & ~bit(digit) : FULL,
        );
      }
    }

    const off = hinted(false);
    expect(off.notes.filter((_mask, index) => index !== at)).toEqual(
      before.notes.filter((_mask, index) => index !== at),
    );
  });

  it("resets every note and keeps the mode", () => {
    const start = play(withEveryNote(puzzle()), noting);
    const next = play(start, { type: "reset" });
    expect(next.notes.every((mask) => mask === 0)).toBe(true);
    expect(next.noting).toBe(true);
  });

  it("resets a board that holds notes and no values", () => {
    const start = play(blank(), select(2), note(9));
    const next = play(start, { type: "reset" });
    expect(next).not.toBe(start);
    expect(next.notes[2]).toBe(0);
  });

  it("clears the cell's notes with the eraser on an empty cell", () => {
    const start = play(blank(), select(2), note(9), note(1));
    const next = play(start, { type: "clear-cell" });
    expect(next.notes[2]).toBe(0);

    expect(play(next, { type: "clear-cell" }).notes).toBe(next.notes);
  });
});

describe("Número fixo works in Rascunho (T-WEB-S930)", () => {
  const lock = (digit: SudokuDigit): SudokuPlayAction => ({
    type: "lock-digit",
    digit,
    undo: null,
  });
  const tap = (index: number): SudokuPlayAction => ({
    type: "tap-cell",
    index,
    cleanNotes: true,
  });

  it("with Rascunho on and 4 locked, a tap on an empty cell toggles note 4 and writes nothing", () => {
    const start = play(blank(), noting, lock(4));
    const once = play(start, tap(7));
    expect(once.selected).toBe(7);
    expect(noteDigits(once.notes[7] ?? 0)).toEqual([4]);
    expect(once.entries).toEqual(start.entries);

    const twice = play(once, tap(7));
    expect(twice.notes[7]).toBe(0);
  });

  it("keeps the locked digit when Rascunho turns on or off", () => {
    const locked = play(blank(), lock(3));
    const on = play(locked, noting);
    expect(on.locked).toBe(3);
    expect(on.noting).toBe(true);
    expect(play(on, noting).locked).toBe(3);
  });

  it("locks a digit while Rascunho is on", () => {
    expect(play(blank(), noting, lock(3)).locked).toBe(3);
  });

  it("notes nothing on a given or an entered cell, and fixes its digit instead", () => {
    const given = PUZZLE.givens.findIndex((cell) => cell !== 0 && cell !== 4);
    const onGiven = play(puzzle(), noting, lock(4), tap(given));
    expect(onGiven.selected).toBe(given);
    expect(onGiven.notes[given]).toBe(0);
    expect(onGiven.locked).toBe(PUZZLE.givens[given]);

    const entered = play(blank(), select(2), write(6), noting, lock(4));
    const onEntry = play(entered, tap(2));
    expect(onEntry.entries[2]).toBe(6);
    expect(onEntry.notes).toBe(entered.notes);
    expect(onEntry.locked).toBe(6);
  });

  it("makes each noted tap one undo step", () => {
    const start = play(blank(), noting, lock(4), tap(7), tap(8));
    expect(start.history.steps).toHaveLength(2);
    const undone = play(start, UNDO);
    expect(undone.notes[8]).toBe(0);
    expect(noteDigits(undone.notes[7] ?? 0)).toEqual([4]);
  });

  it("puts the notes back when a double tap on the keypad fixes the digit in Rascunho", () => {
    const before = play(blank(), noting, select(0));
    const first = play(before, write(8));
    expect(noteDigits(first.notes[0] ?? 0)).toEqual([8]);

    const second = play(first, {
      type: "lock-digit",
      digit: 8,
      undo: { index: 0, value: null, notes: before.notes },
    });
    expect(second.notes).toEqual(before.notes);
    expect(second.locked).toBe(8);
    expect(second.noting).toBe(true);
  });
});

describe("Número fixo's double tap and notes (T-WEB-S833)", () => {
  it("brings the peer notes back when the double tap puts a cell back", () => {
    const before = play(withEveryNote(blank()), select(0));
    const first = play(before, write(8));
    expect(first.notes[1]).toBe(FULL & ~bit(8));

    const second = play(first, {
      type: "lock-digit",
      digit: 8,
      undo: { index: 0, value: null, notes: before.notes },
    });
    expect(second.entries[0]).toBeNull();
    expect(second.notes).toEqual(before.notes);
    expect(second.locked).toBe(8);
  });

  it("leaves validity and the grid alone: a note never conflicts", () => {
    const start = play(blank(), select(0), write(5));
    const next = play(start, select(1), note(5));
    expect(next.violating.size).toBe(0);
    expect(next.entries).toEqual(start.entries);
    expect(next.status).toBe("playing");
  });
});

describe("undo takes notes back (T-WEB-S834)", () => {
  it("undoes a note toggle in one step", () => {
    const start = play(blank(), select(5), note(2));
    expect(start.history.steps).toHaveLength(1);
    const undone = play(start, UNDO);
    expect(undone.notes[5]).toBe(0);
    expect(undone.history.steps).toHaveLength(0);
  });

  it("undoes a write that cleaned its peers in one step", () => {
    const before = play(
      blank(),
      select(1),
      note(7),
      select(9),
      note(7),
      note(2),
      select(0),
    );
    const written = play(before, write(7));
    expect(written.notes[1]).toBe(0);
    expect(written.notes[9]).toBe(bit(2));

    const undone = play(written, UNDO);
    expect(undone.entries[0]).toBeNull();
    expect(undone.notes).toEqual(before.notes);
    expect(undone.history.steps).toHaveLength(before.history.steps.length);
  });

  it("undoes the eraser on a notes-only cell in one step", () => {
    const start = play(blank(), select(1), note(4), note(6));
    const erased = play(start, { type: "clear-cell" });
    expect(erased.history.steps).toHaveLength(start.history.steps.length + 1);
    expect(play(erased, UNDO).notes[1]).toBe(bit(4) | bit(6));
  });

  it("records no step for Rascunho itself", () => {
    const start = play(blank(), select(1));
    const next = play(start, noting, noting);
    expect(next.history.steps).toHaveLength(0);
  });

  it("records nothing for a toggle that changed nothing", () => {
    const start = play(blank(), select(1), noting);
    const next = play(start, { type: "clear-cell" });
    expect(next.history.steps).toHaveLength(0);
  });

  it("undoes Recomeçar of a notes-only board no further than the reset", () => {
    const start = play(blank(), select(1), note(4));
    const next = play(start, { type: "reset" });
    expect(next.history.steps).toHaveLength(0);
    expect(play(next, UNDO).notes[1]).toBe(0);
  });
});

describe("notes in the play record (T-WEB-S835)", () => {
  const base: SudokuPlayRecord = {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs: 0,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
  };
  const masks = (fill: number) => Array.from({ length: 81 }, () => fill);

  it("accepts nine-bit masks and a record without notes", () => {
    expect(sudokuPlayRecordSchema.safeParse(base).success).toBe(true);
    expect(
      sudokuPlayRecordSchema.safeParse({ ...base, notes: masks(0) }).success,
    ).toBe(true);
    expect(
      sudokuPlayRecordSchema.safeParse({ ...base, notes: masks(511) }).success,
    ).toBe(true);
  });

  it("rejects a mask over 511, a negative, a fraction and a wrong length", () => {
    for (const notes of [
      masks(512),
      masks(-1),
      masks(1.5),
      masks(0).slice(1),
      [...masks(0), 0],
    ]) {
      expect(sudokuPlayRecordSchema.safeParse({ ...base, notes }).success).toBe(
        false,
      );
    }
  });

  it("restores the notes of a record and treats a missing field as none", () => {
    const empty = PUZZLE.givens.findIndex((cell) => cell === 0);
    const notes = masks(0);
    notes[empty] = bit(2) | bit(9);

    const from = (record: SudokuPlayRecord) =>
      play(initSudokuPlayState(dailyOf(PUZZLE.givens)), {
        type: "restore",
        record,
        now: 0,
      });

    expect(from({ ...base, notes }).notes).toEqual(notes);
    expect(from(base).notes).toEqual(masks(0));
  });

  it("zeroes the masks on given and filled cells", () => {
    const given = PUZZLE.givens.findIndex((cell) => cell !== 0);
    const empties = PUZZLE.givens.flatMap((cell, index) =>
      cell === 0 ? [index] : [],
    );
    const filled = empties[0] ?? 0;
    const open = empties[1] ?? 0;
    const notes = masks(0);
    notes[given] = FULL;
    notes[filled] = FULL;
    notes[open] = bit(1);
    const entries = base.entries.map((entry, index) =>
      index === filled ? (SOLUTION[index] ?? null) : entry,
    );

    const state = play(initSudokuPlayState(dailyOf(PUZZLE.givens)), {
      type: "restore",
      record: { ...base, entries, notes },
      now: 0,
    });

    expect(state.notes[given]).toBe(0);
    expect(state.notes[filled]).toBe(0);
    expect(state.notes[open]).toBe(bit(1));
  });
});
