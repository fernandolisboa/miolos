import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import {
  completedCount,
  readDayState,
  useDayState,
} from "../src/play/day-state";
import {
  playRecordKey,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
  type TermoPlayRecord,
} from "../src/play/play-record";

// T-WEB-S14, T-WEB-S15 (plan 018 §15) and T-WEB-S79 (plan 022 §15, ADR-0044).
// Per-device day state is a LOCAL, MONOTONE-SAFE affordance (ADR-0031): a
// concluded record proves this device finished that game today; absence
// proves nothing at all and must render as pending, which is also the
// cold-profile default and what a second device sees. A false `pending` is
// invisible; a false `done` would not be — so the enumeration below is the
// whole contract.
//
// #27 splits "finished" into CONTEXT.md's two verbs: `completed` (won, or a
// solved grid) and `played` (a lost Termo, which ADR-0008 decision 3 says
// completes nothing and enters no count). `pending` is untouched.

const DATE = "2026-07-30";
const OTHER_DATE = "2026-07-29";
const BINAIRO_MS = 407_000;
const SUDOKU_MS = 512_000;
const TERMO_MS = 188_000;

type Tiles = TermoPlayRecord["guesses"][number]["tiles"];
const MISS: Tiles = ["absent", "present", "absent", "absent", "present"];
const WIN: Tiles = ["correct", "correct", "correct", "correct", "correct"];

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

/** A won Termo: five misses and a winning row last. */
function wonTermoRecord(
  overrides: Partial<TermoPlayRecord> = {},
): TermoPlayRecord {
  return {
    v: 1,
    game: "termo",
    date: DATE,
    guesses: [
      { guess: "cafes", tiles: [...MISS] },
      { guess: "praga", tiles: [...WIN] },
    ],
    answer: "praga",
    outcome: "won",
    elapsedMs: TERMO_MS,
    hintsUsed: 0,
    concluded: true,
    pendingSync: false,
    syncOutcome: "recorded",
    ...overrides,
  };
}

/** A lost Termo: six judged rows, none of them a win. */
function lostTermoRecord(
  overrides: Partial<TermoPlayRecord> = {},
): TermoPlayRecord {
  return wonTermoRecord({
    guesses: "abcdef".split("").map((letter) => ({
      guess: letter.repeat(5),
      tiles: [...MISS],
    })),
    outcome: "lost",
    ...overrides,
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("readDayState (T-WEB-S14)", () => {
  it("marks a game completed only from a concluded record for that exact date", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE);

    expect(state.sudoku.status).toBe("completed");
    expect(state.sudoku.elapsedMs).toBe(SUDOKU_MS);
    expect(state.binairo.status).toBe("pending");
    expect(state.nonogram.status).toBe("pending");
    expect(state.termo.status).toBe("pending");
  });

  it("reads every game the hub lists, so a missing key cannot be a missing tile", () => {
    const state = readDayState(DATE);

    // TOTAL by construction: `Record<Game, DayEntry>` cannot lose a key
    // without failing the typecheck. #27 does not widen it — `GAMES` has
    // held all four games from day one — so what this pins is the map, not a
    // tripwire for that ticket (finding
    // `day-state-exhaustiveness-tripwire-cannot-fire-for-25-27`).
    expect(Object.keys(state).sort()).toEqual(
      ["binairo", "nonogram", "sudoku", "termo"].sort(),
    );
  });

  it("carries no elapsed time for a game this device has not concluded", () => {
    writePlayRecord(sudokuRecord({ concluded: false }));

    const state = readDayState(DATE);

    // A part-played board has a real `elapsedMs`, and publishing it as the
    // day's result would put a time on a game nobody finished.
    expect(state.sudoku.status).toBe("pending");
    expect(state.sudoku.elapsedMs).toBeUndefined();
  });

  it("counts what is completed, and only what is completed", () => {
    expect(completedCount(readDayState(DATE))).toBe(0);

    writePlayRecord(sudokuRecord());
    expect(completedCount(readDayState(DATE))).toBe(1);

    writePlayRecord(binairoRecord());
    expect(completedCount(readDayState(DATE))).toBe(2);

    writePlayRecord(binairoRecord({ concluded: false }));
    expect(completedCount(readDayState(DATE))).toBe(1);
  });
});

/**
 * CONTEXT.md's three verbs, minus the late completion a local reader cannot
 * see (#31 owns that). `played` exists because ADR-0008 decision 3 makes a
 * lost Termo *played* and never *completed*: it counts for neither streak nor
 * Dia Perfeito, and it is still visibly finished for the day.
 */
describe("the three verbs (T-WEB-S79)", () => {
  it("reads a LOST termo as played, with no duration at all", () => {
    writePlayRecord(lostTermoRecord());

    const entry = readDayState(DATE).termo;

    expect(entry.status).toBe("played");
    // ADR-0044 decision 4: a duration beside a loss frames it as a result.
    expect(entry.elapsedMs).toBeUndefined();
  });

  it("reads a WON termo as completed, and still publishes no duration", () => {
    // The third option §6.2 missed, recorded in plan 022 §15.3: Termo's
    // elapsed time includes every per-guess round trip (§14.4), and both
    // ADR-0043 and ADR-0045 call the number meaningless for this game. So
    // the hub and the day card show the done shape without a number until
    // #29 lands `em 4/6`.
    writePlayRecord(wonTermoRecord());

    const entry = readDayState(DATE).termo;

    expect(entry.status).toBe("completed");
    expect(entry.elapsedMs).toBeUndefined();
  });

  it("leaves the three shipped games' durations exactly where they were", () => {
    // The `elapsedMs: undefined` arm is reached ONLY by a termo record, so
    // no shipped chip or hub tile loses its duration (ADR-0044 consequence
    // (b)).
    writePlayRecord(binairoRecord());
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE);

    expect(state.binairo).toEqual({
      status: "completed",
      elapsedMs: BINAIRO_MS,
    });
    expect(state.sudoku).toEqual({
      status: "completed",
      elapsedMs: SUDOKU_MS,
    });
  });

  it("keeps a played termo OUT of the completed count", () => {
    // ADR-0008 decision 4: "A day containing a lost Termo is not perfect,
    // whatever else happened."
    writePlayRecord(lostTermoRecord());
    writePlayRecord(sudokuRecord());

    expect(completedCount(readDayState(DATE))).toBe(1);

    writePlayRecord(wonTermoRecord());
    expect(completedCount(readDayState(DATE))).toBe(2);
  });

  it("is DERIVED, never persisted: an unparseable record fails toward pending", () => {
    // `DayEntry` is built in memory on every read, so reshaping it needs no
    // `localStorage` migration (ADR-0044 consequence (j)). A record that
    // fails to parse returns `undefined` from `parseAt`, so `entryFor`
    // answers PENDING — the safe direction ADR-0031 decision 2 names.
    window.localStorage.setItem(
      playRecordKey("termo", DATE),
      JSON.stringify({ ...lostTermoRecord(), v: 99 }),
    );

    expect(readDayState(DATE).termo).toEqual({
      status: "pending",
      elapsedMs: undefined,
    });
  });

  it("re-reads when only the STATUS moved, with both durations absent", () => {
    // `sameDayState` compares `status` and not merely `elapsedMs`: a won and
    // a lost Termo both carry `elapsedMs: undefined`, so a comparator that
    // watched the duration alone would hand the hub a cached `completed`
    // for the rest of the session.
    writePlayRecord(wonTermoRecord());

    const { result } = renderHook(() => useDayState(DATE));
    expect(result.current.termo.status).toBe("completed");

    act(() => {
      writePlayRecord(lostTermoRecord());
      window.dispatchEvent(new StorageEvent("storage"));
    });

    expect(result.current.termo.status).toBe("played");
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

      expect(entry.status).toBe("pending");
      expect(entry.elapsedMs).toBeUndefined();
      expect(completedCount(readDayState(DATE))).toBe(0);
    });
  }

  it("still reads the record on the day it was actually written", () => {
    // The anti-vacuity half of the `wrong date` row above: the fixture is a
    // real concluded record, so that row proves the date key and not a
    // broken factory.
    writePlayRecord(sudokuRecord({ date: OTHER_DATE }));

    expect(readDayState(OTHER_DATE).sudoku).toEqual({
      status: "completed",
      elapsedMs: SUDOKU_MS,
    });
  });
});
