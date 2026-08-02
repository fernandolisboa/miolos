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

/**
 * A 5×5 nonogram board: 25 cells, `1` = preenchida, `0` = marcada, `null` =
 * vazia (plan 020 P11). The diagonal is painted, so `entries` and `grid`
 * differ in the one way that matters — a cross reads as `0` on the wire.
 */
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
    // The read path owes the same predicate as `listPendingRecords` and
    // `prunePlayRecords`: `playRecordKey(record.game, record.date) === key`.
    // It used to check `game` alone, so a hand-edited store could park a
    // record dated 2026-07-01 at today's key and `/…/concluido` — which
    // never prunes — would stamp that day's time and, for a nonogram, paint
    // that day's picture, while the sync queue could not see it at all
    // (step-6 round-3 finding
    // `readplayrecord-does-not-address-check-its-key`).
    const strayDate = JSON.stringify(
      record({ date: "2026-07-01", concluded: true, pendingSync: true }),
    );
    window.localStorage.setItem("miolos:play:binairo:2026-07-30", strayDate);
    expect(readPlayRecord("binairo", "2026-07-30")).toBeUndefined();

    // The `game` half still holds, and so does the nonogram member: a
    // 25-cell 5×5 record parked at a date it does not carry must not reach
    // `restore` and be `derive`d against today's board.
    const strayGame = JSON.stringify(nonogramRecord({ date: "2026-07-29" }));
    window.localStorage.setItem("miolos:play:nonogram:2026-07-30", strayGame);
    expect(readPlayRecord("nonogram", "2026-07-30")).toBeUndefined();

    // Anti-vacuity: the identical record written through the real writer,
    // which derives the key from the record, is readable.
    writePlayRecord(nonogramRecord({ date: "2026-07-29" }));
    expect(readPlayRecord("nonogram", "2026-07-29")).toBeDefined();
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

  it("refuses a record that does not address its own key (T-WEB-S62)", () => {
    // `readPlayRecord` already cross-checks `game` against the key; the queue
    // owes the same on BOTH fields, and for a sharper reason. `sync.ts`
    // settles with `writePlayRecord`, which derives the key from the RECORD —
    // so a record sitting at today's key while carrying an older `date` is
    // POSTed, 404s against the api's accepted-days bound, gets settled into a
    // brand-new key, and is picked up again at this one on the next mount,
    // every `online`, every `visibilitychange` and every rung of the retry
    // ladder, forever (finding
    // `pending-queue-trusts-a-record-that-does-not-address-its-own-key`). No
    // product path writes one — this is the hand-edited store the schema is
    // the wall against.
    const stray = JSON.stringify(
      record({ date: "2026-07-25", pendingSync: true }),
    );
    window.localStorage.setItem("miolos:play:binairo:2026-07-30", stray);
    window.localStorage.setItem("miolos:play:sudoku:2026-07-25", stray);

    expect(listPendingRecords()).toEqual([]);

    // And pruning DROPS it, rather than keeping it forever the way a real
    // pending record is kept: it can never be settled, so there is nothing
    // to preserve.
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

  it("queues and prunes every game out of the one game-blind store", () => {
    // `listPendingRecords` is game-blind on purpose: that is what lets
    // sync.ts be exactly one module (ADR-0029, plan 018 S1).
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

    expect(readPlayRecord("sudoku", "2026-07-28")).toBeUndefined();
    expect(readPlayRecord("sudoku", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("binairo", "2026-07-29")).toBeDefined();
    expect(readPlayRecord("nonogram", "2026-07-29")).toBeDefined();
  });
});

describe("the nonogram member (T-WEB-S40)", () => {
  it("round-trips a nonogram record, `size` and `grid` included, still at v: 1", () => {
    // `v` STAYS 1 (ADR-0029 consequence (d)): a bump discards every stored
    // record on deploy, and a discarded record with `pendingSync: true` is
    // the only copy of a completion the server has not acknowledged.
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
    // `size` is a DATUM, not `Math.sqrt(entries.length)` (P15): `sync.ts`
    // builds the POST body from the record ALONE with no board in scope, and
    // the conclusion's picture wrapper lays the bitmap out from it.
    expect(read).toMatchObject({ size: 5 });
    expect(playRecordKey("nonogram", "2026-07-30")).toBe(
      "miolos:play:nonogram:2026-07-30",
    );
  });

  it("rejects a size outside the four weekday classes", () => {
    // `nonogramSizeSchema` comes from @miolos/core and is never re-declared:
    // one definition, three consumers. A fifth size class is exactly the
    // content-shape drift ADR-0024 wants to fail closed on.
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
    // The `superRefine` is what bounds the arrays: `writePlayRecord` does not
    // parse on write — see `play-record.ts`'s own TSDoc — so the schema on
    // READ is the only wall there is (P15).
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

    // The same record with a size that DOES agree parses, so the two cases
    // above fail on the cross-check and not on something incidental.
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
    // `.max(225)` is a plain length CEILING and is deliberately NOT sold as
    // an allocation bound: measured against the installed zod 4.4.3, array
    // element parsing runs BEFORE array-level checks. What it buys is a
    // schema-level statement of the maximum board area that holds
    // independently of `size` (P15, CLI-4/SRV-6).
    const parsed = playRecordSchema.safeParse({
      ...nonogramRecord(),
      entries: Array.from({ length: 1_000_000 }, () => 0),
    });

    expect(parsed.success).toBe(false);
  });

  it("leaves the two shipped members parsing exactly as they did", () => {
    // The third member is additive: a discriminated union on `game` cannot
    // change how the other two parse, and this is the assertion that says so
    // out loud rather than trusting it.
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
