import {
  dailySudokuResponseSchema,
  type DailySudokuResponse,
} from "@miolos/core";
import {
  generateDailySudoku,
  getSudokuConflicts,
  isSudokuSolved,
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

// T-WEB-S1..S7 (plan 018 §15). The reducer is pure — no React, no DOM, no
// clock — so the whole gameplay state machine is covered by plain unit
// tests and the screen stays thin (plan 017 D6).

// Weekday 1 is tier 1, the cheapest rung of SUDOKU_WEEKDAY_CRITERIA
// (~0.7 ms per generation, plan 018 §19.6).
const PUZZLE = generateDailySudoku({ seed: 20_260_801, weekday: 1 });

const DATE = "2026-08-01";

/** 81 empty cells — the shape the client's `entries` always has (S6). */
const EMPTY_ENTRIES: readonly (SudokuDigit | null)[] = Array.from(
  { length: 81 },
  () => null,
);

/**
 * A daily built the way the wall builds one: parsed through the response
 * schema, never cast. `givens` on `SudokuPuzzle` is a plain
 * `readonly number[]`, and the schema is what proves it is 81 cells of 0–9.
 */
function daily(givens: readonly number[] = PUZZLE.givens): DailySudokuResponse {
  return dailySudokuResponseSchema.parse({
    game: "sudoku",
    date: DATE,
    givens,
    tier: PUZZLE.tier,
  });
}

/** A synthetic daily with nothing given, so a test can name every cell. */
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

/** Select then write — the two-step model S3 fixes for Sudoku. */
function write(
  state: SudokuPlayState,
  index: number,
  digit: SudokuDigit,
): SudokuPlayState {
  return play(state, { type: "select", index }, { type: "enter-digit", digit });
}

/**
 * The fixture's solution as digits. Narrowed by a throw rather than by a
 * cast (CLAUDE.md bans `as` in tests); a published daily is uniquely
 * solvable by construction, so the throw is unreachable.
 */
function solutionOf(givens: readonly number[]): readonly SudokuDigit[] {
  const digits = solutionDigits(givens);
  if (digits === null) {
    throw new Error("a published daily is uniquely solvable by construction");
  }
  return digits;
}

const SOLUTION = solutionOf(PUZZLE.givens);

/** The solution's digit at `index`, narrowed by a throw rather than a cast. */
function digitAt(index: number): SudokuDigit {
  const digit = SOLUTION[index];
  if (digit === undefined) {
    throw new Error(`the solution has no digit at index ${String(index)}`);
  }
  return digit;
}

/** The last cell the player is free to write in. */
const LAST_PLAYABLE = PUZZLE.givens.reduce(
  (last, cell, index) => (cell === 0 ? index : last),
  -1,
);

/** A state over the synthetic all-empty daily, so a test can name any cell. */
function blankState(): SudokuPlayState {
  return initSudokuPlayState(BLANK);
}

/** Fill every playable cell from the solution, optionally skipping one. */
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
    // The caret appears on first interaction, so the first paint carries no
    // state the record might contradict (plan 017 D28, §8.1).
    expect(state.selected).toBeNull();
    expect(state.now).toBe(0);
    expect(elapsedMs(state.timer, state.now)).toBe(0);
    expect(state.timer.runningSince).toBeNull();
    expect(state.hint).toEqual({ free: 1, used: 0, lastIndex: null });
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
  // T-WEB-S3. Every `@miolos/games/sudoku` entry point calls
  // `assertSudokuGrid` and throws a TypeError on a grid that is not 81
  // integers 0–9 (landmine 8). A FIXED ENUMERATION of sequences, never
  // `fc.assert` — ADR-0017 scopes fast-check to packages/games (§3).
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
  // Row, column and box, each isolated: 0/3 share only a row, 0/27 share
  // only a column, 0/10 share only a box.
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
    // Anything that is not a fresh transition leaves it settled.
    expect(
      sudokuPlayReducer(synced, { type: "select", index: 0 }).pendingSync,
    ).toBe(false);
    expect(sudokuPlayReducer(synced, { type: "mark-synced" })).toBe(synced);
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
    // The wrap this rules out: column 9 must not become column 1 of the
    // next row (§8.3).
    expect(
      sudokuPlayReducer(topRight, {
        type: "move-selection",
        rows: 0,
        columns: 1,
      }).selected,
    ).toBe(8);
  });

  it("lands Home and End on the row's first and last column", () => {
    // The keyboard's Home/End are exactly a full-width clamped move (§8.4),
    // which is why they need no action of their own.
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
  const firstEmpty = PUZZLE.givens.findIndex((cell) => cell === 0);

  it("reveals the first empty cell and spends the one free hint", () => {
    const hinted = sudokuPlayReducer(initial, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.entries[firstEmpty]).toBe(SOLUTION[firstEmpty]);
    expect(hinted.hint).toEqual({ free: 1, used: 1, lastIndex: firstEmpty });
  });

  it("leaves the caret exactly where the player put it", () => {
    // §8.3: the caret is the player's, the highlight is the app's. Moving
    // it would make `hint-filled` and `selected` the same cell forever, and
    // the hint would have no visual payload of its own (§12.5).
    const at = play(initial, { type: "select", index: 80 });
    const hinted = sudokuPlayReducer(at, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(hinted.selected).toBe(80);
  });

  it("is capped at one", () => {
    const hinted = sudokuPlayReducer(initial, {
      type: "use-hint",
      solution: SOLUTION,
    });
    const again = sudokuPlayReducer(hinted, {
      type: "use-hint",
      solution: SOLUTION,
    });

    expect(again).toBe(hinted);
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
    // The defined `null` branch: a solution the hint cannot read (what
    // `solutionDigits` returning null degenerates to) reveals nothing and
    // costs nothing.
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
    expect(restored.hint).toEqual({ free: 1, used: 1, lastIndex: null });
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
    // `readPlayRecord` already discards a record whose `game` disagrees with
    // its key (S17); this is the second half — a 64-cell binairo `entries`
    // array must never reach an 81-cell grid.
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
