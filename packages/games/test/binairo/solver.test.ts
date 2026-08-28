import { describe, expect, it } from "vitest";

import {
  countBinairoSolutions,
  findBinairoViolations,
  gradeBinairo,
  isValidBinairoSolution,
  solveBinairo,
} from "../../src/binairo/index";
import type { BinairoGrid, BinairoSolvedGrid } from "../../src/binairo/index";

function grid(spec: string): BinairoGrid {
  return spec
    .split(/\s+/)
    .filter((row) => row.length > 0)
    .flatMap((row) =>
      [...row].map((ch) => {
        if (ch === "0") return 0;
        if (ch === "1") return 1;
        if (ch === ".") return null;
        throw new Error(`bad cell char: ${ch}`);
      }),
    );
}

function solved(spec: string): BinairoSolvedGrid {
  return grid(spec).map((cell) => {
    if (cell === null) throw new Error("fixture grid is incomplete");
    return cell;
  });
}

const VALID_4X4 = "0101 1010 0110 1001";

describe("countBinairoSolutions / solveBinairo (4×4 fixtures)", () => {
  it("(a) counts exactly 1 for a puzzle whose empties are all forced", () => {
    const givens = grid("010. 101. 011. 100.");
    expect(countBinairoSolutions(givens)).toBe(1);
    expect(countBinairoSolutions(givens, 3)).toBe(1);
    expect(solveBinairo(givens)).toEqual(solved(VALID_4X4));
  });

  it("(b) counts exactly 2 for a hand-enumerated two-solution puzzle", () => {
    const givens = grid("0011 1100 0... ....");
    expect(countBinairoSolutions(givens)).toBe(2);

    expect(countBinairoSolutions(givens, 3)).toBe(2);
  });

  it("(c) counts 0 for contradictory givens (three 1s in a row)", () => {
    const givens = grid("111. .... .... ....");
    expect(countBinairoSolutions(givens)).toBe(0);
    expect(solveBinairo(givens)).toBeNull();
  });

  it("(d) enforces rule 4: a puzzle unique only because of unique lines", () => {
    const givens = grid("0011 1100 0.1. 1.0.");
    expect(countBinairoSolutions(givens, 3)).toBe(1);
    expect(solveBinairo(givens)).toEqual(solved("0011 1100 0110 1001"));
  });

  it("rejects non-square and odd-sided grids", () => {
    expect(() => countBinairoSolutions(grid("01 10 01"))).toThrow(RangeError);
    expect(() =>
      countBinairoSolutions([0, 1, null, 0, 1, null, 0, 1, null]),
    ).toThrow(RangeError);
  });
});

describe("isValidBinairoSolution / findBinairoViolations (4×4 fixtures)", () => {
  it("accepts a hand-verified valid complete grid", () => {
    expect(isValidBinairoSolution(solved(VALID_4X4))).toBe(true);
    expect(findBinairoViolations(solved(VALID_4X4))).toEqual([]);
  });

  it("rejects a run of three and names the cells", () => {
    const mutant = solved("0001 1010 0110 1001");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    expect(
      violations.some((v) => v.rule === "run" && v.cells.length === 3),
    ).toBe(true);
    expect(violations.find((v) => v.rule === "run")?.cells).toEqual([0, 1, 2]);
  });

  it("rejects a 3–1 count line and names the cells", () => {
    const mutant = solved("0101 1010 0100 1001");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    const balance = violations.filter((v) => v.rule === "balance");
    expect(balance.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "run")).toBe(false);
    expect(violations.some((v) => v.rule === "duplicate-line")).toBe(false);

    expect(
      balance.some(
        (v) =>
          v.cells.includes(8) && v.cells.includes(10) && v.cells.includes(11),
      ),
    ).toBe(true);
  });

  it("rejects identical lines and names the cells", () => {
    const mutant = solved("0101 1010 0101 1010");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    const duplicates = violations.filter((v) => v.rule === "duplicate-line");
    expect(duplicates.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "run")).toBe(false);
    expect(violations.some((v) => v.rule === "balance")).toBe(false);

    expect(
      duplicates.some((v) =>
        [0, 1, 2, 3, 8, 9, 10, 11].every((c) => v.cells.includes(c)),
      ),
    ).toBe(true);
  });

  it("reports run and balance violations on partial grids too", () => {
    const partial = grid("111. .... .0.. .0..");
    const violations = findBinairoViolations(partial);
    expect(violations.some((v) => v.rule === "run")).toBe(true);

    expect(findBinairoViolations(grid("01.. 10.. .... ...."))).toEqual([]);
  });
});

describe("gradeBinairo technique tiers (4×4 fixtures)", () => {
  it("grades a count-saturation-only puzzle as tier 1", () => {
    const result = gradeBinairo(grid("010. 101. 011. 100."));
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 1 });
  });

  it("grades the rule-4 fixture as tier 2 (T2b duplicate-line avoidance)", () => {
    const result = gradeBinairo(grid("0011 1100 0.1. 1.0."));
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 2 });
  });

  it("grades a T2a-unblocked puzzle as tier 2 (line lookahead)", () => {
    const givens = grid("0..1.0 .0..01 .1.0.1 1..1.0 ..1010 .1..01");
    expect(countBinairoSolutions(givens, 3)).toBe(1);
    expect(solveBinairo(givens)).toEqual(
      solved("010110 101001 011001 100110 101010 010101"),
    );
    const result = gradeBinairo(givens);
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 2 });
  });

  it("grades a branching-only grid as tier 3", () => {
    const result = gradeBinairo(grid(".... .... .... ...."));
    expect(result.solvable).toBe(true);
    expect(result.unique).toBe(false);
    expect(result.requiredTier).toBe(3);
  });

  it("grades contradictory givens as unsolvable", () => {
    const result = gradeBinairo(grid("111. .... .... ...."));
    expect(result).toEqual({
      solvable: false,
      unique: false,
      requiredTier: null,
    });
  });
});
