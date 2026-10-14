import type { GridLine } from "../line";
import { isWellFormedClues } from "./solve";
import type { NonogramCellState, NonogramClues } from "./types";

export interface NonogramLineSpec {
  readonly line: GridLine;
  readonly runs: readonly number[];
  readonly cells: readonly number[];
}

export interface NonogramBoardLine extends NonogramLineSpec {
  readonly current: readonly NonogramCellState[];
}

export function nonogramLines(
  clues: NonogramClues,
  states: readonly NonogramCellState[],
): NonogramBoardLine[] {
  const n = clues.size;
  if (!isWellFormedClues(clues) || states.length !== n * n) {
    throw new RangeError(
      "a Nonogram board needs well-formed clues and size × size cells",
    );
  }
  const span = Array.from({ length: n }, (_, k) => k);
  const lineOf = (
    line: GridLine,
    runs: readonly number[],
    at: (k: number) => number,
  ) => {
    const cells = span.map(at);
    return {
      line,
      runs,
      cells,
      current: cells.map((cell) => states[cell] ?? "unknown"),
    };
  };
  return [
    ...clues.rows.map((runs, r) =>
      lineOf({ kind: "row", index: r }, runs, (k) => r * n + k),
    ),
    ...clues.cols.map((runs, c) =>
      lineOf({ kind: "column", index: c }, runs, (k) => k * n + c),
    ),
  ];
}
