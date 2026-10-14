import type { GridLine } from "../line";
import type { NonogramClues } from "./types";

export interface NonogramLineSpec {
  readonly line: GridLine;
  readonly runs: readonly number[];
  readonly cells: readonly number[];
}

export function nonogramLines(clues: NonogramClues): NonogramLineSpec[] {
  const n = clues.size;
  const span = Array.from({ length: n }, (_, k) => k);
  return [
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
}
