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

interface Masks {
  readonly rows: number[];
  readonly cols: number[];
  readonly regions: number[];
  readonly hasExtras: boolean;
  extrasTaken(i: number): number;
  toggleExtras(i: number, bit: number): void;
}

function masksFor({ units, extraBits }: SudokuGeometry): Masks {
  const extras = new Array<number>(units.length - EXTRA_UNITS).fill(0);
  return {
    rows: new Array<number>(9).fill(0),
    cols: new Array<number>(9).fill(0),
    regions: new Array<number>(9).fill(0),
    hasExtras: extras.length > 0,
    extrasTaken: (i) => {
      let taken = 0;
      for (let m = extraBits[i]!; m !== 0; m &= m - 1) {
        taken |= extras[31 - Math.clz32(m & -m)]!;
      }
      return taken;
    },
    toggleExtras: (i, bit) => {
      for (let m = extraBits[i]!; m !== 0; m &= m - 1) {
        const e = 31 - Math.clz32(m & -m);
        extras[e] = extras[e]! ^ bit;
      }
    },
  };
}

function takenAt(masks: Masks, regionOf: readonly number[], i: number): number {
  const taken =
    masks.rows[rowOf(i)]! |
    masks.cols[colOf(i)]! |
    masks.regions[regionOf[i]!]!;
  return masks.hasExtras ? taken | masks.extrasTaken(i) : taken;
}

function toggle(
  masks: Masks,
  regionOf: readonly number[],
  i: number,
  bit: number,
): void {
  const { rows, cols, regions } = masks;
  rows[rowOf(i)] = rows[rowOf(i)]! ^ bit;
  cols[colOf(i)] = cols[colOf(i)]! ^ bit;
  regions[regionOf[i]!] = regions[regionOf[i]!]! ^ bit;
  if (masks.hasExtras) {
    masks.toggleExtras(i, bit);
  }
}

function placeGivens(
  grid: readonly number[],
  masks: Masks,
  regionOf: readonly number[],
): boolean {
  for (let i = 0; i < 81; i += 1) {
    const value = grid[i]!;
    if (value !== 0) {
      const bit = 1 << (value - 1);
      if ((takenAt(masks, regionOf, i) & bit) !== 0) {
        return false;
      }
      toggle(masks, regionOf, i, bit);
    }
  }
  return true;
}

function search(
  grid: number[],
  limit: number,
  record: number[] | null,
  geometry: SudokuGeometry,
): number {
  const { regionOf } = geometry;
  const masks = masksFor(geometry);
  if (!placeGivens(grid, masks, regionOf)) {
    return 0;
  }
  const { rows, cols, regions, hasExtras } = masks;
  let count = 0;

  const recurse = (): void => {
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (grid[i]! !== 0) {
        continue;
      }
      // takenAt/toggle inlined on the generator's hot path, see ADR-0130 decision 2
      let taken = rows[rowOf(i)]! | cols[colOf(i)]! | regions[regionOf[i]!]!;
      if (hasExtras) {
        taken |= masks.extrasTaken(i);
      }
      const mask = ~taken & 0x1ff;
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
    const r = rowOf(best);
    const c = colOf(best);
    const g = regionOf[best]!;
    for (let left = bestMask; left !== 0; left &= left - 1) {
      const bit = left & -left;
      grid[best] = 32 - Math.clz32(bit);
      rows[r] = rows[r]! | bit;
      cols[c] = cols[c]! | bit;
      regions[g] = regions[g]! | bit;
      if (hasExtras) {
        masks.toggleExtras(best, bit);
      }
      recurse();
      grid[best] = 0;
      rows[r] = rows[r] & ~bit;
      cols[c] = cols[c] & ~bit;
      regions[g] = regions[g] & ~bit;
      if (hasExtras) {
        masks.toggleExtras(best, bit);
      }
      if (count >= limit) {
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
  return search([...grid], limit, null, geometry);
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
  const found = search([...givens], 1, record, CLASSIC_GEOMETRY);
  return found === 0 ? null : Object.freeze(record);
}

// see ADR-0130 decision 2
export function fillVariant(
  geometry: SudokuGeometry,
  rng: SeededRandom,
  budget: number,
): number[] | null {
  const { units, regionOf } = geometry;
  const grid = new Array<number>(81).fill(0);
  const masks = masksFor(geometry);
  const free = new Array<number>(81).fill(0);
  const places = new Array<number>(9).fill(0);
  let nodes = budget;

  const movesAt = (): (readonly [number, number])[] | "solved" | "dead" => {
    let best = -1;
    let fewest = 10;
    for (let i = 0; i < 81; i += 1) {
      free[i] = grid[i]! === 0 ? ~takenAt(masks, regionOf, i) & 0x1ff : 0;
      const count = POPCOUNT[free[i]!]!;
      if (grid[i]! === 0 && count < fewest) {
        fewest = count;
        best = i;
      }
    }
    if (best === -1) {
      return "solved";
    }
    if (fewest === 0) {
      return "dead";
    }
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
          return "dead";
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
      for (let m = free[best]!; m !== 0; m &= m - 1) {
        moves.push([best, m & -m]);
      }
    } else {
      for (const i of units[scarceUnit]!) {
        if ((free[i]! & scarceBit) !== 0) {
          moves.push([i, scarceBit]);
        }
      }
    }
    shuffleInPlace(moves, rng);
    return moves;
  };

  const recurse = (): boolean => {
    if ((nodes -= 1) < 0) {
      return false;
    }
    const moves = movesAt();
    if (moves === "dead") {
      return false;
    }
    if (moves === "solved") {
      return true;
    }
    for (const [cell, bit] of moves) {
      grid[cell] = 32 - Math.clz32(bit);
      toggle(masks, regionOf, cell, bit);
      if (recurse()) {
        return true;
      }
      grid[cell] = 0;
      toggle(masks, regionOf, cell, bit);
      if (nodes < 0) {
        return false;
      }
    }
    return false;
  };

  return recurse() ? grid : null;
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
