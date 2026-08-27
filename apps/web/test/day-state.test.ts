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

    expect(Object.keys(state).sort()).toEqual(
      ["binairo", "nonogram", "sudoku", "termo"].sort(),
    );
  });

  it("carries no elapsed time for a game this device has not concluded", () => {
    writePlayRecord(sudokuRecord({ concluded: false }));

    const state = readDayState(DATE);

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

describe("the three verbs (T-WEB-S79)", () => {
  it("reads a LOST termo as played, with no duration at all", () => {
    writePlayRecord(lostTermoRecord());

    const entry = readDayState(DATE).termo;

    expect(entry.status).toBe("played");

    expect(entry.elapsedMs).toBeUndefined();
  });

  it("reads a WON termo as completed, and still publishes no duration", () => {
    writePlayRecord(wonTermoRecord());

    const entry = readDayState(DATE).termo;

    expect(entry.status).toBe("completed");
    expect(entry.elapsedMs).toBeUndefined();
  });

  it("leaves the three shipped games' durations exactly where they were", () => {
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
    writePlayRecord(lostTermoRecord());
    writePlayRecord(sudokuRecord());

    expect(completedCount(readDayState(DATE))).toBe(1);

    writePlayRecord(wonTermoRecord());
    expect(completedCount(readDayState(DATE))).toBe(2);
  });

  it("is DERIVED, never persisted: an unparseable record fails toward pending", () => {
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
    writePlayRecord(sudokuRecord({ date: OTHER_DATE }));

    expect(readDayState(OTHER_DATE).sudoku).toEqual({
      status: "completed",
      elapsedMs: SUDOKU_MS,
    });
  });
});

function dayPayload(
  games: Partial<DayResponse["games"]> = {},
  date: string = DATE,
): DayResponse {
  return {
    date,
    games: {
      termo: { status: "pending" },
      sudoku: { status: "pending" },
      nonogram: { status: "pending" },
      binairo: { status: "pending" },
      ...games,
    },
  };
}

describe("the merge with the server's day truth (T-WEB-S237)", () => {
  it("adds a game completed on ANOTHER device; a claim without a duration carries none", () => {
    const state = readDayState(
      DATE,
      dayPayload({ sudoku: { status: "completed" } }),
    );

    expect(state.sudoku.status).toBe("completed");
    expect(state.sudoku.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(1);
  });

  it("keeps the DEVICE's claim, and its duration, where the server is silent", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE, dayPayload());

    expect(state.sudoku.status).toBe("completed");
    expect(state.sudoku.elapsedMs).toBe(SUDOKU_MS);
  });

  it("DEMOTES a locally-won Termo the server holds as lost, and drops the duration", () => {
    writePlayRecord(wonTermoRecord());

    const state = readDayState(
      DATE,
      dayPayload({ termo: { status: "played" } }),
    );

    expect(state.termo.status).toBe("played");
    expect(state.termo.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(0);
  });

  it("PROMOTES a locally-lost Termo the server holds as won — the mirror of the same one-line rule", () => {
    writePlayRecord(lostTermoRecord());

    const state = readDayState(
      DATE,
      dayPayload({ termo: { status: "completed" } }),
    );

    expect(state.termo.status).toBe("completed");
    expect(state.termo.elapsedMs).toBeUndefined();
    expect(completedCount(state)).toBe(1);
  });

  it("is the shipped local projection, unchanged, when there is no server truth", () => {
    writePlayRecord(sudokuRecord());
    writePlayRecord(lostTermoRecord());

    expect(readDayState(DATE, undefined)).toEqual(readDayState(DATE));
  });
});

describe("the merged entry's duration follows the winning claim (T-WEB-S258)", () => {
  const SERVER_MS = 444_000;

  it("a cross-device completed carries the SERVER's duration", () => {
    const state = readDayState(
      DATE,
      dayPayload({ sudoku: { status: "completed", elapsedMs: SERVER_MS } }),
    );

    expect(state.sudoku).toEqual({ status: "completed", elapsedMs: SERVER_MS });
    expect(completedCount(state)).toBe(1);
  });

  it("where the server claims, its duration is the entry's — the local one is not blended in", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(
      DATE,
      dayPayload({ sudoku: { status: "completed", elapsedMs: SERVER_MS } }),
    );

    expect(state.sudoku).toEqual({ status: "completed", elapsedMs: SERVER_MS });
  });

  it("where the server is silent, the LOCAL duration stands — the mirror, no blending either way", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(DATE, dayPayload());

    expect(state.sudoku).toEqual({ status: "completed", elapsedMs: SUDOKU_MS });
  });

  it("a served `played` claim strips the duration a local win had published — the demotion drops the time with the verb", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(
      DATE,
      dayPayload({ sudoku: { status: "played" } }),
    );

    expect(state.sudoku).toEqual({ status: "played", elapsedMs: undefined });
  });

  it("a duration in a payload for ANOTHER day never lands — the date gate discards values with verbs", () => {
    const state = readDayState(
      DATE,
      dayPayload(
        { sudoku: { status: "completed", elapsedMs: SERVER_MS } },
        OTHER_DATE,
      ),
    );

    expect(state.sudoku).toEqual({ status: "pending", elapsedMs: undefined });
  });
});

describe("the date precondition (T-WEB-S238)", () => {
  it("discards a payload for another day IN FULL, not game by game", () => {
    writePlayRecord(sudokuRecord());

    const state = readDayState(
      DATE,
      dayPayload(
        {
          termo: { status: "completed" },
          sudoku: { status: "played" },
          nonogram: { status: "completed", elapsedMs: 99_000 },
          binairo: { status: "completed", elapsedMs: 42_000 },
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
    const state = readDayState(
      DATE,
      dayPayload({ binairo: { status: "completed" } }, OTHER_DATE),
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
        dayPayload({
          binairo: { status: server },
          sudoku: { status: server },
        }),
      );

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
