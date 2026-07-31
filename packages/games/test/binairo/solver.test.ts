import { describe, expect, it } from "vitest";

import {
  countBinairoSolutions,
  findBinairoViolations,
  gradeBinairo,
  isValidBinairoSolution,
  solveBinairo,
} from "../../src/binairo/index";
import type { BinairoGrid, BinairoSolvedGrid } from "../../src/binairo/index";

// Every fixture in this file is hand-verified in the comments beside it.
// The solver is the independent instrument the generator properties lean
// on ("proved, not sampled"), so the instrument itself is validated here
// against grids whose solution sets are enumerated by hand.

/** Parse "0011 1100 0.1. 1.0." into a row-major grid; "." = empty. */
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

/** Parse a complete grid (no "."). */
function solved(spec: string): BinairoSolvedGrid {
  return grid(spec).map((cell) => {
    if (cell === null) throw new Error("fixture grid is incomplete");
    return cell;
  });
}

// A hand-verified valid 4×4 complete grid:
//   rows 0101 1010 0110 1001 — each balanced (two 0s, two 1s), no run of 3
//   cols 0101 1010 0110 1001 — same
//   all four rows distinct, all four columns distinct (rule 4)
const VALID_4X4 = "0101 1010 0110 1001";

describe("countBinairoSolutions / solveBinairo (4×4 fixtures)", () => {
  it("(a) counts exactly 1 for a puzzle whose empties are all forced", () => {
    // VALID_4X4 with the last column cleared. Each row keeps three cells:
    //   row0 010. — two 0s placed, balance (rule 3) forces the empty to 1
    //   row1 101. — two 1s placed, forces 0
    //   row2 011. — two 1s placed, forces 0
    //   row3 100. — two 0s placed, forces 1
    // Every empty is independently forced, so the solution is unique.
    const givens = grid("010. 101. 011. 100.");
    expect(countBinairoSolutions(givens)).toBe(1);
    expect(countBinairoSolutions(givens, 3)).toBe(1);
    expect(solveBinairo(givens)).toEqual(solved(VALID_4X4));
  });

  it("(b) counts exactly 2 for a hand-enumerated two-solution puzzle", () => {
    // Rows 0 and 1 complete (0011, 1100 — complements), row 2 starts with 0.
    // Balanced 4-bit rows without a run of 3: {0011, 0101, 0110, 1001, 1010, 1100}.
    // Rule 4 bars row2 ∈ {0011, 1100}; the leading 0 leaves {0101, 0110}.
    // Column balance (rows 0/1 are complements) forces row3 = complement(row2).
    // Both completions are valid (checked by hand: columns balanced, no runs,
    // all rows and columns distinct):
    //   rows 0011 1100 0101 1010 → cols 0101 0110 1001 1010
    //   rows 0011 1100 0110 1001 → cols 0101 0110 1010 1001
    const givens = grid("0011 1100 0... ....");
    expect(countBinairoSolutions(givens)).toBe(2);
    // limit 3 still finds exactly 2 — proves counting, not just a boolean.
    expect(countBinairoSolutions(givens, 3)).toBe(2);
  });

  it("(c) counts 0 for contradictory givens (three 1s in a row)", () => {
    const givens = grid("111. .... .... ....");
    expect(countBinairoSolutions(givens)).toBe(0);
    expect(solveBinairo(givens)).toBeNull();
  });

  it("(d) enforces rule 4: a puzzle unique only because of unique lines", () => {
    // Hand-verified rule-4 witness (from the reviewed plan):
    //   0 0 1 1
    //   1 1 0 0
    //   0 . 1 .
    //   1 . 0 .
    // Under rules 1–3 exactly two completions exist:
    //   rows 2–3 = 0011 / 1100 (rows 0/2 and 1/3 identical, cols 0/1 and 2/3
    //   identical) or rows 2–3 = 0110 / 1001 (all lines distinct).
    // Rule 4 eliminates the first, so the count must be exactly 1.
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
    // VALID_4X4 with (0,1) flipped 1→0: row0 = 0001 has the run 0,0,0 at
    // cells 0..2 (also unbalances row0 and col1 — at 4×4 a run of three
    // always breaks the count too; the run must still be reported).
    const mutant = solved("0001 1010 0110 1001");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    expect(
      violations.some((v) => v.rule === "run" && v.cells.length === 3),
    ).toBe(true);
    expect(violations.find((v) => v.rule === "run")?.cells).toEqual([0, 1, 2]);
  });

  it("rejects a 3–1 count line and names the cells", () => {
    // VALID_4X4 with (2,2) flipped 1→0: row2 = 0100 and col2 = 0100 each
    // hold three 0s and one 1 — balance violations with no run of three
    // anywhere and all lines still distinct (violates exactly rule 3).
    const mutant = solved("0101 1010 0100 1001");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    const balance = violations.filter((v) => v.rule === "balance");
    expect(balance.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "run")).toBe(false);
    expect(violations.some((v) => v.rule === "duplicate-line")).toBe(false);
    // Row 2 over-represents 0 at cells 8, 10, 11.
    expect(
      balance.some(
        (v) =>
          v.cells.includes(8) && v.cells.includes(10) && v.cells.includes(11),
      ),
    ).toBe(true);
  });

  it("rejects identical lines and names the cells", () => {
    // Rows 0101 1010 0101 1010: every row balanced, no runs (rows and the
    // alternating columns), but rows 0/2 and 1/3 are identical, as are the
    // duplicated columns — violates exactly rule 4.
    const mutant = solved("0101 1010 0101 1010");
    expect(isValidBinairoSolution(mutant)).toBe(false);
    const violations = findBinairoViolations(mutant);
    const duplicates = violations.filter((v) => v.rule === "duplicate-line");
    expect(duplicates.length).toBeGreaterThan(0);
    expect(violations.some((v) => v.rule === "run")).toBe(false);
    expect(violations.some((v) => v.rule === "balance")).toBe(false);
    // Rows 0 and 2 duplicated: cells 0..3 and 8..11.
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
    // No line over-represents a value yet beyond the run's own row.
    expect(findBinairoViolations(grid("01.. 10.. .... ...."))).toEqual([]);
  });
});

describe("gradeBinairo technique tiers (4×4 fixtures)", () => {
  it("grades a count-saturation-only puzzle as tier 1", () => {
    // Fixture (a): every empty forced by T1c count saturation alone.
    const result = gradeBinairo(grid("010. 101. 011. 100."));
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 1 });
  });

  it("grades the rule-4 fixture as tier 2 (T2b duplicate-line avoidance)", () => {
    // Fixture (d). Tier-1 stall, verified by hand: rows 2–3 and cols 1/3
    // each hold at most one 0 and one 1 (no saturation) and no window of
    // three cells holds a same-value pair (no surround/split pair).
    // T2b unblocks: row0 = 0011 is complete; row2 = 0.1. has exactly two
    // empties (positions 1, 3) and agrees with row0 on positions 0 and 2;
    // row0's values at positions 1 and 3 are 0 and 1 (differ), so rule 4
    // forces the swapped arrangement: row2 = 0110. Count saturation then
    // finishes rows 2–3.
    const result = gradeBinairo(grid("0011 1100 0.1. 1.0."));
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 2 });
  });

  it("grades a T2a-unblocked puzzle as tier 2 (line lookahead)", () => {
    // 6×6 fixture (internals are size-parameterized as a test affordance;
    // tier-1 stall states at 4×4 are too sparse for T2a to ever be the
    // discriminating technique — verified by exhaustive-style search).
    //
    // Givens (hand-checked tier-1 stall: every line holds at most two 0s
    // and two 1s — no T1c — and no line has a window [v,v,.], [.,v,v] or
    // [v,.,v] — no T1a/T1b):
    //   0 . . 1 . 0
    //   . 0 . . 0 1
    //   . 1 . 0 . 1
    //   1 . . 1 . 0
    //   . . 1 0 1 0
    //   . 1 . . 0 1
    // T2b cannot act at the stall: the only complete line is column 5
    // (0,1,1,0,0,1) and the only parallel line with exactly two empties,
    // column 3 (1,.,0,1,0,.), already disagrees with it at row 0.
    // T2a unblocks, hand-traced entirely inside row 0 (0,.,.,1,.,0):
    // placing 0 at (0,1) makes three 0s; the surround pair 0,0 forces
    // (0,2) = 1, then the pair 1,1 at (0,2)–(0,3) forces (0,4) = 0 — a
    // fourth 0 in row 0, contradiction. So (0,1) = 1, and the tiered
    // fixpoint finishes from there.
    // The inline solution is a solution by construction (the givens are a
    // subset of it and it satisfies rules 1–4, checked by hand: all rows
    // and columns 3+3 balanced, no runs of three, all lines distinct);
    // the counting solver — validated by fixtures (a)–(d) above — proves
    // it is the only one.
    const givens = grid("0..1.0 .0..01 .1.0.1 1..1.0 ..1010 .1..01");
    expect(countBinairoSolutions(givens, 3)).toBe(1);
    expect(solveBinairo(givens)).toEqual(
      solved("010110 101001 011001 100110 101010 010101"),
    );
    const result = gradeBinairo(givens);
    expect(result).toEqual({ solvable: true, unique: true, requiredTier: 2 });
  });

  it("grades a branching-only grid as tier 3", () => {
    // The empty grid: solvable (many solutions), but no technique of any
    // tier can force a single cell — only branching completes it.
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
