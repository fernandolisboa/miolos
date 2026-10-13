import {
  isFilled,
  loneOpenCell,
  NO_CANDIDATE,
  openIn,
  openMarks,
  OUT,
  OPEN,
  place,
  placeSingles,
  QUEEN,
} from "./candidates";
import type { Mark } from "./candidates";
import { attacks, checkEntries, geometryOf } from "./internal";
import type { Geometry } from "./internal";
import type {
  QueensBoard,
  QueensElimination,
  QueensEntry,
  QueensGrade,
  QueensStep,
  QueensTier,
  QueensUnit,
} from "./types";

const ELIMINATION_TIER: Readonly<Record<QueensElimination, QueensTier>> = {
  regionInRow: 2,
  regionInColumn: 2,
  rowInRegion: 2,
  columnInRegion: 2,
  blocking: 2,
  regionGroupRows: 3,
  regionGroupColumns: 3,
};

type Units = readonly (readonly number[])[];

function clear(marks: Mark[], cells: readonly number[]): boolean {
  let removed = false;
  for (const cell of cells) {
    if (marks[cell] === OPEN) {
      marks[cell] = OUT;
      removed = true;
    }
  }
  return removed;
}

function openUnits(marks: readonly Mark[], units: Units): number[][] {
  return units.map((unit) =>
    isFilled(marks, unit) ? [] : openIn(marks, unit),
  );
}

function clearConfined(marks: Mark[], from: Units, to: Units): boolean {
  for (const [index, open] of openUnits(marks, from).entries()) {
    if (open.length === 0) {
      continue;
    }
    const unit = from[index]!;
    for (const line of to) {
      if (
        open.every((cell) => line.includes(cell)) &&
        clear(
          marks,
          line.filter((cell) => !unit.includes(cell)),
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

function clearEmptying(geometry: Geometry, marks: Mark[]): boolean {
  const open = openUnits(marks, geometry.units).filter(
    (unit) => unit.length > 0,
  );
  for (let cell = 0; cell < marks.length; cell += 1) {
    if (marks[cell] !== OPEN) {
      continue;
    }
    if (
      open.some((unit) => unit.every((other) => attacks(geometry, cell, other)))
    ) {
      marks[cell] = OUT;
      return true;
    }
  }
  return false;
}

function clearByTier2(
  geometry: Geometry,
  marks: Mark[],
): QueensElimination | null {
  const { rows, cols, regions } = geometry;
  if (clearConfined(marks, regions, rows)) {
    return "regionInRow";
  }
  if (clearConfined(marks, regions, cols)) {
    return "regionInColumn";
  }
  if (clearConfined(marks, rows, regions)) {
    return "rowInRegion";
  }
  if (clearConfined(marks, cols, regions)) {
    return "columnInRegion";
  }
  return clearEmptying(geometry, marks) ? "blocking" : null;
}

function bitCount(mask: number): number {
  let count = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

// k open regions whose candidates span only k lines own those lines' queens.
function clearByTier3(
  geometry: Geometry,
  marks: Mark[],
): QueensElimination | null {
  const { size, rows, cols, regions, regionOf } = geometry;
  const open = openUnits(marks, regions);
  const ids = open.flatMap((cells, id) => (cells.length > 0 ? [id] : []));
  const sides = [
    {
      rule: "regionGroupRows" as const,
      lines: rows,
      lineOf: (cell: number) => Math.floor(cell / size),
    },
    {
      rule: "regionGroupColumns" as const,
      lines: cols,
      lineOf: (cell: number) => cell % size,
    },
  ].map(({ rule, lines, lineOf }) => ({
    rule,
    lines,
    masks: ids.map((id) =>
      open[id]!.reduce((mask, cell) => mask | (1 << lineOf(cell)), 0),
    ),
  }));
  for (let k = 2; k <= size - 2; k += 1) {
    for (const { rule, lines, masks } of sides) {
      for (let subset = 0; subset < 1 << ids.length; subset += 1) {
        if (bitCount(subset) !== k) {
          continue;
        }
        const chosen = ids.filter((_, i) => (subset >> i) & 1);
        const covered = masks.reduce(
          (union, mask, i) => ((subset >> i) & 1 ? union | mask : union),
          0,
        );
        if (bitCount(covered) !== k) {
          continue;
        }
        const outside = lines
          .filter((_, line) => (covered >> line) & 1)
          .flatMap((line) =>
            line.filter((cell) => !chosen.includes(regionOf[cell]!)),
          );
        if (clear(marks, outside)) {
          return rule;
        }
      }
    }
  }
  return null;
}

function eliminate(
  geometry: Geometry,
  marks: Mark[],
): QueensElimination | null {
  return clearByTier2(geometry, marks) ?? clearByTier3(geometry, marks);
}

// see ADR-0090
export function gradeQueens(board: QueensBoard): QueensGrade {
  const geometry = geometryOf(board);
  const marks = openMarks(geometry);
  let maxTier: QueensTier = 1;
  let advancedSteps = 0;
  while (placeSingles(geometry, marks)) {
    if (marks.filter((mark) => mark === QUEEN).length === geometry.size) {
      return { solved: true, maxTier, advancedSteps };
    }
    const rule = eliminate(geometry, marks);
    if (rule === null) {
      break;
    }
    advancedSteps += 1;
    const tier = ELIMINATION_TIER[rule];
    maxTier = tier > maxTier ? tier : maxTier;
  }
  return { solved: false, maxTier, advancedSteps };
}

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
