// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
import type { SeededRandom } from "../random";
import { POPCOUNT, assertSudokuGrid, boxOf, colOf, rowOf } from "./board";
import type { SudokuGrid } from "./types";

interface Masks {
  readonly rows: number[];
  readonly cols: number[];
  readonly boxes: number[];
}

/** Build used-digit bitmasks from a grid, or null if a duplicate exists. */
function buildMasks(grid: readonly number[]): Masks | null {
  const rows = new Array<number>(9).fill(0);
  const cols = new Array<number>(9).fill(0);
  const boxes = new Array<number>(9).fill(0);
  for (let i = 0; i < 81; i += 1) {
    const value = grid[i]!;
    if (value === 0) {
      continue;
    }
    const bit = 1 << (value - 1);
    const r = rowOf(i);
    const c = colOf(i);
    const b = boxOf(i);
    if (
      (rows[r]! & bit) !== 0 ||
      (cols[c]! & bit) !== 0 ||
      (boxes[b]! & bit) !== 0
    ) {
      return null;
    }
    rows[r] = rows[r]! | bit;
    cols[c] = cols[c]! | bit;
    boxes[b] = boxes[b]! | bit;
  }
  return { rows, cols, boxes };
}

/**
 * Bitmask + MRV backtracking search. Counts solutions up to `limit`
 * (early-exiting the whole recursion at the limit); when `record` is
 * given, the first completed grid is copied into it. Deterministic: the
 * MRV pick uses a first-lowest-index tiebreak and digits are tried in
 * ascending order.
 */
function search(
  grid: number[],
  limit: number,
  record: number[] | null,
): number {
  const masks = buildMasks(grid);
  if (masks === null) {
    return 0;
  }
  const { rows, cols, boxes } = masks;
  let count = 0;

  const recurse = (): void => {
    if (count >= limit) {
      return;
    }
    let best = -1;
    let bestMask = 0;
    let bestCount = 10;
    for (let i = 0; i < 81; i += 1) {
      if (grid[i]! !== 0) {
        continue;
      }
      const mask =
        ~(rows[rowOf(i)]! | cols[colOf(i)]! | boxes[boxOf(i)]!) & 0x1ff;
      const candidates = POPCOUNT[mask]!;
      if (candidates === 0) {
        return; // dead end: an empty cell with no legal digit
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
    const b = boxOf(best);
    for (let d = 1; d <= 9; d += 1) {
      const bit = 1 << (d - 1);
      if ((bestMask & bit) === 0) {
        continue;
      }
      grid[best] = d;
      rows[r] = rows[r]! | bit;
      cols[c] = cols[c]! | bit;
      boxes[b] = boxes[b]! | bit;
      recurse();
      grid[best] = 0;
      rows[r] = rows[r] & ~bit;
      cols[c] = cols[c] & ~bit;
      boxes[b] = boxes[b] & ~bit;
      if (count >= limit) {
        return;
      }
    }
  };

  recurse();
  return count;
}

/** Internal counterpart of countSudokuSolutions, no shape validation. */
export function countSolutionsInternal(
  grid: readonly number[],
  limit: number,
): number {
  return search([...grid], limit, null);
}

/**
 * Number of solutions, counting stops early at `limit` (default 2, must be
 * a positive integer). countSudokuSolutions(g, 2) === 1 is the uniqueness
 * predicate used by the property tests and the generator.
 *
 * `limit` bounds total work: a sparse grid has astronomically many
 * completions (the empty grid ~6.7e21), so a large limit is effectively
 * unbounded synchronous search. Never derive `limit` from untrusted input
 * (same duty as the Binairo grid-size bound) — no legitimate uniqueness
 * check needs more than a small constant.
 */
export function countSudokuSolutions(givens: SudokuGrid, limit = 2): number {
  assertSudokuGrid(givens);
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      `limit must be a positive integer, got ${String(limit)}`,
    );
  }
  return countSolutionsInternal(givens, limit);
}

/**
 * First solution found by the backtracking solver in deterministic (fixed,
 * unseeded) order, or null if unsolvable. Validates the grid shape.
 */
export function solveSudoku(givens: SudokuGrid): SudokuGrid | null {
  assertSudokuGrid(givens);
  const record = new Array<number>(81).fill(0);
  const found = search([...givens], 1, record);
  return found === 0 ? null : Object.freeze(record);
}

/** Fisher–Yates shuffle in place, all randomness from the given rng. */
export function shuffleInPlace(values: number[], rng: SeededRandom): void {
  for (let k = values.length - 1; k > 0; k -= 1) {
    const j = rng.nextInt(k + 1);
    const tmp = values[k]!;
    values[k] = values[j]!;
    values[j] = tmp;
  }
}

/**
 * Full-grid fill by randomized backtracking: cells in fixed ascending order,
 * candidate digits Fisher–Yates-shuffled with the attempt rng. Always
 * succeeds; deterministic per rng state.
 */
export function fillGrid(rng: SeededRandom): number[] {
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
    const b = boxOf(i);
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
