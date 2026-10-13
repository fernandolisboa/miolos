import type { GridLine } from "../line";
import { isWellFormedClues, solveLine } from "./solve";
import type { NonogramCellState, NonogramClues } from "./types";

export interface NonogramStep {
  readonly index: number;
  readonly value: 0 | 1;
  readonly line: GridLine;
  readonly runs: readonly number[];
  readonly cells: readonly number[];
}

export function nextNonogramStep(
  clues: NonogramClues,
  states: readonly NonogramCellState[],
): NonogramStep | null {
  const n = clues.size;
  if (!isWellFormedClues(clues) || states.length !== n * n) {
    throw new RangeError(
      "nextNonogramStep needs well-formed clues and a size × size board",
    );
  }
  const span = Array.from({ length: n }, (_, k) => k);
  const lines = [
    ...clues.rows.map((runs, r) => ({
      line: { kind: "row" as const, index: r },
      runs,
      cells: span.map((k) => r * n + k),
    })),
    ...clues.cols.map((runs, c) => ({
      line: { kind: "column" as const, index: c },
      runs,
      cells: span.map((k) => k * n + c),
    })),
  ];
  let cross: NonogramStep | null = null;
  for (const { line, runs, cells } of lines) {
    const current = cells.map((cell) => states[cell] ?? "unknown");
    const solved = solveLine(current, runs);
    if (solved.contradiction) {
      return null;
    }
    for (let k = 0; k < n; k += 1) {
      const fixed = solved.states[k];
      if (current[k] !== "unknown" || fixed === "unknown") {
        continue;
      }
      const step = { index: cells[k]!, line, runs, cells };
      if (fixed === "filled") {
        return { ...step, value: 1 };
      }
      cross ??= { ...step, value: 0 };
    }
  }
  return cross;
}
