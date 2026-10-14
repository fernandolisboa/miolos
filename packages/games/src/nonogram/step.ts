import { nonogramLines, type NonogramLineSpec } from "./lines";
import { isWellFormedClues, solveLine } from "./solve";
import type { NonogramCellState, NonogramClues } from "./types";

export interface NonogramStep extends NonogramLineSpec {
  readonly index: number;
  readonly value: 0 | 1;
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
  let cross: NonogramStep | null = null;
  for (const { line, runs, cells } of nonogramLines(clues)) {
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
