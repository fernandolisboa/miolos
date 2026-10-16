import type { GridLine } from "../line";
import { isWellFormedClues } from "./solve";
import type { NonogramCellState, NonogramClues } from "./types";

export interface LineCells {
  readonly line: GridLine;
  readonly cells: readonly number[];
}

export interface NonogramLineSpec extends LineCells {
  readonly runs: readonly number[];
}

export interface NonogramBoardLine extends NonogramLineSpec {
  readonly current: readonly NonogramCellState[];
}

export function lineCells(size: number): LineCells[] {
  const span = Array.from({ length: size }, (_, k) => k);
  return [
    ...span.map((r) => ({
      line: { kind: "row" as const, index: r },
      cells: span.map((k) => r * size + k),
    })),
    ...span.map((c) => ({
      line: { kind: "column" as const, index: c },
      cells: span.map((k) => k * size + c),
    })),
  ];
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
  return lineCells(n).map(({ line, cells }) => ({
    line,
    runs: (line.kind === "row" ? clues.rows : clues.cols)[line.index] ?? [],
    cells,
    current: cells.map((cell) => states[cell] ?? "unknown"),
  }));
}
