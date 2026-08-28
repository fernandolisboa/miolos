import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPendingRecords,
  playRecordKey,
  playRecordSchema,
  prunePlayRecords,
  readPlayRecord,
  writePlayRecord,
  type BinairoPlayRecord,
  type NonogramPlayRecord,
  type SudokuPlayRecord,
} from "../src/play/play-record";

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

const NONOGRAM_ENTRIES: NonogramPlayRecord["entries"] = Array.from(
  { length: 25 },
  (_unused, index) => (index % 6 === 0 ? 1 : null),
);

const NONOGRAM_GRID: NonNullable<NonogramPlayRecord["grid"]> = Array.from(
  { length: 25 },
  (_unused, index) => (index % 6 === 0 ? 1 : 0),
);

function nonogramRecord(
  overrides: Partial<NonogramPlayRecord> = {},
): NonogramPlayRecord {
  return {
    v: 1,
    game: "nonogram",
    date: "2026-07-30",
    size: 5,
    entries: NONOGRAM_ENTRIES,
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

  it("refuses a record that does not ADDRESS the key it was found under (T-WEB-S63)", () => {
    const strayDate = JSON.stringify(
      record({ date: "2026-07-01", concluded: true, pendingSync: true }),
    );
    window.localStorage.setItem("miolos:play:binairo:2026-07-30", strayDate);
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();

    const strayGame = JSON.stringify(nonogramRecord({ date: "2026-07-29" }));
    window.localStorage.setItem("miolos:play:nonogram:2026-07-30", strayGame);
    expect(readPlayRecord("nonogram", "2026-07-30")).toBeUndefined();

    writePlayRecord(nonogramRecord({ date: "2026-07-29" }));
    expect(readPlayRecord("nonogram", "2026-07-29")).toBeDefined();
  });

  it("clamps an over-cap elapsedMs before writing instead of rejecting it", () => {
    writePlayRecord(record({ elapsedMs: 99_999_999 }));

    expect(readPlayRecord("binairo", "2026-07-30")?.elapsedMs).toBe(86_400_000);
  });

  it("clamps a NEGATIVE elapsedMs too, so a clock step back cannot void the record", () => {
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

  it("refuses a record that does not address its own key (T-WEB-S62)", () => {
    const stray = JSON.stringify(
      record({ date: "2026-07-25", pendingSync: true }),
    );
    window.localStorage.setItem("miolos:play:binairo:2026-07-30", stray);
    window.localStorage.setItem("miolos:play:sudoku:2026-07-25", stray);

    expect(listPendingRecords()).toEqual([]);

    prunePlayRecords("2026-07-30");
    expect(window.localStorage.getItem("miolos:play:binairo:2026-07-30")).toBe(
      null,
    );
    expect(window.localStorage.getItem("miolos:play:sudoku:2026-07-25")).toBe(
      null,
    );
  });
});

describe("prunePlayRecords", () => {
  it("keeps a settled past record under the retention cap, keeps a pending one, and never touches a foreign key", () => {
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

    expect(readPlayRecord("binairo", "2026-07-28")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-30")).toBeDefined();
    expect(window.localStorage.getItem("unrelated-key")).toBe("left alone");
  });
});

describe("bounded retention (T-WEB-S186)", () => {
  const past = (date: string) =>
    record({ date, pendingSync: false, syncOutcome: "recorded" });

  it("a settled PAST record survives a later daily mount", () => {
    writePlayRecord(past("2026-03-02"));
    prunePlayRecords("2026-08-14");
    expect(readPlayRecord("binairo", "2026-03-02")).toBeDefined();
  });

  it("with 51 settled past records the OLDEST BY DATE is the one deleted, and 50 survive", () => {
    const dates = Array.from(
      { length: 51 },
      (_, index) => `2026-05-${String(index + 1).padStart(2, "0")}`,
    );
    for (const date of dates) {
      writePlayRecord(past(date));
    }

    prunePlayRecords("2026-08-14");

    const survivors = dates.filter(
      (date) => readPlayRecord("binairo", date) !== undefined,
    );
    expect(survivors).toHaveLength(50);

    expect(survivors).not.toContain("2026-05-01");
    expect(survivors[0]).toBe("2026-05-02");
  });

  it("a pendingSync record is never deleted, whatever its date or the store's size", () => {
    writePlayRecord(record({ date: "2026-01-01", pendingSync: true }));
    for (let index = 0; index < 60; index += 1) {
      writePlayRecord(
        past(`2026-05-${String((index % 28) + 1).padStart(2, "0")}`),
      );
    }
    prunePlayRecords("2026-08-14");

    expect(readPlayRecord("binairo", "2026-01-01")).toBeDefined();
  });

  it("a record that does not address its own key is still dropped, whatever its date", () => {
    const foreign = playRecordKey("sudoku", "2026-08-14");
    window.localStorage.setItem(
      foreign,
      JSON.stringify(record({ date: "2026-08-14", pendingSync: true })),
    );
    prunePlayRecords("2026-08-14");
    expect(window.localStorage.getItem(foreign)).toBeNull();
  });

  it("today's record is never a prune candidate, so the daily surfaces are untouched", () => {
    writePlayRecord(record({ date: "2026-08-14", pendingSync: false }));
    for (let index = 0; index < 60; index += 1) {
      writePlayRecord(
        past(`2026-05-${String((index % 28) + 1).padStart(2, "0")}`),
      );
    }
    prunePlayRecords("2026-08-14");
    expect(readPlayRecord("binairo", "2026-08-14")).toBeDefined();
  });
});

describe("the union on `game` (T-WEB-S11)", () => {
  it("round-trips a sudoku record, grid included, still at v: 1", () => {
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
    window.localStorage.setItem(
      playRecordKey("sudoku", "2026-07-30"),
      JSON.stringify(record()),
    );

    expect(readPlayRecord("sudoku", "2026-07-30")).toBeUndefined();
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();
  });

  it("queues and prunes every game out of the one game-blind store", () => {
    writePlayRecord(record({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(sudokuRecord({ date: "2026-07-29", pendingSync: true }));
    writePlayRecord(nonogramRecord({ date: "2026-07-29", pendingSync: true }));
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
    ).toEqual(["binairo", "nonogram", "sudoku"]);

    prunePlayRecords("2026-07-30");

    expect(readPlayRecord("sudoku", "2026-07-28")).toBeDefined();
    expect(readPlayRecord("sudoku", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("nonogram", "2026-07-29")).toBeDefined();
  });
});

describe("the nonogram member (T-WEB-S40)", () => {
  it("round-trips a nonogram record, `size` and `grid` included, still at v: 1", () => {
    const written = nonogramRecord({
      grid: NONOGRAM_GRID,
      elapsedMs: 133_000,
      hintsUsed: 1,
      concluded: true,
      pendingSync: true,
    });
    writePlayRecord(written);

    const read = readPlayRecord("nonogram", "2026-07-30");

    expect(read).toEqual(written);

    expect(read).toMatchObject({ size: 5 });
    expect(playRecordKey("nonogram", "2026-07-30")).toBe(
      "miolos:play:nonogram:2026-07-30",
    );
  });

  it("rejects a size outside the four weekday classes", () => {
    window.localStorage.setItem(
      playRecordKey("nonogram", "2026-07-30"),
      JSON.stringify({
        ...nonogramRecord(),
        size: 7,
        entries: Array.from({ length: 49 }, () => null),
      }),
    );

    expect(readPlayRecord("nonogram", "2026-07-30")).toBeUndefined();
  });

  it("rejects entries and grid lengths that disagree with the record's own size", () => {
    const key = playRecordKey("nonogram", "2026-07-30");

    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...nonogramRecord(),
        entries: Array.from({ length: 64 }, () => null),
      }),
    );
    expect(readPlayRecord("nonogram", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...nonogramRecord(),
        grid: Array.from({ length: 64 }, () => 0),
      }),
    );
    expect(readPlayRecord("nonogram", "2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({
        ...nonogramRecord(),
        size: 8,
        entries: Array.from({ length: 64 }, () => null),
        grid: Array.from({ length: 64 }, () => 0),
      }),
    );
    expect(readPlayRecord("nonogram", "2026-07-30")).toMatchObject({ size: 8 });
  });

  it("refuses an absurd entries array on the length ceiling alone", () => {
    const parsed = playRecordSchema.safeParse({
      ...nonogramRecord(),
      entries: Array.from({ length: 1_000_000 }, () => 0),
    });

    expect(parsed.success).toBe(false);
  });

  it("leaves the two shipped members parsing exactly as they did", () => {
    const binairo = record({ grid: SOLVED_GRID, entries: SOLVED_GRID });
    const sudoku = sudokuRecord({
      grid: SOLVED_DIGITS,
      entries: SOLVED_DIGITS,
    });

    expect(playRecordSchema.parse(binairo)).toEqual(binairo);
    expect(playRecordSchema.parse(sudoku)).toEqual(sudoku);
    expect(playRecordSchema.parse(binairo).v).toBe(1);
    expect(playRecordSchema.parse(sudoku).v).toBe(1);
  });
});
