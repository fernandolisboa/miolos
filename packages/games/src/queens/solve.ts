import {
  isFilled,
  openCount,
  openIn,
  openMarks,
  place,
  placeSingles,
  QUEEN,
} from "./candidates";
import type { Mark } from "./candidates";
import { geometryOf } from "./internal";
import type { Geometry } from "./internal";
import type { QueensBoard, QueensGrid } from "./types";

function searchFrom(
  geometry: Geometry,
  marks: Mark[],
  limit: number,
  found: QueensGrid[],
): void {
  if (!placeSingles(geometry, marks)) {
    return;
  }
  let branch: readonly number[] | null = null;
  let fewest = Infinity;
  for (const unit of geometry.units) {
    const open = isFilled(marks, unit) ? Infinity : openCount(marks, unit);
    if (open < fewest) {
      fewest = open;
      branch = unit;
    }
  }
  if (branch === null) {
    found.push(marks.map((mark) => (mark === QUEEN ? 1 : 0)));
    return;
  }
  for (const cell of openIn(marks, branch)) {
    const next = [...marks];
    place(geometry, next, cell);
    searchFrom(geometry, next, limit, found);
    if (found.length >= limit) {
      return;
    }
  }
}

export function searchQueens(board: QueensBoard, limit: number): QueensGrid[] {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      `limit must be a positive integer, got ${String(limit)}`,
    );
  }
  const geometry = geometryOf(board);
  const found: QueensGrid[] = [];
  searchFrom(geometry, openMarks(geometry), limit, found);
  return found;
}

export function countQueensSolutions(board: QueensBoard, limit = 2): number {
  return searchQueens(board, limit).length;
}

export function solveQueens(board: QueensBoard): QueensGrid | null {
  const found = searchQueens(board, 2);
  return found.length === 1 ? found[0]! : null;
}
