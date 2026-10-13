import type { Geometry } from "./internal";

export const OUT = -1;
export const OPEN = 0;
export const QUEEN = 1;

export type Mark = typeof OUT | typeof OPEN | typeof QUEEN;

export function openMarks(geometry: Geometry): Mark[] {
  return new Array<Mark>(geometry.size * geometry.size).fill(OPEN);
}

export function place(geometry: Geometry, marks: Mark[], cell: number): void {
  const { size, rows, cols, regions, regionOf } = geometry;
  const row = Math.floor(cell / size);
  const col = cell % size;
  for (const unit of [rows[row]!, cols[col]!, regions[regionOf[cell]!]!]) {
    for (const other of unit) {
      marks[other] = OUT;
    }
  }
  for (const r of [row - 1, row + 1]) {
    for (const c of [col - 1, col + 1]) {
      if (r >= 0 && r < size && c >= 0 && c < size) {
        marks[r * size + c] = OUT;
      }
    }
  }
  marks[cell] = QUEEN;
}

export function openIn(
  marks: readonly Mark[],
  unit: readonly number[],
): number[] {
  return unit.filter((cell) => marks[cell] === OPEN);
}

export function openCount(
  marks: readonly Mark[],
  unit: readonly number[],
): number {
  let count = 0;
  for (const cell of unit) {
    if (marks[cell] === OPEN) {
      count += 1;
    }
  }
  return count;
}

export function isFilled(
  marks: readonly Mark[],
  unit: readonly number[],
): boolean {
  return unit.some((cell) => marks[cell] === QUEEN);
}

const NO_SINGLE = -1;
export const NO_CANDIDATE = -2;

export function loneOpenCell(
  marks: readonly Mark[],
  unit: readonly number[],
): number {
  let lone = NO_CANDIDATE;
  for (const cell of unit) {
    const mark = marks[cell];
    if (mark === QUEEN) {
      return NO_SINGLE;
    }
    if (mark === OPEN) {
      if (lone >= 0) {
        return NO_SINGLE;
      }
      lone = cell;
    }
  }
  return lone;
}

export function placeSingles(geometry: Geometry, marks: Mark[]): boolean {
  for (let changed = true; changed;) {
    changed = false;
    for (const unit of geometry.units) {
      const cell = loneOpenCell(marks, unit);
      if (cell === NO_CANDIDATE) {
        return false;
      }
      if (cell >= 0) {
        place(geometry, marks, cell);
        changed = true;
      }
    }
  }
  return true;
}
