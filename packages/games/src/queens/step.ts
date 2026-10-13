import {
  loneOpenCell,
  NO_CANDIDATE,
  openMarks,
  OUT,
  place,
} from "./candidates";
import type { Mark } from "./candidates";
import { checkEntries, geometryOf } from "./internal";
import type { Geometry } from "./internal";
import { ELIMINATION_TIER, eliminate } from "./ladder";
import type {
  QueensBoard,
  QueensElimination,
  QueensEntry,
  QueensStep,
  QueensUnit,
} from "./types";

function unitOf(size: number, unit: number): QueensUnit {
  if (unit < size) {
    return { kind: "row", index: unit };
  }
  return unit < 2 * size
    ? { kind: "column", index: unit - size }
    : { kind: "region", index: unit - 2 * size };
}

function seededMarks(
  geometry: Geometry,
  entries: readonly QueensEntry[],
): Mark[] {
  const marks = openMarks(geometry);
  entries.forEach((entry, cell) => {
    if (entry === 1) {
      place(geometry, marks, cell);
    } else if (entry === 0) {
      marks[cell] = OUT;
    }
  });
  return marks;
}

export function nextQueensStep(
  board: QueensBoard,
  entries: readonly QueensEntry[],
): QueensStep | null {
  const geometry = geometryOf(board);
  checkEntries(geometry.size, entries);
  const marks = seededMarks(geometry, entries);
  let after: QueensElimination | null = null;
  for (;;) {
    for (const [unit, cells] of geometry.units.entries()) {
      const index = loneOpenCell(marks, cells);
      if (index === NO_CANDIDATE) {
        return null;
      }
      if (index >= 0) {
        return { index, unit: unitOf(geometry.size, unit), cells, after };
      }
    }
    const rule = eliminate(geometry, marks);
    if (rule === null) {
      return null;
    }
    if (after === null || ELIMINATION_TIER[rule] > ELIMINATION_TIER[after]) {
      after = rule;
    }
  }
}
