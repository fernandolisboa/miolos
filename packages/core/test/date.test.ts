import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  addDays,
  dateFromEpochDay,
  epochDay,
  isoWeekdayOf,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
} from "../src/index";

describe("epochDay / dateFromEpochDay (plan 033 D9)", () => {
  it("T-CORE-S68: dateFromEpochDay ∘ epochDay is the identity over [MIN_EPOCH_DAY, MAX_EPOCH_DAY], and every guard throws RangeError", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: MIN_EPOCH_DAY, max: MAX_EPOCH_DAY }),
        (day) => {
          const date = dateFromEpochDay(day);
          expect(epochDay(date)).toBe(day);
          expect(dateFromEpochDay(epochDay(date))).toBe(date);
        },
      ),
      { numRuns: 100, seed: 20_260_813 },
    );

    expect(() => epochDay("26-08-13")).toThrow(RangeError);
    expect(() => epochDay("2026/08/13")).toThrow(RangeError);
    expect(() => epochDay("0099-01-01")).toThrow(RangeError);

    expect(epochDay("1000-01-01")).toBe(MIN_EPOCH_DAY);
    expect(epochDay("9999-12-31")).toBe(MAX_EPOCH_DAY);

    expect(() => dateFromEpochDay(0.5)).toThrow(RangeError);
    expect(() => dateFromEpochDay(Number.NaN)).toThrow(RangeError);
    expect(() => dateFromEpochDay(MIN_EPOCH_DAY - 1)).toThrow(RangeError);
    expect(() => dateFromEpochDay(MAX_EPOCH_DAY + 1)).toThrow(RangeError);
    expect(dateFromEpochDay(MIN_EPOCH_DAY)).toBe("1000-01-01");
    expect(dateFromEpochDay(MAX_EPOCH_DAY)).toBe("9999-12-31");
  });
});

describe("addDays", () => {
  it("crosses month and year ends, leap days included", () => {
    expect(addDays("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2027-02-28", 1)).toBe("2027-03-01");
    expect(addDays("2026-08-01", 0)).toBe("2026-08-01");
    expect(addDays("2026-08-01", 6)).toBe("2026-08-07");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("rejects a non-ISO date", () => {
    expect(() => addDays("01/08/2026", 1)).toThrow(RangeError);
  });
});

describe("isoWeekdayOf", () => {
  it("maps 2026-08-03 to Monday (1) and 2026-08-02 to Sunday (7)", () => {
    expect(isoWeekdayOf("2026-08-03")).toBe(1);
    expect(isoWeekdayOf("2026-08-02")).toBe(7);
    expect(isoWeekdayOf("2026-08-01")).toBe(6);
    expect(isoWeekdayOf("1969-12-31")).toBe(3);
  });

  it("rejects a non-ISO date", () => {
    expect(() => isoWeekdayOf("2026-8-3")).toThrow(RangeError);
  });
});
