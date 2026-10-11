import { describe, expect, it } from "vitest";

import { WEEKDAYS } from "../../src/index";
import type { Weekday } from "../../src/index";
import {
  QUEENS_SIZES,
  QUEENS_WEEKDAY_CRITERIA,
  generateQueens,
  validateQueens,
} from "../../src/queens/index";
import type { QueensPuzzle } from "../../src/queens/index";
import { board, queens } from "./fixtures";

const monday = generateQueens({ seed: 1, weekday: 1 });
const tuesday = generateQueens({ seed: 1, weekday: 2 });
const friday = generateQueens({ seed: 1, weekday: 5 });
const sunday = generateQueens({ seed: 1, weekday: 7 });

const STRIPED_7 = Array.from({ length: 49 }, (_, cell) => Math.floor(cell / 7));

function failuresOf(puzzle: QueensPuzzle): readonly string[] {
  const result = validateQueens(puzzle);
  return result.ok ? [] : result.failures;
}

describe("QUEENS_WEEKDAY_CRITERIA", () => {
  it("ramps from a basic 7×7 Monday to the hardest 9×9 Sunday", () => {
    expect(QUEENS_WEEKDAY_CRITERIA[1]).toMatchObject({
      size: 7,
      maxTier: 1,
      minSteps: 0,
      maxSteps: 0,
    });
    expect(QUEENS_WEEKDAY_CRITERIA[7].size).toBe(9);
    for (const weekday of WEEKDAYS.slice(1)) {
      const today = QUEENS_WEEKDAY_CRITERIA[weekday];
      const before = QUEENS_WEEKDAY_CRITERIA[(weekday - 1) as Weekday];
      expect(QUEENS_SIZES).toContain(today.size);
      expect(today.minSteps).toBeLessThanOrEqual(today.maxSteps);
      expect(today.size).toBeGreaterThanOrEqual(before.size);
      expect(today.skew).toBeLessThanOrEqual(before.skew);
      expect(today.maxTier).toBeGreaterThanOrEqual(before.maxTier);
      expect(today.minSteps).toBeGreaterThanOrEqual(before.minSteps);
      expect(today.maxSteps).toBeGreaterThanOrEqual(before.maxSteps);
    }
  });
});

describe("validateQueens", () => {
  it("approves a generated puzzle and reports its advanced steps", () => {
    expect(validateQueens(sunday)).toEqual({
      ok: true,
      advancedSteps: sunday.advancedSteps,
    });
  });

  it("rejects a size the weekday does not use", () => {
    expect(failuresOf({ ...sunday, weekday: 1 })).toEqual(["size-mismatch"]);
  });

  it("rejects regions or a solution of the wrong shape", () => {
    expect(failuresOf({ ...monday, regions: monday.regions.slice(1) })).toEqual(
      ["malformed"],
    );
    const notBinary = monday.solution.map((cell) => cell * 2);
    expect(
      failuresOf({ ...monday, solution: notBinary as readonly (0 | 1)[] }),
    ).toEqual(["malformed"]);
    const withoutRegions = { ...monday, regions: undefined };
    expect(failuresOf(withoutRegions as unknown as QueensPuzzle)).toEqual([
      "malformed",
    ]);
    const withoutSolution = { ...monday, solution: undefined };
    expect(failuresOf(withoutSolution as unknown as QueensPuzzle)).toEqual([
      "malformed",
    ]);
  });

  it("rejects a map without exactly N region ids in range", () => {
    const merged = monday.regions.map((id) => (id === 6 ? 5 : id));
    expect(failuresOf({ ...monday, regions: merged })).toEqual([
      "region-count",
    ]);
    const outOfRange = monday.regions.map((id) => (id === 6 ? 7 : id));
    expect(failuresOf({ ...monday, regions: outOfRange })).toEqual([
      "region-count",
    ]);
  });

  it("rejects a region that is not 4-connected", () => {
    const split = STRIPED_7.map((id, cell) =>
      cell === 0 ? 6 : cell === 48 ? 0 : id,
    );
    expect(failuresOf({ ...monday, regions: split })).toContain(
      "region-disconnected",
    );
  });

  it("rejects region ids that are not numbered by first appearance", () => {
    const swapped = monday.regions.map((id) =>
      id === 0 ? 1 : id === 1 ? 0 : id,
    );
    expect(failuresOf({ ...monday, regions: swapped })).toEqual([
      "regions-not-canonical",
    ]);
  });

  it("rejects a solution that breaks the rules", () => {
    const missing = monday.solution.indexOf(1);
    const short = monday.solution.map((cell, index) =>
      index === missing ? 0 : cell,
    );
    expect(failuresOf({ ...monday, solution: short })).toEqual([
      "solution-invalid",
    ]);
  });

  it("rejects a board with a second solution", () => {
    const solution = queens(
      "Q...... ..Q.... ....Q.. ......Q .Q..... ...Q... .....Q.",
    );
    expect(failuresOf({ ...monday, regions: STRIPED_7, solution })).toEqual([
      "not-unique",
      "beyond-ladder",
    ]);
  });

  it("rejects a unique board the deduction ladder cannot finish", () => {
    const beyond = board(
      "0111121 0111111 0011113 4005111 4555661 4445611 4446611",
    );
    const solution = beyond.regions.map((_, cell) =>
      [5, 9, 20, 22, 31, 35, 46].includes(cell) ? 1 : 0,
    );
    expect(
      failuresOf({ ...monday, regions: beyond.regions, solution }),
    ).toEqual(["beyond-ladder"]);
  });

  it("rejects a puzzle harder than its weekday allows", () => {
    expect(failuresOf({ ...tuesday, weekday: 1 })).toEqual(["too-hard"]);
    expect(failuresOf({ ...sunday, weekday: 5 })).toEqual(["too-hard"]);
  });

  it("rejects a puzzle easier than its weekday asks", () => {
    expect(failuresOf({ ...friday, weekday: 7 })).toEqual(["too-easy"]);
  });

  it("rejects advanced steps that do not match the recomputed grade", () => {
    expect(failuresOf({ ...monday, advancedSteps: 1 })).toEqual([
      "steps-mismatch",
    ]);
  });
});
