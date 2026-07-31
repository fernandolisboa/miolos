import { describe, expect, it } from "vitest";

import { deriveClues } from "../../src/nonogram/clues";
import { solveLine, solveNonogram } from "../../src/nonogram/solve";
import type { CellState } from "../../src/nonogram/types";

function bitmap(rows: readonly string[]): boolean[][] {
  return rows.map((row) => [...row].map((ch) => ch === "#"));
}

function gridToStrings(
  grid: ReadonlyArray<ReadonlyArray<CellState>>,
): string[] {
  return grid.map((row) =>
    row
      .map((cell) => (cell === "filled" ? "#" : cell === "empty" ? "." : "?"))
      .join(""),
  );
}

const unknowns = (n: number): CellState[] =>
  new Array<CellState>(n).fill("unknown");

describe("solveLine", () => {
  it("forces the overlap of clue [8] on a 10-line (cells 2–7)", () => {
    const result = solveLine(unknowns(10), [8]);
    expect(result.contradiction).toBe(false);
    expect(result.states).toEqual([
      "unknown",
      "unknown",
      "filled",
      "filled",
      "filled",
      "filled",
      "filled",
      "filled",
      "unknown",
      "unknown",
    ]);
  });

  it("completes a line from partial knowledge", () => {
    // Clue [3] on a 5-line with the middle cell known filled and cell 0
    // known empty: run must sit within 1..4 and cover cell 2.
    const states: CellState[] = [
      "empty",
      "unknown",
      "filled",
      "unknown",
      "unknown",
    ];
    const result = solveLine(states, [3]);
    expect(result.contradiction).toBe(false);
    // Placements: 1-3 or 2-4; cells 2 and 3 are in both.
    expect(result.states[2]).toBe("filled");
    expect(result.states[3]).toBe("filled");
    expect(result.states[0]).toBe("empty");
  });

  it("forces an all-empty line for clue []", () => {
    const result = solveLine(unknowns(4), []);
    expect(result.contradiction).toBe(false);
    expect(result.states).toEqual(["empty", "empty", "empty", "empty"]);
  });

  it("reports contradiction when the runs cannot fit", () => {
    expect(solveLine(unknowns(5), [3, 3]).contradiction).toBe(true);
    expect(
      solveLine(["filled", "empty", "empty", "empty", "empty"], [2])
        .contradiction,
    ).toBe(true);
  });
});

describe("solveNonogram", () => {
  it("solves a known 5×5 picture to its exact grid", () => {
    const picture = [
      ".#.#.", //
      "#####",
      "#####",
      ".###.",
      "..#..",
    ];
    const result = solveNonogram(deriveClues(bitmap(picture)));
    expect(result.status).toBe("solved");
    expect(gridToStrings(result.grid)).toEqual(picture);
    expect(result.passes).toBeGreaterThan(0);
    expect(result.firstPassFill).toBeGreaterThan(0);
    expect(result.firstPassFill).toBeLessThanOrEqual(1);
  });

  it("solves the all-empty and all-full grids", () => {
    const empty = solveNonogram({
      size: 3,
      rows: [[], [], []],
      cols: [[], [], []],
    });
    expect(empty.status).toBe("solved");
    expect(gridToStrings(empty.grid)).toEqual(["...", "...", "..."]);

    const full = solveNonogram({
      size: 3,
      rows: [[3], [3], [3]],
      cols: [[3], [3], [3]],
    });
    expect(full.status).toBe("solved");
    expect(gridToStrings(full.grid)).toEqual(["###", "###", "###"]);
  });

  it("detects contradictory clues (full rows against a [1] column)", () => {
    const result = solveNonogram({
      size: 5,
      rows: [[5], [5], [5], [5], [5]],
      cols: [[1], [1], [1], [1], [1]],
    });
    expect(result.status).toBe("contradiction");
  });

  it("refuses to guess the ambiguous 2×2 checkerboard (stuck, never solved)", () => {
    const result = solveNonogram({
      size: 2,
      rows: [[1], [1]],
      cols: [[1], [1]],
    });
    expect(result.status).toBe("stuck");
    for (const row of result.grid) {
      for (const cell of row) {
        expect(cell).toBe("unknown");
      }
    }
  });
});
