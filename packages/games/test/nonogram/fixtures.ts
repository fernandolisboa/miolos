import {
  deriveClues,
  type NonogramCellState,
  type NonogramClues,
} from "../../src/nonogram/index";

export function cluesOf(rows: readonly string[]): NonogramClues {
  return deriveClues(rows.map((row) => [...row].map((ch) => ch === "#")));
}

export function board(rows: readonly string[]): NonogramCellState[] {
  return rows.flatMap((row) =>
    [...row].map((ch) =>
      ch === "#" ? "filled" : ch === "x" ? "empty" : "unknown",
    ),
  );
}

export function arrangements(
  length: number,
  runs: readonly number[],
): boolean[][] {
  if (runs.length === 0) {
    return [new Array<boolean>(length).fill(false)];
  }
  const [first = 0, ...rest] = runs;
  const restMin = rest.reduce((sum, run) => sum + run + 1, 0);
  const found: boolean[][] = [];
  for (let start = 0; start + first + restMin <= length; start += 1) {
    const head = [
      ...new Array<boolean>(start).fill(false),
      ...new Array<boolean>(first).fill(true),
    ];
    if (rest.length === 0) {
      found.push([
        ...head,
        ...new Array<boolean>(length - head.length).fill(false),
      ]);
      continue;
    }
    for (const tail of arrangements(length - head.length - 1, rest)) {
      found.push([...head, false, ...tail]);
    }
  }
  return found;
}

export function consistent(
  spec: { readonly runs: readonly number[]; readonly cells: readonly number[] },
  states: readonly NonogramCellState[],
): boolean[][] {
  return arrangements(spec.cells.length, spec.runs).filter((arrangement) =>
    spec.cells.every((cell, k) => {
      const state = states[cell];
      return state === "unknown" || (state === "filled") === arrangement[k];
    }),
  );
}
