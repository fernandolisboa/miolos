// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
import type { SudokuGrid } from "./types";

/** Row (0–8) of flat index i. */
export function rowOf(i: number): number {
  return (i / 9) | 0;
}

/** Column (0–8) of flat index i. */
export function colOf(i: number): number {
  return i % 9;
}

/** Box (0–8, row-major bands) of flat index i. */
export function boxOf(i: number): number {
  return ((rowOf(i) / 3) | 0) * 3 + ((colOf(i) / 3) | 0);
}

function buildPopcount(): readonly number[] {
  const table = new Array<number>(512).fill(0);
  for (let i = 1; i < 512; i += 1) {
    table[i] = table[i >> 1]! + (i & 1);
  }
  return table;
}

/** Popcount lookup for 9-bit candidate masks (bit d-1 = digit d present). */
export const POPCOUNT: readonly number[] = buildPopcount();

function buildUnits(): readonly (readonly number[])[] {
  const units: number[][] = [];
  for (let r = 0; r < 9; r += 1) {
    units.push(Array.from({ length: 9 }, (_, c) => r * 9 + c));
  }
  for (let c = 0; c < 9; c += 1) {
    units.push(Array.from({ length: 9 }, (_, r) => r * 9 + c));
  }
  for (let b = 0; b < 9; b += 1) {
    const baseRow = ((b / 3) | 0) * 3;
    const baseCol = (b % 3) * 3;
    const unit: number[] = [];
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        unit.push((baseRow + r) * 9 + baseCol + c);
      }
    }
    units.push(unit);
  }
  return units;
}

/** The 27 units in fixed scan order: rows 0–8, columns 0–8, boxes 0–8. */
export const UNITS: readonly (readonly number[])[] = buildUnits();

function buildPeers(): readonly (readonly number[])[] {
  return Array.from({ length: 81 }, (_, i) => {
    const peers = new Set<number>();
    for (const unit of UNITS) {
      if (unit.includes(i)) {
        for (const j of unit) {
          if (j !== i) {
            peers.add(j);
          }
        }
      }
    }
    return [...peers];
  });
}

/** For each cell, the 20 cells sharing a row, column, or box with it. */
export const PEERS: readonly (readonly number[])[] = buildPeers();

/**
 * Runtime shape validation for every public entry point: array, length 81,
 * every cell an integer 0–9. Throws TypeError with the offending index.
 */
export function assertSudokuGrid(grid: SudokuGrid): void {
  // Guard via an `unknown` alias: Array.isArray would otherwise narrow the
  // readonly parameter to any[], defeating type-safety below.
  const shape: unknown = grid;
  if (!Array.isArray(shape)) {
    throw new TypeError("Sudoku grid must be an array");
  }
  if (grid.length !== 81) {
    throw new TypeError(
      `Sudoku grid must have length 81, got ${String(grid.length)}`,
    );
  }
  for (let i = 0; i < 81; i += 1) {
    const value = grid[i]!;
    if (!Number.isInteger(value) || value < 0 || value > 9) {
      throw new TypeError(
        `Sudoku grid cell must be an integer 0-9, got ${String(value)} at index ${String(i)}`,
      );
    }
  }
}

/**
 * Indices (0–80) of every cell participating in a duplicate digit within
 * its row, column, or box, in ascending order. Empty array = grid is legal
 * so far. A responsiveness affordance for the client, never a source of
 * truth (ADR-0004).
 */
export function getSudokuConflicts(grid: SudokuGrid): readonly number[] {
  assertSudokuGrid(grid);
  const flagged = new Array<boolean>(81).fill(false);
  for (const unit of UNITS) {
    for (let d = 1; d <= 9; d += 1) {
      let count = 0;
      for (const i of unit) {
        if (grid[i]! === d) {
          count += 1;
        }
      }
      if (count >= 2) {
        for (const i of unit) {
          if (grid[i]! === d) {
            flagged[i] = true;
          }
        }
      }
    }
  }
  const conflicts: number[] = [];
  for (let i = 0; i < 81; i += 1) {
    if (flagged[i]!) {
      conflicts.push(i);
    }
  }
  return Object.freeze(conflicts);
}

/** True iff the grid is complete (no zeros) and conflict-free. */
export function isSudokuSolved(grid: SudokuGrid): boolean {
  assertSudokuGrid(grid);
  for (let i = 0; i < 81; i += 1) {
    if (grid[i]! === 0) {
      return false;
    }
  }
  return getSudokuConflicts(grid).length === 0;
}
