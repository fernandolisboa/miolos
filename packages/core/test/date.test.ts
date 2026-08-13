import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  dateFromEpochDay,
  epochDay,
  MAX_EPOCH_DAY,
  MIN_EPOCH_DAY,
} from "../src/index";

/**
 * The hoisted day arithmetic (plan 033 D9): `epochDay` moved out of
 * `streak.ts` unchanged, plus its productionised inverse. The round trip is
 * proved over exactly the domain the inverse's guards admit — outside it the
 * naive formula lies (pre-1000 emits "0999-…", which `epochDay` rejects;
 * past 9999 `toISOString` emits expanded-year forms whose `slice(0, 10)` is
 * garbage), which is why the guards exist at all.
 */
describe("epochDay / dateFromEpochDay (plan 033 D9)", () => {
  it("T-CORE-S68: dateFromEpochDay ∘ epochDay is the identity over [MIN_EPOCH_DAY, MAX_EPOCH_DAY], and every guard throws RangeError", () => {
    // The identity as a property over the guards' own domain (ADR-0023).
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

    // `epochDay`'s two guards survive the hoist — the T-CORE-S35 claims,
    // re-homed at the module's own seam (streak.test.ts keeps its copy at
    // the computeStreak seam, untouched).
    expect(() => epochDay("26-08-13")).toThrow(RangeError);
    expect(() => epochDay("2026/08/13")).toThrow(RangeError);
    expect(() => epochDay("0099-01-01")).toThrow(RangeError);
    // The floor is exact: year 1000 is arithmetic, not an error, and the
    // exported bounds are the derived mirror of both guards.
    expect(epochDay("1000-01-01")).toBe(MIN_EPOCH_DAY);
    expect(epochDay("9999-12-31")).toBe(MAX_EPOCH_DAY);

    // The inverse refuses everything the round trip cannot survive.
    expect(() => dateFromEpochDay(0.5)).toThrow(RangeError);
    expect(() => dateFromEpochDay(Number.NaN)).toThrow(RangeError);
    expect(() => dateFromEpochDay(MIN_EPOCH_DAY - 1)).toThrow(RangeError);
    expect(() => dateFromEpochDay(MAX_EPOCH_DAY + 1)).toThrow(RangeError);
    expect(dateFromEpochDay(MIN_EPOCH_DAY)).toBe("1000-01-01");
    expect(dateFromEpochDay(MAX_EPOCH_DAY)).toBe("9999-12-31");
  });
});
