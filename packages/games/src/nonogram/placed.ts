import { runLengths } from "./clues";
import { nonogramLines } from "./lines";
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

function contradicted(
  states: readonly NonogramCellState[],
  runs: readonly number[],
  blocks: readonly number[],
): boolean {
  const most = runs.reduce((sum, run) => sum + run, 0);
  const longest = Math.max(0, ...runs);
  if (
    blocks.reduce((sum, block) => sum + block, 0) > most ||
    blocks.some((block) => block > longest)
  ) {
    return true;
  }
  let groups = 0;
  let counted = false;
  for (const state of states) {
    if (state === "empty") {
      counted = false;
    } else if (state === "filled" && !counted) {
      groups += 1;
      counted = true;
    }
  }
  return groups > runs.length;
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
  if (!states.includes("unknown") || contradicted(states, runs, blocks)) {
    return runs.map(() => false);
  }
  const fromStart = closedRunsFromStart(states, runs);
  const fromEnd = closedRunsFromStart(
    [...states].reverse(),
    [...runs].reverse(),
  );
  return runs.map((_, i) => i < fromStart || i >= runs.length - fromEnd);
}

export function placedClues(
  clues: NonogramClues,
  states: readonly NonogramCellState[],
): {
  readonly rows: readonly (readonly boolean[])[];
  readonly cols: readonly (readonly boolean[])[];
} {
  const placed = nonogramLines(clues, states).map(({ runs, current }) =>
    placedRuns(current, runs),
  );
  return { rows: placed.slice(0, clues.size), cols: placed.slice(clues.size) };
}
