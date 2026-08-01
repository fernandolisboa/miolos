import { describe, expect, it } from "vitest";

import { generateNonogram } from "../../src/nonogram/generate";
import { solveNonogram } from "../../src/nonogram/solve";
import { validateNonogram } from "../../src/nonogram/validate";
import type { NonogramClues } from "../../src/nonogram/types";
import type { Weekday } from "../../src/weekday";

// Typed rejections at the engine's public edge (step-6 review findings,
// mirroring test/binairo/guards.test.ts): an out-of-range weekday or a
// structurally malformed/oversized clue set must fail with a typed
// RangeError (or a reason code from the validator) up front — not an
// incidental TypeError deep in a criteria lookup, and not a CPU/memory
// exhausting solve on an attacker-sized grid.

describe("weekday runtime guard", () => {
  it("generateNonogram throws RangeError on an out-of-range weekday", () => {
    // Simulates an untyped boundary (plain-JS caller, JSON config); the
    // cast is the point of the test.
    for (const bad of [0, 8, 2.5, Number.NaN] as Weekday[]) {
      expect(() => generateNonogram(1, bad)).toThrow(RangeError);
    }
  });

  it("validateNonogram rejects an out-of-range weekday with a reason code", () => {
    const puzzle = generateNonogram(7, 4);
    const verdict = validateNonogram({ ...puzzle, weekday: 0 as Weekday });
    expect(verdict.ok).toBe(false);
    expect(verdict.failures).toContain("weekday-out-of-range");
  });
});

describe("clue structure guard", () => {
  const malformed: ReadonlyArray<readonly [string, NonogramClues]> = [
    ["oversized", { size: 100_000, rows: [], cols: [] }],
    ["negative size", { size: -1, rows: [], cols: [] }],
    ["fractional size", { size: 2.5, rows: [[1]], cols: [[1]] }],
    ["jagged line counts", { size: 2, rows: [[1]], cols: [[1], [1]] }],
    ["non-positive run", { size: 2, rows: [[0], []], cols: [[1], []] }],
  ];

  it("solveNonogram throws RangeError on malformed clue sets", () => {
    for (const [label, clues] of malformed) {
      expect(() => solveNonogram(clues), label).toThrow(RangeError);
    }
  });

  it("validateNonogram rejects malformed clue sets with a reason code", () => {
    const puzzle = generateNonogram(3, 1);
    for (const [label, clues] of malformed) {
      const verdict = validateNonogram({ ...puzzle, clues });
      expect(verdict.ok, label).toBe(false);
      expect(verdict.failures, label).toContain("clues-malformed");
    }
  });
});
