import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { deriveClues } from "../../src/nonogram/clues";

function bitmap(rows: readonly string[]): boolean[][] {
  return rows.map((row) => [...row].map((ch) => ch === "#"));
}

describe("deriveClues", () => {
  it("run-length encodes rows top→bottom and columns left→right", () => {
    const clues = deriveClues(
      bitmap([
        "#.#..", //
        "#####",
        ".###.",
        ".....",
        "#...#",
      ]),
    );
    expect(clues.size).toBe(5);
    expect(clues.rows).toEqual([[1, 1], [5], [3], [], [1, 1]]);
    expect(clues.cols).toEqual([[2, 1], [2], [3], [2], [1, 1]]);
  });

  it("encodes an all-empty line as [] and an all-full line as [size]", () => {
    const clues = deriveClues(
      bitmap([
        "...", //
        "###",
        "...",
      ]),
    );
    expect(clues.rows).toEqual([[], [3], []]);
    expect(clues.cols).toEqual([[1], [1], [1]]);
  });

  it("preserves per-line filled counts and grid dimensions (property)", () => {
    const squareBitmap = fc.integer({ min: 1, max: 10 }).chain((n) =>
      fc.array(fc.array(fc.boolean(), { minLength: n, maxLength: n }), {
        minLength: n,
        maxLength: n,
      }),
    );
    fc.assert(
      fc.property(squareBitmap, (grid) => {
        const n = grid.length;
        const clues = deriveClues(grid);
        expect(clues.size).toBe(n);
        expect(clues.rows).toHaveLength(n);
        expect(clues.cols).toHaveLength(n);
        const sum = (runs: ReadonlyArray<number>): number =>
          runs.reduce((total, run) => total + run, 0);
        for (let r = 0; r < n; r += 1) {
          const filled = (grid[r] ?? []).filter(Boolean).length;
          expect(sum(clues.rows[r] ?? [-1])).toBe(filled);
          for (const run of clues.rows[r] ?? []) {
            expect(run).toBeGreaterThan(0);
          }
        }
        for (let c = 0; c < n; c += 1) {
          const filled = grid.filter((row) => row[c] === true).length;
          expect(sum(clues.cols[c] ?? [-1])).toBe(filled);
        }
      }),
    );
  });
});
