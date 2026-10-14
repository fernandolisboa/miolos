import { runLengths } from "./clues";
import { nonogramLines } from "./lines";
import { isWellFormedClues } from "./solve";
import type { NonogramCellState, NonogramClues } from "./types";

function closedRunsFromStart(
  states: readonly NonogramCellState[],
  runs: readonly number[],
): number {
  let placed = 0;
  let k = 0;
  while (k < states.length && states[k] !== "unknown") {
    if (states[k] === "empty") {
      k += 1;
      continue;
    }
    let end = k;
    while (states[end] === "filled") {
      end += 1;
    }
    const closed = end === states.length || states[end] === "empty";
    if (!closed || end - k !== runs[placed]) {
      break;
    }
    placed += 1;
    k = end;
  }
  return placed;
}

export function placedRuns(
  states: readonly NonogramCellState[],
  runs: readonly number[],
): readonly boolean[] {
  const blocks = runLengths(states.map((state) => state === "filled"));
  if (
    blocks.length === runs.length &&
    blocks.every((block, i) => block === runs[i])
  ) {
    return runs.map(() => true);
  }
  if (!states.includes("unknown")) {
    return runs.map(() => false);
  }
  const fromStart = closedRunsFromStart(states, runs);
  const fromEnd = closedRunsFromStart(
    [...states].reverse(),
    [...runs].reverse(),
  );
  if (fromStart + fromEnd > runs.length) {
    return runs.map(() => false);
  }
  return runs.map((_, i) => i < fromStart || i >= runs.length - fromEnd);
}

export function placedClues(
  clues: NonogramClues,
  states: readonly NonogramCellState[],
): {
  readonly rows: readonly (readonly boolean[])[];
  readonly cols: readonly (readonly boolean[])[];
} {
  const n = clues.size;
  if (!isWellFormedClues(clues) || states.length !== n * n) {
    throw new RangeError(
      "placedClues needs well-formed clues and a size × size board",
    );
  }
  const placed = nonogramLines(clues).map(({ runs, cells }) =>
    placedRuns(
      cells.map((cell) => states[cell] ?? "unknown"),
      runs,
    ),
  );
  return { rows: placed.slice(0, n), cols: placed.slice(n) };
}
