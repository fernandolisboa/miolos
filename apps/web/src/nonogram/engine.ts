import { solveNonogram, type NonogramClues } from "@miolos/games/nonogram";

import { nextHint, type Hint } from "../play/grid-hint";

import type { NonogramCellValue, NonogramMark } from "./state";

export function solutionMarks(
  clues: NonogramClues,
): readonly NonogramMark[] | null {
  let result;
  try {
    result = solveNonogram(clues);
  } catch {
    return null;
  }
  if (result.status !== "solved") {
    return null;
  }
  const size = clues.size;
  const marks: NonogramMark[] = [];
  for (const row of result.grid) {
    if (row.length !== size) {
      return null;
    }
    for (const cell of row) {
      if (cell === "unknown") {
        return null;
      }
      marks.push(cell === "filled" ? 1 : 0);
    }
  }
  return marks.length === size ** 2 ? marks : null;
}

export function filledTarget(clues: NonogramClues): number {
  let target = 0;
  for (const line of clues.rows) {
    for (const run of line) {
      target += run;
    }
  }
  return target;
}

export function countFilledCells(
  entries: readonly NonogramCellValue[],
): number {
  let filled = 0;
  for (const entry of entries) {
    if (entry === 1) {
      filled += 1;
    }
  }
  return filled;
}

export function isPictureComplete(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): boolean {
  return solution.every(
    (mark, index) => (entries[index] === 1) === (mark === 1),
  );
}

export function submittedCells(
  entries: readonly NonogramCellValue[],
  cells: number,
): readonly NonogramMark[] | null {
  if (entries.length !== cells) {
    return null;
  }
  return entries.map((entry) => (entry === 1 ? 1 : 0));
}

export type NonogramHintKind = "correction" | "fill" | "cross";

export function nextNonogramHint(
  solution: readonly NonogramMark[],
  entries: readonly NonogramCellValue[],
): Hint<NonogramMark> | null {
  const noGivens = solution.map(() => null);
  const first = nextHint<NonogramMark>(solution, noGivens, entries);
  if (first === null || first.kind === "correction" || first.value === 1) {
    return first;
  }
  const pictureOnly = solution.map((mark) => (mark === 1 ? null : 0));
  return nextHint<NonogramMark>(solution, pictureOnly, entries) ?? first;
}

export function hintKindOf(hint: Hint<NonogramMark>): NonogramHintKind {
  if (hint.kind === "correction") {
    return "correction";
  }
  return hint.value === 1 ? "fill" : "cross";
}
