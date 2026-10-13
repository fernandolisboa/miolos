import {
  dailySudokuResponseSchema,
  FREE_HINTS_PER_PUZZLE,
  HINTS_PER_PUZZLE_CEILING,
  type DailySudokuResponse,
} from "@miolos/core";
import {
  generateDailySudoku,
  getSudokuConflicts,
  isSudokuSolved,
  nextSudokuStep,
} from "@miolos/games/sudoku";
import { describe, expect, it } from "vitest";

import type { SudokuPlayRecord } from "../src/play/play-record";
import { elapsedMs } from "../src/play/timer";
import { mergedGrid, solutionDigits } from "../src/sudoku/engine";
import {
  initSudokuPlayState,
  sudokuPlayReducer,
  type SudokuDigit,
  type SudokuPlayAction,
  type SudokuPlayState,
} from "../src/sudoku/state";

const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DATE = "2026-08-01";

const EMPTY_ENTRIES: readonly (SudokuDigit | null)[] = Array.from(
  { length: 81 },
  () => null,
);

function daily(givens: readonly number[] = PUZZLE.givens): DailySudokuResponse {
  return dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: DATE,
    givens,
    tier: PUZZLE.tier,
  });
}

const BLANK = daily(Array.from({ length: 81 }, () => 0));

function play(
  state: SudokuPlayState,
  ...actions: readonly SudokuPlayAction[]
): SudokuPlayState {
  return actions.reduce(
    (current, action) => sudokuPlayReducer(current, action),
    state,
  );
}

function write(
  state: SudokuPlayState,
  index: number,
  digit: SudokuDigit,
): SudokuPlayState {
  return play(state, { type: "select", index }, { type: "enter-digit", digit });
}

function solutionOf(givens: readonly number[]): readonly SudokuDigit[] {
  const digits = solutionDigits(givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf(PUZZLE.givens);

function digitAt(index: number): SudokuDigit {
  const digit = SOLUTION[index];
  if (digit === undefined) {
    throw new Error(`the solution has no digit at index ${String(index)}`);
  }
  return digit;
}

const LAST_PLAYABLE = PUZZLE.givens.reduce(
  (last, cell, index) => (cell === 0 ? index : last),
  -1,
);

function blankState(): SudokuPlayState {
  return initSudokuPlayState(BLANK);
}

function solve(state: SudokuPlayState, skip = -1): SudokuPlayState {
  let current = state;
  for (const [index, digit] of SOLUTION.entries()) {
    if (index === skip || PUZZLE.givens[index] !== 0) {
      continue;
    }
    current = write(current, index, digit);
  }
  return current;
}

function record(overrides: Partial<SudokuPlayRecord> = {}): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: [...EMPTY_ENTRIES],
    elapsedMs: 0,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
    ...overrides,
  };
}

describe("initSudokuPlayState", () => {
  it("is the deterministic server snapshot: no record, no clock, no caret", () => {
    const state = initSudokuPlayState(daily());

    expect(state.hydrated).toBe(false);
    expect(state.date).toBe(DATE);
    expect(state.tier).toBe(PUZZLE.tier);
    expect(state.givens).toEqual([...PUZZLE.givens]);
    expect(state.entries).toEqual(EMPTY_ENTRIES);

    expect(state.selected).toBeNull();
    expect(state.now).toBe(0);
    expect(elapsedMs(state.timer, state.now)).toBe(0);
    expect(state.timer.runningSince).toBeNull();
    expect(state.hint).toEqual({
      used: 0,
      lastIndex: null,
      reason: null,
      spotlight: [],
    });
    expect(state.violating).toEqual(new Set());
    expect(state.status).toBe("playing");
    expect(state.pendingSync).toBe(false);
  });
});

describe("enter-digit and clear-cell", () => {
  const index = PUZZLE.givens.findIndex((cell) => cell === 0);
  const givenIndex = PUZZLE.givens.findIndex((cell) => cell !== 0);

  it("writes the digit at the selected cell", () => {
    const state = write(initSudokuPlayState(daily()), index, 4);

    expect(state.entries[index]).toBe(4);
    expect(state.selected).toBe(index);
  });

  it("clears when the same digit is entered again — the one-tap undo", () => {
    const written = write(initSudokuPlayState(daily()), index, 4);
    const cleared = sudokuPlayReducer(written, {
      type: "enter-digit",
      digit: 4,
    });

    expect(cleared.entries[index]).toBeNull();
  });

  it("replaces when a different digit is entered", () => {
    const state = sudokuPlayReducer(
      write(initSudokuPlayState(daily()), index, 4),
      { type: "enter-digit", digit: 9 },
    );

    expect(state.entries[index]).toBe(9);
  });

  it("never writes a given, and never clears one", () => {
    const initial = initSudokuPlayState(daily());
    const written = write(initial, givenIndex, 4);
    const cleared = sudokuPlayReducer(
      { ...initial, selected: givenIndex },
      { type: "clear-cell" },
    );

    expect(written.entries[givenIndex]).toBeNull();
    expect(written.entries).toEqual(EMPTY_ENTRIES);
    expect(cleared.entries).toEqual(EMPTY_ENTRIES);
  });

  it("clears the selected cell", () => {
    const state = play(write(initSudokuPlayState(daily()), index, 4), {
      type: "clear-cell",
    });

    expect(state.entries[index]).toBeNull();
  });

  it("is a no-op with no selection, and out of range", () => {
    const initial = initSudokuPlayState(daily());

    expect(sudokuPlayReducer(initial, { type: "enter-digit", digit: 7 })).toBe(
      initial,
    );
    expect(sudokuPlayReducer(initial, { type: "clear-cell" })).toBe(initial);

    const strayed = sudokuPlayReducer(initial, { type: "select", index: 999 });
    expect(sudokuPlayReducer(strayed, { type: "enter-digit", digit: 7 })).toBe(
      strayed,
    );
    expect(sudokuPlayReducer(strayed, { type: "clear-cell" })).toBe(strayed);
  });
});

describe("the merged grid the engine sees", () => {
  const initial = initSudokuPlayState(daily());
  const playable = PUZZLE.givens.findIndex((cell) => cell === 0);
  const givenIndex = PUZZLE.givens.findIndex((cell) => cell !== 0);

  const cases: readonly (readonly [string, SudokuPlayState])[] = [
    ["an untouched board", initial],
    ["a fully filled board", solve(initial)],
    [
      "a board filled then cleared",
      play(solve(initial), { type: "clear-cell" }),
    ],
    ["writes attempted on a given", write(initial, givenIndex, 3)],
    [
      "an out-of-range selection",
      play(
        initial,
        { type: "select", index: 999 },
        { type: "enter-digit", digit: 5 },
      ),
    ],
    ["a duplicate in a row", write(write(blankState(), 0, 5), 3, 5)],
    ["a duplicate in a column", write(write(blankState(), 0, 5), 27, 5)],
    ["a duplicate in a box", write(write(blankState(), 0, 5), 10, 5)],
    ["a single write", write(initial, playable, 8)],
  ];

  for (const [name, state] of cases) {
    it(`never throws on ${name}`, () => {
      const merged = mergedGrid(state.givens, state.entries);

      expect(merged).toHaveLength(81);
      expect(() => getSudokuConflicts(merged)).not.toThrow();
      expect(() => isSudokuSolved(merged)).not.toThrow();
    });
  }
});

describe("violating", () => {
  const cases: readonly (readonly [string, number, number])[] = [
    ["a row", 0, 3],
    ["a column", 0, 27],
    ["a box", 0, 10],
  ];

  for (const [unit, first, second] of cases) {
    it(`flags both cells of a duplicate in ${unit}, and clears when it is removed`, () => {
      const clashing = write(
        write(initSudokuPlayState(BLANK), first, 5),
        second,
        5,
      );

      expect(clashing.violating).toEqual(new Set([first, second]));

      const fixed = sudokuPlayReducer(clashing, {
        type: "enter-digit",
        digit: 5,
      });

      expect(fixed.entries[second]).toBeNull();
      expect(fixed.violating).toEqual(new Set());
    });
  }

  it("never blocks further entry — it is presentation only (ADR-0004)", () => {
    const clashing = write(write(initSudokuPlayState(BLANK), 0, 5), 3, 5);
    const next = write(clashing, 4, 6);

    expect(next.entries[4]).toBe(6);
    expect(next.violating).toEqual(new Set([0, 3]));
  });
});

describe("status", () => {
  const initial = initSudokuPlayState(daily());

  it("flips to solved only on a complete, conflict-free grid", () => {
    const almost = solve(initial, LAST_PLAYABLE);

    expect(almost.status).toBe("playing");

    const solved = write(almost, LAST_PLAYABLE, digitAt(LAST_PLAYABLE));

    expect(solved.status).toBe("solved");
  });

  it("stays playing on a full but wrong grid", () => {
    const wrong: SudokuDigit = digitAt(LAST_PLAYABLE) === 9 ? 1 : 9;
    const full = write(solve(initial, LAST_PLAYABLE), LAST_PLAYABLE, wrong);

    expect(full.entries.filter((cell) => cell === null)).toHaveLength(
      PUZZLE.clueCount,
    );
    expect(full.status).toBe("playing");
    expect(full.violating.size).toBeGreaterThan(0);
  });

  it("latches pendingSync on the transition, and only on the transition", () => {
    const solved = solve(initial);

    expect(solved.pendingSync).toBe(true);

    const synced = sudokuPlayReducer(solved, { type: "mark-synced" });

    expect(synced.pendingSync).toBe(false);

    expect(
      sudokuPlayReducer(synced, { type: "select", index: 0 }).pendingSync,
    ).toBe(false);
    expect(sudokuPlayReducer(synced, { type: "mark-synced" })).toBe(synced);
  });
});

describe("select", () => {
  const initial = initSudokuPlayState(daily());

  it("returns the SAME state when the caret does not move", () => {
    const at = play(initial, { type: "select", index: 40 });

    expect(sudokuPlayReducer(at, { type: "select", index: 40 })).toBe(at);
    expect(sudokuPlayReducer(at, { type: "select", index: 41 })).not.toBe(at);
  });
});

describe("move-selection", () => {
  const initial = initSudokuPlayState(daily());

  it("selects the first cell when there is no caret yet", () => {
    expect(
      sudokuPlayReducer(initial, {
        type: "move-selection",
        rows: 1,
        columns: 0,
      }).selected,
    ).toBe(0);
  });

  it("moves by one row and one column", () => {
    const at = play(initial, { type: "select", index: 40 });

    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: -1, columns: 0 })
        .selected,
    ).toBe(31);
    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: 1, columns: 0 })
        .selected,
    ).toBe(49);
    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: 0, columns: -1 })
        .selected,
    ).toBe(39);
    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: 0, columns: 1 })
        .selected,
    ).toBe(41);
  });

  it("clamps at all four edges and never wraps", () => {
    const topLeft = play(initial, { type: "select", index: 0 });
    const bottomRight = play(initial, { type: "select", index: 80 });
    const topRight = play(initial, { type: "select", index: 8 });

    expect(
      sudokuPlayReducer(topLeft, {
        type: "move-selection",
        rows: -1,
        columns: 0,
      }).selected,
    ).toBe(0);
    expect(
      sudokuPlayReducer(topLeft, {
        type: "move-selection",
        rows: 0,
        columns: -1,
      }).selected,
    ).toBe(0);
    expect(
      sudokuPlayReducer(bottomRight, {
        type: "move-selection",
        rows: 1,
        columns: 0,
      }).selected,
    ).toBe(80);
    expect(
      sudokuPlayReducer(bottomRight, {
        type: "move-selection",
        rows: 0,
        columns: 1,
      }).selected,
    ).toBe(80);

    expect(
      sudokuPlayReducer(topRight, {
        type: "move-selection",
        rows: 0,
        columns: 1,
      }).selected,
    ).toBe(8);
  });

  it("lands Home and End on the row's first and last column", () => {
    const at = play(initial, { type: "select", index: 13 });

    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: 0, columns: -8 })
        .selected,
    ).toBe(9);
    expect(
      sudokuPlayReducer(at, { type: "move-selection", rows: 0, columns: 8 })
        .selected,
    ).toBe(17);
  });
});

describe("use-hint", () => {
  const initial = initSudokuPlayState(daily());

  it("leaves the caret exactly where the player put it", () => {
    const at = play(initial, { type: "select", index: 80 });
    const hinted = sudokuPlayReducer(at, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.selected).toBe(80);
  });

  it("is a no-op once the grid is closed", () => {
    const solved = solve(initial);
    const hinted = sudokuPlayReducer(solved, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted).toBe(solved);
    expect(hinted.hint.used).toBe(0);
  });

  it("never spends the hint when there is nothing to reveal", () => {
    const hinted = sudokuPlayReducer(initial, {
      type: "use-hint",
      solution: [],
    });

    expect(hinted).toBe(initial);
  });

  it("prefers correcting a wrong entry over filling an empty cell", () => {
    const correct = digitAt(LAST_PLAYABLE);
    const wrongAt = write(initial, LAST_PLAYABLE, correct === 9 ? 1 : 9);
    const hinted = sudokuPlayReducer(wrongAt, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.hint.lastIndex).toBe(LAST_PLAYABLE);
    expect(hinted.entries[LAST_PLAYABLE]).toBe(correct);
  });
});

describe("use-hint records the reason and the spotlight (T-WEB-S550)", () => {
  const initial = initSudokuPlayState(daily());

  it("reveals the next logical step, spends a free hint and lights its cells", () => {
    const step = nextSudokuStep(PUZZLE.givens);
    if (step === null) {
      throw new Error("a published daily always has a first step");
    }
    const hinted = sudokuPlayReducer(initial, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.entries[step.index]).toBe(step.digit);
    expect(hinted.hint).toEqual({
      used: 1,
      lastIndex: step.index,
      reason: { kind: "step", step },
      spotlight: step.cells,
    });
  });

  it("names a correction and lights nothing", () => {
    const correct = digitAt(LAST_PLAYABLE);
    const wrongAt = write(initial, LAST_PLAYABLE, correct === 9 ? 1 : 9);
    const hinted = sudokuPlayReducer(wrongAt, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.hint.reason).toEqual({ kind: "correction" });
    expect(hinted.hint.spotlight).toEqual([]);
  });
});

describe("the spotlight lasts until the next board action, the reason until the next hint (T-WEB-S551)", () => {
  const FIRST_GIVEN = PUZZLE.givens.findIndex((cell) => cell !== 0);
  const STEP_INDEX = nextSudokuStep(PUZZLE.givens)?.index;
  const STILL_EMPTY = PUZZLE.givens.findIndex(
    (cell, index) => cell === 0 && index !== STEP_INDEX,
  );

  function hinted(selected: number): SudokuPlayState {
    return play(
      initSudokuPlayState(daily()),
      { type: "select", index: selected },
      { type: "use-hint", solution: SOLUTION },
    );
  }

  it.each<[string, number, SudokuPlayAction]>([
    ["selecting another cell", FIRST_GIVEN, { type: "select", index: 80 }],
    [
      "moving the selection",
      FIRST_GIVEN,
      { type: "move-selection", rows: 0, columns: 1 },
    ],
    ["writing a digit", STILL_EMPTY, { type: "enter-digit", digit: 1 }],
    ["writing on a given", FIRST_GIVEN, { type: "enter-digit", digit: 1 }],
    ["clearing an empty cell", STILL_EMPTY, { type: "clear-cell" }],
    ["clearing a given", FIRST_GIVEN, { type: "clear-cell" }],
  ])("%s clears the spotlight and keeps the reason", (_, at, action) => {
    const before = hinted(at);
    expect(before.hint.spotlight).not.toEqual([]);

    const after = sudokuPlayReducer(before, action);

    expect(after.hint.spotlight).toEqual([]);
    expect(after.hint.reason).toEqual(before.hint.reason);
    expect(after.hint.used).toBe(1);
  });

  it("keeps the spotlight when the same cell is selected again", () => {
    const before = hinted(FIRST_GIVEN);

    expect(
      sudokuPlayReducer(before, { type: "select", index: FIRST_GIVEN }),
    ).toBe(before);
  });

  it("returns the same state for a board action with nothing to clear", () => {
    const at = play(initSudokuPlayState(daily()), {
      type: "select",
      index: FIRST_GIVEN,
    });

    expect(sudokuPlayReducer(at, { type: "clear-cell" })).toBe(at);
  });

  it("reset drops the reason and the spotlight and keeps the hint spent", () => {
    const before = play(hinted(FIRST_GIVEN), {
      type: "select",
      index: STILL_EMPTY,
    });
    const written = sudokuPlayReducer(
      { ...before, hint: { ...before.hint, spotlight: [0] } },
      { type: "enter-digit", digit: 1 },
    );

    const reset = sudokuPlayReducer(
      { ...written, hint: { ...written.hint, spotlight: [0] } },
      { type: "reset" },
    );

    expect(reset.hint).toEqual({
      used: 1,
      lastIndex: null,
      reason: null,
      spotlight: [],
    });
  });

  it("restore drops the reason and the spotlight", () => {
    const restored = sudokuPlayReducer(hinted(FIRST_GIVEN), {
      type: "restore",
      record: record({ hintsUsed: 1 }),
      now: 1,
    });

    expect(restored.hint.reason).toBeNull();
    expect(restored.hint.spotlight).toEqual([]);
  });
});

describe("the reducer's hints stop at the ceiling (T-WEB-S511a)", () => {
  const initial = initSudokuPlayState(daily());

  function hint(state: SudokuPlayState): SudokuPlayState {
    return sudokuPlayReducer(state, { type: "use-hint", solution: SOLUTION });
  }

  it("reveals a solution digit on each free press", () => {
    let current = initial;
    for (let press = 1; press <= FREE_HINTS_PER_PUZZLE; press += 1) {
      current = hint(current);
      const index = current.hint.lastIndex ?? -1;

      expect(current.hint.lastIndex).not.toBeNull();
      expect(current.hint.used).toBe(press);
      expect(current.entries[index]).toBe(SOLUTION[index]);
    }
  });

  it("leaves exactly one hint after a restore one short of the ceiling, and the press after it is inert", () => {
    const restored = sudokuPlayReducer(initial, {
      type: "restore",
      record: record({ hintsUsed: HINTS_PER_PUZZLE_CEILING - 1 }),
      now: 1,
    });
    const last = hint(restored);

    expect(last.hint.used).toBe(HINTS_PER_PUZZLE_CEILING);
    expect(hint(last)).toBe(last);
  });
});

describe("restore", () => {
  const initial = initSudokuPlayState(daily());

  it("maps a record onto the state without starting the clock", () => {
    const entries = [...EMPTY_ENTRIES];
    entries[PUZZLE.givens.findIndex((cell) => cell === 0)] = 6;
    const restored = sudokuPlayReducer(initial, {
      type: "restore",
      record: record({ entries, elapsedMs: 90_000, hintsUsed: 1 }),
      now: 1_700_000_000_000,
    });

    expect(restored.hydrated).toBe(true);
    expect(restored.entries).toEqual(entries);
    expect(restored.timer).toEqual({
      accumulatedMs: 90_000,
      runningSince: null,
    });
    expect(restored.hint).toEqual({
      used: 1,
      lastIndex: null,
      reason: null,
      spotlight: [],
    });
    expect(restored.now).toBe(1_700_000_000_000);
  });

  it("hydrates on an absent record without touching the board", () => {
    const restored = sudokuPlayReducer(initial, {
      type: "restore",
      record: undefined,
      now: 42,
    });

    expect(restored.hydrated).toBe(true);
    expect(restored.entries).toEqual(EMPTY_ENTRIES);
    expect(restored.now).toBe(42);
  });

  it("ignores another game's record", () => {
    const restored = sudokuPlayReducer(initial, {
      type: "restore",
      record: {
        v: 1,
        game: "binairo",
        date: DATE,
        entries: Array.from({ length: 64 }, () => null),
        elapsedMs: 1_000,
        hintsUsed: 0,
        concluded: false,
        pendingSync: false,
        syncOutcome: "pending",
      },
      now: 7,
    });

    expect(restored.hydrated).toBe(true);
    expect(restored.entries).toEqual(EMPTY_ENTRIES);
    expect(restored.timer.accumulatedMs).toBe(0);
  });

  it("restores a concluded record as solved and still pending sync", () => {
    const restored = sudokuPlayReducer(initial, {
      type: "restore",
      record: record({
        entries: SOLUTION.map((digit, index) =>
          PUZZLE.givens[index] === 0 ? digit : null,
        ),
        concluded: true,
        pendingSync: true,
      }),
      now: 1,
    });

    expect(restored.status).toBe("solved");
    expect(restored.pendingSync).toBe(true);
  });
});
