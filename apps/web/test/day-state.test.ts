import { beforeEach, describe, expect, it } from "vitest";

import { doneCount, readDayState } from "../src/play/day-state";
import {
  playRecordKey,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";

// T-WEB-S14 and T-WEB-S15 (plan 018 §15). Per-device day state is a LOCAL,
// MONOTONE-SAFE affordance (ADR-0031): a concluded record proves this device
// solved that game today; absence proves nothing at all and must render as
// pending, which is also the cold-profile default and what a second device
// sees. A false `pending` is invisible; a false `done` would not be — so the
// enumeration below is the whole contract.

const DATE = "2026-07-30";
const OTHER_DATE = "2026-07-29";
const BINAIRO_MS = 407_000;
const SUDOKU_MS = 512_000;

function binairoRecord(
  overrides: Partial<BinairoPlayRecord> = {},
): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: DATE,
    entries: Array.from({ length: 64 }, () => null),
    elapsedMs: BINAIRO_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

function sudokuRecord(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: DATE,
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs: SUDOKU_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("readDayState (T-WEB-S14)", () => {
  it("marks a game done only from a concluded record for that exact date", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE);

    expect(state.sudoku.concluded).toBe(true);
    expect(state.sudoku.elapsedMs).toBe(SUDOKU_MS);
    expect(state.binairo.concluded).toBe(false);
    expect(state.nonogram.concluded).toBe(false);
    expect(state.termo.concluded).toBe(false);
  });

  it("reads every game the hub lists, so a missing key cannot be a missing tile", () => {
    const state = readDayState(DATE);

    // Exhaustive by construction: `Record<Game, DayEntry>` is what #25/#27
    // widen by adding a key, never a branch at a call site.
    expect(Object.keys(state).sort()).toEqual(
      ["binairo", "nonogram", "sudoku", "termo"].sort(),
    );
  });

  it("carries no elapsed time for a game this device has not concluded", () => {
    writePlayRecord(sudokuRecord({ concluded: false }));

    const state = readDayState(DATE);

    // A part-played board has a real `elapsedMs`, and publishing it as the
    // day's result would put a time on a game nobody finished.
    expect(state.sudoku.concluded).toBe(false);
    expect(state.sudoku.elapsedMs).toBeUndefined();
  });

  it("counts what is done, and only what is done", () => {
    expect(doneCount(readDayState(DATE))).toBe(0);

    writePlayRecord(sudokuRecord());
    expect(doneCount(readDayState(DATE))).toBe(1);

    writePlayRecord(binairoRecord());
    expect(doneCount(readDayState(DATE))).toBe(2);

    writePlayRecord(binairoRecord({ concluded: false }));
    expect(doneCount(readDayState(DATE))).toBe(1);
  });
});

/**
 * The five inputs that must all read pending, written out as an enumeration
 * rather than as a universal claim — `apps/web` takes no fast-check
 * (ADR-0017), and a property test here would only restate the table.
 */
const NEVER_DONE: readonly {
  readonly name: string;
  readonly seed: () => void;
}[] = [
  { name: "no record at all", seed: () => undefined },
  {
    name: "a record that is not JSON",
    seed: () => {
      window.localStorage.setItem(playRecordKey("sudoku", DATE), "{ not json");
    },
  },
  {
    name: "another game's record stored under this game's key",
    seed: () => {
      // A hand-edited store: `readPlayRecord` discards a record whose own
      // `game` disagrees with the key it was found under (plan 018 S17), and
      // the day state must inherit that discard rather than trusting the key.
      window.localStorage.setItem(
        playRecordKey("sudoku", DATE),
        JSON.stringify(binairoRecord()),
      );
    },
  },
  {
    name: "a record that is not concluded",
    seed: () => {
      writePlayRecord(sudokuRecord({ concluded: false }));
    },
  },
  {
    name: "a concluded record for a different date",
    seed: () => {
      writePlayRecord(sudokuRecord({ date: OTHER_DATE }));
    },
  },
];

describe("monotone safety (T-WEB-S15)", () => {
  for (const input of NEVER_DONE) {
    it(`reads pending from ${input.name}`, () => {
      input.seed();

      const entry = readDayState(DATE).sudoku;

      expect(entry.concluded).toBe(false);
      expect(entry.elapsedMs).toBeUndefined();
      expect(doneCount(readDayState(DATE))).toBe(0);
    });
  }

  it("still reads the record on the day it was actually written", () => {
    // The anti-vacuity half of the `wrong date` row above: the fixture is a
    // real concluded record, so that row proves the date key and not a
    // broken factory.
    writePlayRecord(sudokuRecord({ date: OTHER_DATE }));

    expect(readDayState(OTHER_DATE).sudoku.concluded).toBe(true);
    expect(readDayState(OTHER_DATE).sudoku.elapsedMs).toBe(SUDOKU_MS);
  });
});
