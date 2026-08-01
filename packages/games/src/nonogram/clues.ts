import type { NonogramClues, NonogramSolution } from "./types";

function runLengths(line: ReadonlyArray<boolean>): number[] {
  const runs: number[] = [];
  let current = 0;
  for (const filled of line) {
    if (filled) {
      current += 1;
    } else if (current > 0) {
      runs.push(current);
      current = 0;
    }
  }
  if (current > 0) {
    runs.push(current);
  }
  return runs;
}

/**
 * Run-length encode the filled runs of each row (top→bottom) and column
 * (left→right). An all-empty line's clue is `[]` (the UI renders "0").
 */
export function deriveClues(solution: NonogramSolution): NonogramClues {
  const size = solution.length;
  const rows = solution.map(runLengths);
  const cols: number[][] = [];
  for (let c = 0; c < size; c += 1) {
    const column: boolean[] = [];
    for (const row of solution) {
      column.push(row[c] === true);
    }
    cols.push(runLengths(column));
  }
  return { size, rows, cols };
}
