import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  listPendingRecords,
  playRecordKey,
  prunePlayRecords,
  readPlayRecord,
  writePlayRecord,
  type PlayRecord,
} from "../src/binairo/play-record";

// T-WEB-15 (plan 017 §15). The play record is the in-flight state AND the
// sync queue (D18), read back out of user-editable localStorage — so every
// read is a boundary parse, never a cast.

const EMPTY_ENTRIES: PlayRecord["entries"] = Array.from(
  { length: 64 },
  () => null,
);

const SOLVED_GRID: NonNullable<PlayRecord["grid"]> = Array.from(
  { length: 64 },
  (_unused, index) => (index % 2 === 0 ? 0 : 1),
);

function record(overrides: Partial<PlayRecord> = {}): PlayRecord {
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

    expect(readPlayRecord("2026-07-30")).toEqual(written);
  });

  it("writes under the key derived from the record's own date", () => {
    writePlayRecord(record({ date: "2026-08-01" }));

    expect(
      window.localStorage.getItem(playRecordKey("binairo", "2026-08-01")),
    ).not.toBeNull();
    expect(readPlayRecord("2026-07-30")).toBeUndefined();
  });

  it("returns undefined for a missing record", () => {
    expect(readPlayRecord("2026-07-30")).toBeUndefined();
  });

  it("discards garbage, a tampered shape and a wrong version rather than migrating", () => {
    const key = playRecordKey("binairo", "2026-07-30");

    window.localStorage.setItem(key, "not json at all");
    expect(readPlayRecord("2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...record(), entries: [0, 1] }),
    );
    expect(readPlayRecord("2026-07-30")).toBeUndefined();

    window.localStorage.setItem(key, JSON.stringify({ ...record(), v: 2 }));
    expect(readPlayRecord("2026-07-30")).toBeUndefined();

    window.localStorage.setItem(
      key,
      JSON.stringify({ ...record(), smuggled: "extra" }),
    );
    expect(readPlayRecord("2026-07-30")).toBeUndefined();
  });

  it("clamps an over-cap elapsedMs before writing instead of rejecting it", () => {
    writePlayRecord(record({ elapsedMs: 99_999_999 }));

    expect(readPlayRecord("2026-07-30")?.elapsedMs).toBe(86_400_000);
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

    expect(readPlayRecord("2026-07-30")?.elapsedMs).toBe(0);
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

    expect(readPlayRecord("2026-07-28")).toBeUndefined();
    expect(readPlayRecord("2026-07-29")).toBeDefined();
    expect(readPlayRecord("2026-07-30")).toBeDefined();
    expect(window.localStorage.getItem("unrelated-key")).toBe("left alone");
  });
});
