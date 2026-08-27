import { describe, expect, it } from "vitest";

import {
  countBinairoSolutions,
  findBinairoViolations,
  generateBinairo,
  gradeBinairo,
  solveBinairo,
  validateBinairo,
} from "../../src/binairo/index";
import { isWeekday, WEEKDAYS } from "../../src/index";
import type { Weekday } from "../../src/index";

describe("weekday runtime guard", () => {
  it("isWeekday accepts exactly the seven ISO weekdays", () => {
    for (const day of WEEKDAYS) {
      expect(isWeekday(day)).toBe(true);
    }
    for (const bad of [0, 8, -1, 3.5, Number.NaN]) {
      expect(isWeekday(bad)).toBe(false);
    }
  });

  it("generateBinairo and validateBinairo throw RangeError on an out-of-range weekday", () => {
    const bad = 0 as Weekday;
    expect(() => generateBinairo({ seed: 1, weekday: bad })).toThrow(
      RangeError,
    );
    const givens = Array.from({ length: 64 }, () => null);
    expect(() => validateBinairo({ givens }, bad)).toThrow(RangeError);
  });
});

describe("grid size cap", () => {
  it("solver entry points reject sides above BINAIRO_SIZE with RangeError", () => {
    const oversized = Array.from({ length: 100 }, () => null);
    expect(() => countBinairoSolutions(oversized)).toThrow(RangeError);
    expect(() => solveBinairo(oversized)).toThrow(RangeError);
    expect(() => gradeBinairo(oversized)).toThrow(RangeError);
    expect(() => findBinairoViolations(oversized)).toThrow(RangeError);
  });
});
