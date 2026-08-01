import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPendingRecords,
  playRecordKey,
  prunePlayRecords,
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";

// T-WEB-15, carried forward as T-WEB-S11 (plan 018 §15). The play record is
// the in-flight state AND the sync queue (D18), read back out of
// user-editable localStorage — so every read is a boundary parse, never a
// cast. Since #23 it is a discriminated union on `game`, still at `v: 1`.

const EMPTY_ENTRIES: BinairoPlayRecord["entries"] = Array.from(
  { length: 64 },
  () => null,
);

const SOLVED_GRID: NonNullable<BinairoPlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

function record(overrides: Partial<BinairoPlayRecord> = {}): BinairoPlayRecord {
  return {
    v: 1,
    game: "binairo",
    date: "2026-07-30",
    entries: EMPTY_ENTRIES,
    elapsedMs: 12_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
    ...overrides,
  };
}

const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** 81 digits, none of them 0 — the engine's empty sentinel never lands here. */
const SOLVED_DIGITS: NonNullable<SudokuPlayRecord["grid"]> = Array.from(
  { length: 9 },
  () => DIGITS,
).flat();

function sudokuRecord(
  overrides: Partial<SudokuPlayRecord> = {},
): SudokuPlayRecord {
  return {
    v: 1,
    game: "sudoku",
    date: "2026-07-30",
    entries: Array.from({ length: 81 }, () => null),
    elapsedMs: 12_000,
    hintsUsed: 0,
    concluded: false,
    pendingSync: false,
    syncOutcome: "pending",
    ...overrides,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("playRecordKey", () => {
  it("keys on the server's date string, so a rollover starts a clean record", () => {
    expect(playRecordKey("binairo", "2026-07-30")).toBe(
      "miolos:play:binairo:2026-07-30",
    );
    expect(playRecordKey("binairo", "2026-07-31")).not.toBe(
      playRecordKey("binairo", "2026-07-30"),
    );
  });
});

describe("readPlayRecord / writePlayRecord", () => {
  it("round-trips a record including the solved grid", () => {
    const written = record({
      entries: SOLVED_GRID,
      grid: SOLVED_GRID,
      elapsedMs: 272_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: true,
      syncOutcome: "pending",
    });
    writePlayRecord(written);

    expect(readPlayRecord("binairo", "2026-07-30")).toEqual(written);
  });

  it("writes under the key derived from the record's own date", () => {
    writePlayRecord(record({ date: "2026-08-01" }));

    expect(
      window.localStorage.getItem(playRecordKey("binairo", "2026-08-01")),
    ).not.toBeNull();
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();
  });

  it("returns undefined for a missing record", () => {
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();
  });

  it("discards garbage, a tampered shape and a wrong version rather than migrating", () => {
    const key = playRecordKey("binairo", "2026-07-30");

    window.localStorage.setItem(key, "not json at all");
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...record(), entries: [0, 1] }),
    );
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(key, JSON.stringify({ ...record(), v: 2 }));
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...record(), smuggled: "extra" }),
    );
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();
  });

  it("clamps an over-cap elapsedMs before writing instead of rejecting it", () => {
    writePlayRecord(record({ elapsedMs: 99_999_999 }));

    expect(readPlayRecord("binairo", "2026-07-30")?.elapsedMs).toBe(86_400_000);
  });

  it("clamps a NEGATIVE elapsedMs too, so a clock step back cannot void the record", () => {
    // `Date.now()` is not monotonic: an NTP correction or a device clock
    // change makes `now - runningSince` negative, and the schema validates
    // both bounds — so a one-sided clamp writes a value the very next read
    // discards, taking the player's grid (and any queued completion) with it
    // (finding `elapsedms-clamp-is-one-sided`).
    writePlayRecord(
      record({
        elapsedMs: -3_600_000,
        grid: SOLVED_GRID,
        concluded: true,
        pendingSync: true,
      }),
    );

    expect(readPlayRecord("binairo", "2026-07-30")?.elapsedMs).toBe(0);
    expect(listPendingRecords()).toHaveLength(1);
  });

  it("swallows a storage failure: a full quota must not break play", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new DOMException("quota", "QuotaExceededError");
      });

    expect(() => writePlayRecord(record())).not.toThrow();
    setItem.mockRestore();
  });
});

describe("listPendingRecords", () => {
  it("returns every record awaiting a sync and nothing else", () => {
    writePlayRecord(record({ date: "2026-07-28", pendingSync: false }));
    writePlayRecord(record({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(record({ date: "2026-07-30", pendingSync: true }));
    window.localStorage.setItem("miolos:play:binairo:garbage", "{{{");
    window.localStorage.setItem("unrelated-key", "left alone");

    const dates = listPendingRecords().map((pending) => pending.date);

    expect(dates.toSorted()).toEqual(["2026-07-29", "2026-07-30"]);
    expect(window.localStorage.getItem("unrelated-key")).toBe("left alone");
  });
});

describe("prunePlayRecords", () => {
  it("drops only synced records older than the server's day", () => {
    writePlayRecord(
      record({
        date: "2026-07-28",
        pendingSync: false,
        syncOutcome: "recorded",
      }),
    );
    writePlayRecord(record({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(record({ date: "2026-07-30", pendingSync: false }));
    window.localStorage.setItem("unrelated-key", "left alone");

    prunePlayRecords("2026-07-30");

    expect(readPlayRecord("binairo", "2026-07-28")).toBeUndefined();
    expect(readPlayRecord("binairo", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-30")).toBeDefined();
    expect(window.localStorage.getItem("unrelated-key")).toBe("left alone");
  });
});

describe("the union on `game` (T-WEB-S11)", () => {
  it("round-trips a sudoku record, grid included, still at v: 1", () => {
    // `v` may never be bumped: a bump discards every stored record on
    // deploy, and a discarded record with `pendingSync: true` is the only
    // copy of a completion the server has not acknowledged — a lost streak
    // day (plan 018 S17, ADR-0029 consequence (d)).
    const written = sudokuRecord({
      entries: SOLVED_DIGITS,
      grid: SOLVED_DIGITS,
      elapsedMs: 411_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: true,
    });
    writePlayRecord(written);

    expect(readPlayRecord("sudoku", "2026-07-30")).toEqual(written);
    expect(playRecordKey("sudoku", "2026-07-30")).toBe(
      "miolos:play:sudoku:2026-07-30",
    );
  });

  it("rejects a sudoku record carrying a 0 or the wrong cell count", () => {
    const key = playRecordKey("sudoku", "2026-07-30");

    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...sudokuRecord(),
        grid: [0, ...SOLVED_DIGITS.slice(1)],
      }),
    );
    expect(readPlayRecord("sudoku", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...sudokuRecord(), entries: [null, null] }),
    );
    expect(readPlayRecord("sudoku", "2026-07-30")).toBeUndefined();
  });

  it("discards a record whose game disagrees with the key it was found under", () => {
    // A hand-edited store must never feed a 64-cell binairo record into an
    // 81-cell sudoku grid (plan 018 S17, landmine 3). The key says sudoku,
    // the payload says binairo, and the payload parses perfectly well on its
    // own — only the mismatch is the defect.
    window.localStorage.setItem(
      playRecordKey("sudoku", "2026-07-30"),
      JSON.stringify(record()),
    );

    expect(readPlayRecord("sudoku", "2026-07-30")).toBeUndefined();
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();
  });

  it("queues and prunes both games out of the one game-blind store", () => {
    // `listPendingRecords` is game-blind on purpose: that is what lets
    // sync.ts be exactly one module (ADR-0029, plan 018 S1).
    writePlayRecord(record({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(sudokuRecord({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(
      sudokuRecord({
        date: "2026-07-28",
        pendingSync: false,
        syncOutcome: "recorded",
      }),
    );

    expect(
      listPendingRecords()
        .map((pending) => pending.game)
        .toSorted(),
    ).toEqual(["binairo", "sudoku"]);

    prunePlayRecords("2026-07-30");

    expect(readPlayRecord("sudoku", "2026-07-28")).toBeUndefined();
    expect(readPlayRecord("sudoku", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-29")).toBeDefined();
  });
});
