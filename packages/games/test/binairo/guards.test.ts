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

// Typed rejections at the engine's public edge (step-6 review findings):
// an out-of-range weekday or an oversized grid must fail with a RangeError
// up front — not an incidental TypeError deep in a criteria lookup, and
// not a CPU/stack-exhausting search on an attacker-sized grid.

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
    // Simulates an untyped boundary (plain-JS caller, JSON config); the
    // cast is the point of the test.
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
    const oversized = Array.from({ length: 100 }, () => null); // 10×10
    expect(() => countBinairoSolutions(oversized)).toThrow(RangeError);
    expect(() => solveBinairo(oversized)).toThrow(RangeError);
    expect(() => gradeBinairo(oversized)).toThrow(RangeError);
    expect(() => findBinairoViolations(oversized)).toThrow(RangeError);
  });
});
