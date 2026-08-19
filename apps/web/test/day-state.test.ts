import type { DayResponse } from "@miolos/core";
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
    // ADR-0043 and ADR-0045 call the number meaningless for this game. The
    // hub's `TermoDoneLink` captions the tile `em 4/6` from the server
    // value (#29); `DayEntry` still publishes no duration.
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

/**
 * The merge (#83, ADR-0060 decision 3), driven through `readDayState`'s
 * second parameter — the seam the rendered path runs too (`useDayState`
 * composes the same `applyDayTruth` body over the subscribed snapshot).
 *
 * The invariant under test, stated once: the server MAKES A CLAIM exactly
 * when its status is not `pending`; `pending` from the server is the absence
 * of a completion row and therefore the absence of a claim, never a denial.
 */
function dayPayload(
  games: Partial<DayResponse["games"]> = {},
  date: string = DATE,
): DayResponse {
  return {
    date,
    games: {
      termo: "pending",
      sudoku: "pending",
      nonogram: "pending",
      binairo: "pending",
      ...games,
    },
  };
}

describe("the merge with the server's day truth (T-WEB-S237)", () => {
  it("adds a game completed on ANOTHER device, with no duration", () => {
    // The whole point of the ticket: nothing local, and the tile is done.
    const state = readDayState(DATE, dayPayload({ sudoku: "completed" }));

    expect(state.sudoku.status).toBe("completed");
    // A time this device did not measure is not this device's to publish,
    // and the payload carries none (ADR-0060 decision 2).
    expect(state.sudoku.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(1);
  });

  it("keeps the DEVICE's claim, and its duration, where the server is silent", () => {
    // Queued or just finished: the device is ahead of the server, and it
    // keeps its claim — `pending` from the server is not a denial.
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE, dayPayload());

    expect(state.sudoku.status).toBe("completed");
    expect(state.sudoku.elapsedMs).toBe(SUDOKU_MS);
  });

  it("DEMOTES a locally-won Termo the server holds as lost, and drops the duration", () => {
    // The one demotion this ticket creates, and it is a CORRECTION: the row
    // is write-once (ADR-0026 decision 1), so the day genuinely does not
    // count for the streak and `Feito` would be a lie the player can catch.
    writePlayRecord(wonTermoRecord());

    const state = readDayState(DATE, dayPayload({ termo: "played" }));

    expect(state.termo.status).toBe("played");
    expect(state.termo.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(0);
  });

  it("PROMOTES a locally-lost Termo the server holds as won — the mirror of the same one-line rule", () => {
    // Device B wins today's Termo; device A loses all six, its POST
    // short-circuits on the composite PK and it discards the response's
    // outcome (ADR-0053 decision 10), so A's record stays `lost`. Merged,
    // the day reads completed — `Feito` one tap from this device's own loss
    // screen (ADR-0060 decision 7, flagged in plan 056 §7 item 2).
    writePlayRecord(lostTermoRecord());

    const state = readDayState(DATE, dayPayload({ termo: "completed" }));

    expect(state.termo.status).toBe("completed");
    expect(state.termo.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(1);
  });

  it("is the shipped local projection, unchanged, when there is no server truth", () => {
    writePlayRecord(sudokuRecord());
    writePlayRecord(lostTermoRecord());

    // ADR-0031 decision 1's offline fallback: `undefined` means no server
    // truth FOR ANY REASON — unfetched, 401, offline, malformed.
    expect(readDayState(DATE, undefined)).toEqual(readDayState(DATE));
  });
});

describe("the date precondition (T-WEB-S238)", () => {
  it("discards a payload for another day IN FULL, not game by game", () => {
    writePlayRecord(sudokuRecord());

    // Every game claimed by a payload dated yesterday: none of it lands.
    const state = readDayState(
      DATE,
      dayPayload(
        {
          termo: "completed",
          sudoku: "played",
          nonogram: "completed",
          binairo: "completed",
        },
        OTHER_DATE,
      ),
    );

    expect(state).toEqual(readDayState(DATE));
    expect(state.sudoku.status).toBe("completed");
    expect(state.sudoku.elapsedMs).toBe(SUDOKU_MS);
    expect(state.termo.status).toBe("pending");
    expect(state.nonogram.status).toBe("pending");
    expect(state.binairo.status).toBe("pending");
  });

  it("is what makes the São Paulo rollover safe: yesterday's dones never paint today's tiles", () => {
    // The web server's clock and the DB's can disagree for seconds across
    // midnight. A payload for the other day is evidence about a different
    // question, not weaker evidence about this one.
    const state = readDayState(
      DATE,
      dayPayload({ binairo: "completed" }, OTHER_DATE),
    );
    expect(completedCount(state)).toBe(0);
  });
});

describe("the merge never invents a pending (T-WEB-S243)", () => {
  it("no server payload can demote a local `completed` to `pending`", () => {
    writePlayRecord(binairoRecord());
    writePlayRecord(sudokuRecord());

    for (const server of ["pending", "completed", "played"] as const) {
      const state = readDayState(
        DATE,
        dayPayload({ binairo: server, sudoku: server }),
      );
      // The one permitted demotion is `completed` -> `played` (asserted in
      // T-WEB-S237); `pending` out of a local `completed` is impossible,
      // because `mergeDayStatus` returns the LOCAL value exactly when the
      // server said `pending`.
      expect(state.binairo.status, server).not.toBe("pending");
      expect(state.sudoku.status, server).not.toBe("pending");
    }
  });

  it("answers `pending` for a game only when both sides are silent", () => {
    const state = readDayState(DATE, dayPayload());
    expect(completedCount(state)).toBe(0);
    for (const game of ["termo", "sudoku", "nonogram", "binairo"] as const) {
      expect(state[game].status, game).toBe("pending");
    }
  });
});
