import {
  isFilled,
  openIn,
  openMarks,
  OUT,
  OPEN,
  placeSingles,
  QUEEN,
} from "./candidates";
import type { Mark } from "./candidates";
import { attacks, geometryOf } from "./internal";
import type { Geometry } from "./internal";
import type { QueensBoard, QueensGrade, QueensTier } from "./types";

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

function clearByTier2(geometry: Geometry, marks: Mark[]): boolean {
  const { rows, cols, regions } = geometry;
  return (
    clearConfined(marks, regions, rows) ||
    clearConfined(marks, regions, cols) ||
    clearConfined(marks, rows, regions) ||
    clearConfined(marks, cols, regions) ||
    clearEmptying(geometry, marks)
  );
}

function bitCount(mask: number): number {
  let count = 0;
  for (let rest = mask; rest !== 0; rest &= rest - 1) {
    count += 1;
  }
  return count;
}

// k open regions whose candidates span only k lines own those lines' queens.
function clearByTier3(geometry: Geometry, marks: Mark[]): boolean {
  const { size, rows, cols, regions, regionOf } = geometry;
  const open = openUnits(marks, regions);
  const ids = open.flatMap((cells, id) => (cells.length > 0 ? [id] : []));
  for (let k = 2; k <= size - 2; k += 1) {
    for (const [lines, lineOf] of [
      [rows, (cell: number) => Math.floor(cell / size)],
      [cols, (cell: number) => cell % size],
    ] as const) {
      const masks = ids.map((id) =>
        open[id]!.reduce((mask, cell) => mask | (1 << lineOf(cell)), 0),
      );
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
          return true;
        }
      }
    }
  }
  return false;
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
    const tier = clearByTier2(geometry, marks)
      ? 2
      : clearByTier3(geometry, marks)
        ? 3
        : null;
    if (tier === null) {
      break;
    }
    advancedSteps += 1;
    maxTier = tier > maxTier ? tier : maxTier;
  }
  return { solved: false, maxTier, advancedSteps };
}
