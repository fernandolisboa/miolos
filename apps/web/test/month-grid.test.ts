import { epochDay } from "@miolos/core";
import { describe, expect, it } from "vitest";

import { buildMonthCells, WEEK_LENGTH } from "../src/calendar/month-grid";

describe("the shared month-grid geometry (T-WEB-S309)", () => {
  it("2026-08 — 31 days starting Saturday — is the 6-week worst case: 42 cells", () => {
    const { month, cells } = buildMonthCells("2026-08", (day) => day);

    expect(month).toBe("2026-08-01");

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

    expect(cells.filter((cell) => cell !== null)).toEqual(
      seen.map((day) => ({ day })),
    );
  });

  it("February: 29 cells in a leap year, 28 otherwise, whole weeks either way", () => {
    const leap = buildMonthCells("2028-02", (day) => day);

    expect(leap.cells).toHaveLength(35);
    expect(leap.cells.filter((cell) => cell !== null)).toHaveLength(29);
    expect(leap.cells[2]).toBe(epochDay("2028-02-01"));

    const plain = buildMonthCells("2026-02", (day) => day);
    expect(plain.cells.filter((cell) => cell !== null)).toHaveLength(28);
    expect(plain.cells.length % WEEK_LENGTH).toBe(0);
  });

  it("pre-1970 months take the Euclidean branch: 1969-12 leads with ONE pad, not garbage", () => {
    const { cells } = buildMonthCells("1969-12", (day) => day);
    expect(cells[0]).toBeNull();
    expect(cells[1]).toBe(epochDay("1969-12-01"));
    expect(cells.filter((cell) => cell !== null)).toHaveLength(31);
    expect(cells.length % WEEK_LENGTH).toBe(0);
  });
});
