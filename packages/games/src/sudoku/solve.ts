import { shuffleInPlace } from "../random";
import type { SeededRandom } from "../random";
import {
  CLASSIC_GEOMETRY,
  EXTRA_UNITS,
  POPCOUNT,
  assertSudokuGrid,
  colOf,
  rowOf,
} from "./board";
import type { SudokuGeometry } from "./board";
import type { SudokuGrid } from "./types";

interface Shuffle {
  readonly rng: SeededRandom;
  budget: number;
}

function search(
  grid: number[],
  limit: number,
  record: number[] | null,
  geometry: SudokuGeometry,
  shuffle: Shuffle | null,
): number {
  const { units, regionOf, extraBits } = geometry;
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const regions = new Array<number>(9).fill(0);
  const extras = new Array<number>(geometry.units.length - EXTRA_UNITS).fill(0);
  const hasExtras = extras.length > 0;

  const takenAt = (i: number): number => {
    let taken = rows[rowOf(i)]! | cols[colOf(i)]! | regions[regionOf[i]!]!;
    for (let m = hasExtras ? extraBits[i]! : 0; m !== 0; m &= m - 1) {
      taken |= extras[31 - Math.clz32(m & -m)]!;
    }
    return taken;
  };

  const toggle = (i: number, bit: number): void => {
    rows[rowOf(i)] = rows[rowOf(i)]! ^ bit;
    cols[colOf(i)] = cols[colOf(i)]! ^ bit;
    regions[regionOf[i]!] = regions[regionOf[i]!]! ^ bit;
    for (let m = hasExtras ? extraBits[i]! : 0; m !== 0; m &= m - 1) {
      const e = 31 - Math.clz32(m & -m);
      extras[e] = extras[e]! ^ bit;
    }
  };

  for (let i = 0; i < 81; i += 1) {
    const value = grid[i]!;
    if (value === 0) {
      continue;
    }
    const bit = 1 << (value - 1);
    if ((takenAt(i) & bit) !== 0) {
      return 0;
    }
    toggle(i, bit);
  }
  let count = 0;

  const recurse = (): void => {
    if (count >= limit) {
      return;
    }
    if (shuffle !== null && (shuffle.budget -= 1) < 0) {
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (grid[i]! !== 0) {
        continue;
      }
      const mask = ~takenAt(i) & 0x1ff;
      const candidates = POPCOUNT[mask]!;
      if (candidates === 0) {
        return;
      }
      if (candidates < bestCount) {
        bestCount = candidates;
        best = i;
        bestMask = mask;
        if (candidates === 1) {
          break;
        }
      }
    }
    if (best === -1) {
      count += 1;
      if (count === 1 && record !== null) {
        for (let i = 0; i < 81; i += 1) {
          record[i] = grid[i]!;
        }
      }
      return;
    }
    if (shuffle !== null) {
      branchShuffled(best, bestMask, shuffle);
      return;
    }
    for (let left = bestMask; left !== 0; left &= left - 1) {
      const bit = left & -left;
      grid[best] = 32 - Math.clz32(bit);
      toggle(best, bit);
      recurse();
      grid[best] = 0;
      toggle(best, bit);
      if (count >= limit) {
        return;
      }
    }
  };

  // A fill also branches on the digit with the fewest places left in a unit
  // when that beats the tightest cell: plain cell MRV stalls on irregular maps.
  const free = new Array<number>(81).fill(0);
  const places = new Array<number>(9).fill(0);

  const branchShuffled = (
    best: number,
    bestMask: number,
    fill: Shuffle,
  ): void => {
    for (let i = 0; i < 81; i += 1) {
      free[i] = grid[i]! === 0 ? ~takenAt(i) & 0x1ff : 0;
    }
    let fewest = POPCOUNT[bestMask]!;
    let scarceUnit = -1;
    let scarceBit = 0;
    for (let u = 0; u < units.length && fewest > 1; u += 1) {
      places.fill(0);
      let placed = 0;
      for (const i of units[u]!) {
        placed |= grid[i]! === 0 ? 0 : 1 << (grid[i]! - 1);
        for (let m = free[i]!; m !== 0; m &= m - 1) {
          const d = 31 - Math.clz32(m & -m);
          places[d] = places[d]! + 1;
        }
      }
      for (let m = ~placed & 0x1ff; m !== 0; m &= m - 1) {
        const d = 31 - Math.clz32(m & -m);
        if (places[d]! === 0) {
          return;
        }
        if (places[d]! < fewest) {
          fewest = places[d]!;
          scarceUnit = u;
          scarceBit = 1 << d;
        }
      }
    }
    const moves: (readonly [number, number])[] = [];
    if (scarceUnit === -1) {
      for (let m = bestMask; m !== 0; m &= m - 1) {
        moves.push([best, m & -m]);
      }
    } else {
      for (const i of units[scarceUnit]!) {
        if ((free[i]! & scarceBit) !== 0) {
          moves.push([i, scarceBit]);
        }
      }
    }
    shuffleInPlace(moves, fill.rng);
    for (const [cell, bit] of moves) {
      grid[cell] = 32 - Math.clz32(bit);
      toggle(cell, bit);
      recurse();
      grid[cell] = 0;
      toggle(cell, bit);
      if (count >= limit || fill.budget < 0) {
        return;
      }
    }
  };

  recurse();
  return count;
}

export function countSolutionsInternal(
  grid: readonly number[],
  limit: number,
  geometry: SudokuGeometry = CLASSIC_GEOMETRY,
): number {
  return search([...grid], limit, null, geometry, null);
}

export function countSudokuSolutions(givens: SudokuGrid, limit = 2): number {
  assertSudokuGrid(givens);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      `limit must be a positive integer, got ${String(limit)}`,
    );
  }
  return countSolutionsInternal(givens, limit);
}

export function solveSudoku(givens: SudokuGrid): SudokuGrid | null {
  assertSudokuGrid(givens);
  const record = new Array<number>(81).fill(0);
  const found = search([...givens], 1, record, CLASSIC_GEOMETRY, null);
  return found === 0 ? null : Object.freeze(record);
}

export function fillVariant(
  geometry: SudokuGeometry,
  rng: SeededRandom,
  budget: number,
): number[] | null {
  const record = new Array<number>(81).fill(0);
  const shuffle: Shuffle = { rng, budget };
  const found = search(
    new Array<number>(81).fill(0),
    1,
    record,
    geometry,
    shuffle,
  );
  return found === 0 ? null : record;
}

export function fillGrid(rng: SeededRandom): number[] {
  const regionOf = CLASSIC_GEOMETRY.regionOf;
  const grid = new Array<number>(81).fill(0);
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);

  const recurse = (i: number): boolean => {
    if (i === 81) {
      return true;
    }
    const r = rowOf(i);
    const c = colOf(i);
    const b = regionOf[i]!;
    const mask = ~(rows[r]! | cols[c]! | boxes[b]!) & 0x1ff;
    const digits: number[] = [];
    for (let d = 1; d <= 9; d += 1) {
      if ((mask & (1 << (d - 1))) !== 0) {
        digits.push(d);
      }
    }
    shuffleInPlace(digits, rng);
    for (const d of digits) {
      const bit = 1 << (d - 1);
      grid[i] = d;
      rows[r] = rows[r]! | bit;
      cols[c] = cols[c]! | bit;
      boxes[b] = boxes[b]! | bit;
      if (recurse(i + 1)) {
        return true;
      }
      grid[i] = 0;
      rows[r] = rows[r] & ~bit;
      cols[c] = cols[c] & ~bit;
      boxes[b] = boxes[b] & ~bit;
    }
    return false;
  };

  recurse(0);
  return grid;
}
