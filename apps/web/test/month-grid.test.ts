import { epochDay } from "@miolos/core";
import { describe, expect, it } from "vitest";

import { buildMonthCells, WEEK_LENGTH } from "../src/calendar/month-grid";

// The shared month-grid geometry (#163, plan 065 D4) — extracted from the
// stats calendar so the archive grid rides the identical arithmetic. The
// stats suites keep exercising the delegating wrapper; this file pins the
// generic seam itself. Weekday facts used below are calendar facts, stated
// once here: 2026-08-01 is a Saturday, 2028-02-01 a Tuesday, 1969-12-01 a
// Monday; weeks are Sunday-first (0 = Sunday).

describe("the shared month-grid geometry (T-WEB-S309)", () => {
  it("2026-08 — 31 days starting Saturday — is the 6-week worst case: 42 cells", () => {
    const { month, cells } = buildMonthCells("2026-08", (day) => day);

    expect(month).toBe("2026-08-01");
    // Saturday is column 6, so the first week carries six leading pads —
    // and 6 + 31 = 37 rounds up to SIX whole weeks. This is the tallest
    // grid a month can produce, and the worst-case fixture the impeccable
    // evidence renders (plan 065 §worst case).
    expect(cells).toHaveLength(42);
    expect(cells.length / WEEK_LENGTH).toBe(6);
    expect(cells.slice(0, 6)).toEqual([null, null, null, null, null, null]);
    expect(cells[6]).toBe(epochDay("2026-08-01"));
    expect(cells.slice(37)).toEqual([null, null, null, null, null]);
  });

  it("calls cellAt once per in-month day, in order — null is out-of-month padding ONLY", () => {
    const seen: number[] = [];
    const { cells } = buildMonthCells("2026-08", (day) => {
      seen.push(day);
      return { day };
    });

    const first = epochDay("2026-08-01");
    expect(seen).toHaveLength(31);
    expect(seen).toEqual(
      Array.from({ length: 31 }, (_, offset) => first + offset),
    );
    // Every non-null cell is exactly what cellAt answered, in day order.
    expect(cells.filter((cell) => cell !== null)).toEqual(
      seen.map((day) => ({ day })),
    );
  });

  it("February: 29 cells in a leap year, 28 otherwise, whole weeks either way", () => {
    const leap = buildMonthCells("2028-02", (day) => day);
    // Tuesday start: two leading pads, 2 + 29 = 31, padded to five weeks.
    expect(leap.cells).toHaveLength(35);
    expect(leap.cells.filter((cell) => cell !== null)).toHaveLength(29);
    expect(leap.cells[2]).toBe(epochDay("2028-02-01"));

    const plain = buildMonthCells("2026-02", (day) => day);
    expect(plain.cells.filter((cell) => cell !== null)).toHaveLength(28);
    expect(plain.cells.length % WEEK_LENGTH).toBe(0);
  });

  it("pre-1970 months take the Euclidean branch: 1969-12 leads with ONE pad, not garbage", () => {
    // `epochDay("1969-12-01")` is negative, and JS `%` follows the
    // dividend's sign — the raw remainder would be -6. The Euclidean form
    // answers 1 (Monday), which is the branch this fixture exists to keep
    // exercised even though no shipped producer emits a pre-1970 date.
    const { cells } = buildMonthCells("1969-12", (day) => day);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe(epochDay("1969-12-01"));
    expect(cells.filter((cell) => cell !== null)).toHaveLength(31);
    expect(cells.length % WEEK_LENGTH).toBe(0);
  });
});
