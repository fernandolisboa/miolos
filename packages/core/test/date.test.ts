import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dateFromEpochDay,
  epochDay,
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
