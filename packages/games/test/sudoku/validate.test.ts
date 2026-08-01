import { describe, expect, it } from "vitest";

import { getSudokuConflicts, isSudokuSolved } from "../../src/sudoku/index";
import { EMPTY_GRID, FULL_GRID } from "./fixtures";

describe("getSudokuConflicts", () => {
  it("returns [] for the empty grid and a solved grid", () => {
    expect(getSudokuConflicts(EMPTY_GRID)).toEqual([]);
    expect(getSudokuConflicts(FULL_GRID)).toEqual([]);
  });

  it("flags a row duplicate with the exact index set", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 3 ? 5 : v));
    expect(getSudokuConflicts(grid)).toEqual([0, 3]);
  });

  it("flags a column duplicate with the exact index set", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 27 ? 5 : v));
    expect(getSudokuConflicts(grid)).toEqual([0, 27]);
  });

  it("flags a box duplicate with the exact index set", () => {
    const grid = EMPTY_GRID.map((v, i) => (i === 0 || i === 10 ? 5 : v));
    expect(getSudokuConflicts(grid)).toEqual([0, 10]);
  });

  it("only flags cells participating in a duplicate", () => {
    // Row duplicate 5@{0,3} plus an innocent 7 in the same row.
    const grid = EMPTY_GRID.map((v, i) =>
      i === 0 || i === 3 ? 5 : i === 5 ? 7 : v,
    );
    expect(getSudokuConflicts(grid)).toEqual([0, 3]);
  });

  it("rejects malformed grids", () => {
    expect(() => getSudokuConflicts(new Array<number>(80).fill(0))).toThrow(
      TypeError,
    );
    expect(() =>
      getSudokuConflicts(EMPTY_GRID.map((v, i) => (i === 7 ? -1 : v))),
    ).toThrow(TypeError);
  });
});

describe("isSudokuSolved", () => {
  it("is true only for a complete and legal grid", () => {
    expect(isSudokuSolved(FULL_GRID)).toBe(true);
    // Incomplete (one blank) fails.
    expect(isSudokuSolved(FULL_GRID.map((v, i) => (i === 40 ? 0 : v)))).toBe(
      false,
    );
    // Complete but illegal (duplicate) fails.
    expect(
      isSudokuSolved(FULL_GRID.map((v, i) => (i === 1 ? FULL_GRID[0]! : v))),
    ).toBe(false);
    // Empty fails.
    expect(isSudokuSolved(EMPTY_GRID)).toBe(false);
  });
});
