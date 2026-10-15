import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { createSeededRandom } from "../../src/random";
import {
  CLASSIC_GEOMETRY,
  CLASSIC_LAYOUT,
  assertSudokuLayout,
  geometryFor,
  geometryOf,
} from "../../src/sudoku/board";
import { DIAGONAL_LAYOUT } from "../../src/sudoku/generate";
import { drawIrregularLayout } from "../../src/sudoku/irregular";
import type { SudokuLayout } from "../../src/sudoku/index";
import { FC_SEED, seedArb } from "../daily-arbitraries";

const ROW_ZERO = [0, 1, 2, 3, 4, 5, 6, 7, 8];

const unitsHolding = (layout: SudokuLayout, cell: number): number =>
  geometryOf(layout).units.filter((unit) => unit.includes(cell)).length;

function connected(regions: readonly number[], id: number): boolean {
  const cells = regions.flatMap((r, i) => (r === id ? [i] : []));
  const seen = new Set([cells[0]!]);
  const queue = [cells[0]!];
  while (queue.length > 0) {
    const cell = queue.shift()!;
    const row = Math.floor(cell / 9);
    const col = cell % 9;
    for (const [r, c] of [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ] as const) {
      const next = r * 9 + c;
      if (r >= 0 && r < 9 && c >= 0 && c < 9 && regions[next] === id) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
  }
  return seen.size === cells.length;
}

function offBox(regions: readonly number[]): number {
  let kept = 0;
  for (let id = 0; id < 9; id += 1) {
    const overlap = new Array<number>(9).fill(0);
    regions.forEach((r, i) => {
      if (r === id) {
        const box = CLASSIC_LAYOUT.regions[i]!;
        overlap[box] = overlap[box]! + 1;
      }
    });
    kept += Math.max(...overlap);
  }
  return 81 - kept;
}

describe("Sudoku layouts", () => {
  it("gives the classic board rows, columns and 3×3 boxes only", () => {
    expect(geometryOf(CLASSIC_LAYOUT).units).toHaveLength(27);
    expect(unitsHolding(CLASSIC_LAYOUT, 40)).toBe(3);
    expect(CLASSIC_LAYOUT.regions.slice(0, 9)).toEqual([
      0, 0, 0, 1, 1, 1, 2, 2, 2,
    ]);
  });

  it("adds both main diagonals in the Diagonal layout", () => {
    expect(DIAGONAL_LAYOUT.extraUnits).toEqual([
      [0, 10, 20, 30, 40, 50, 60, 70, 80],
      [8, 16, 24, 32, 40, 48, 56, 64, 72],
    ]);
    expect(unitsHolding(DIAGONAL_LAYOUT, 40)).toBe(5);
    expect(unitsHolding(DIAGONAL_LAYOUT, 0)).toBe(4);
    expect(unitsHolding(DIAGONAL_LAYOUT, 1)).toBe(3);
    expect(geometryOf(DIAGONAL_LAYOUT).peers[40]).toHaveLength(32);
  });

  it("rejects a layout that cannot be a Sudoku", () => {
    const regions = [...CLASSIC_LAYOUT.regions];
    const bad: SudokuLayout[] = [
      { regions: regions.slice(1), extraUnits: [] },
      { regions: regions.map((r, i) => (i === 0 ? 9 : r)), extraUnits: [] },
      { regions: regions.map((r, i) => (i === 3 ? 0 : r)), extraUnits: [] },
      { regions, extraUnits: [[0, 1, 2, 3, 4, 5, 6, 7]] },
      { regions, extraUnits: [[0, 1, 2, 3, 4, 5, 6, 7, 7]] },
      { regions, extraUnits: [[0, 1, 2, 3, 4, 5, 6, 7, 81]] },
      { regions, extraUnits: Array.from({ length: 32 }, () => ROW_ZERO) },
    ];
    for (const layout of bad) {
      expect(() => assertSudokuLayout(layout)).toThrow(RangeError);
    }
    expect(() => assertSudokuLayout(DIAGONAL_LAYOUT)).not.toThrow();
    expect(() =>
      assertSudokuLayout({
        regions,
        extraUnits: Array.from({ length: 31 }, () => ROW_ZERO),
      }),
    ).not.toThrow();
  });

  it("builds a layout's geometry once", () => {
    expect(geometryFor(CLASSIC_LAYOUT)).toBe(CLASSIC_GEOMETRY);
    expect(geometryFor(DIAGONAL_LAYOUT)).toBe(geometryFor(DIAGONAL_LAYOUT));
    const open = { ...DIAGONAL_LAYOUT };
    expect(geometryFor(open)).not.toBe(geometryFor(open));
  });

  it("draws irregular maps of nine connected nine-cell regions, by seed", () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const layout = drawIrregularLayout(createSeededRandom(seed));
        expect(drawIrregularLayout(createSeededRandom(seed))).toEqual(layout);
        expect(layout.extraUnits).toEqual([]);
        expect(() => assertSudokuLayout(layout)).not.toThrow();
        const firstSeen = [...new Set(layout.regions)];
        expect(firstSeen).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
        for (let id = 0; id < 9; id += 1) {
          expect(connected(layout.regions, id)).toBe(true);
        }
        expect(offBox(layout.regions)).toBeGreaterThanOrEqual(12);
      }),
      { seed: FC_SEED, numRuns: 500 },
    );
  }, 40_000);
});
