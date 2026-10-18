import { lineCells } from "@miolos/games/nonogram";

import {
  claim,
  NO_AUTO_CROSSES,
  released,
  type AutoCrosses,
} from "../play/auto-cross";
import type { BinaryGridState } from "../play/binary-grid";
import { wrongCells } from "../play/grid-hint";
import type { LineCross } from "../settings/settings";
import { pictureSettled } from "./paint";

export interface LineClues<Run> {
  readonly size: number;
  readonly rows: readonly (readonly Run[])[];
  readonly cols: readonly (readonly Run[])[];
}

export type Formed<M extends number, Run> = (
  entries: readonly (M | null)[],
  runs: readonly Run[],
) => boolean;

export interface LineCrossState<M extends number, Run> extends BinaryGridState<
  unknown,
  M
> {
  readonly clues: LineClues<Run>;
  readonly autoCrossed: AutoCrosses;
}

type Crossing = "off" | "always" | "correct";

interface BoardLine<Run> {
  readonly cells: readonly number[];
  readonly runs: readonly Run[];
}

const NONE: ReadonlySet<number> = new Set();

function boardLines<Run>(clues: LineClues<Run>): BoardLine<Run>[] {
  const runs = [...clues.rows, ...clues.cols];
  return lineCells(clues.size).map(({ cells }, line) => ({
    cells,
    runs: runs[line] ?? [],
  }));
}

function lineEntries<M extends number>(
  entries: readonly (M | null)[],
  cells: readonly number[],
): (M | null)[] {
  return cells.map((cell) => entries[cell] ?? null);
}

function fillsAreRight<M extends number>(
  solution: readonly M[] | null,
  entries: readonly (M | null)[],
  cells: readonly number[],
): boolean {
  return (
    solution !== null &&
    cells.every((cell) => {
      const entry = entries[cell] ?? null;
      return entry === null || entry === 0 || entry === solution[cell];
    })
  );
}

function crossed<S extends LineCrossState<M, Run>, M extends number, Run>(
  previous: S,
  next: S,
  formed: Formed<M, Run>,
  crossing: Crossing,
): S {
  const entries = [...next.entries];
  const lines = boardLines(next.clues);
  const formedNow = lines.map(({ cells, runs }) =>
    formed(lineEntries(entries, cells), runs),
  );
  const owners = released(
    previous.autoCrossed,
    entries,
    (line) => formedNow[line] === true,
  );
  if (crossing !== "off" && next.status === "playing") {
    claim(
      lines.flatMap(({ cells, runs }, line) =>
        formedNow[line] === true &&
        runs.length > 0 &&
        !formed(lineEntries(previous.entries, cells), runs) &&
        (crossing === "always" || fillsAreRight(next.solution, entries, cells))
          ? [{ owner: line, cells }]
          : [],
      ),
      entries,
      owners,
    );
  }
  return { ...pictureSettled(next, entries), autoCrossed: owners };
}

export function lineCrossing<
  S extends LineCrossState<M, Run>,
  A extends { readonly type: string },
  M extends number,
  Run,
>(
  play: (state: S, action: A) => S,
  formed: Formed<M, Run>,
  crossing: Crossing,
): (state: S, action: A) => S {
  return (state, action) => {
    const next = play(state, action);
    if (action.type === "restore" || action.type === "reset") {
      return next === state || next.autoCrossed.size === 0
        ? next
        : { ...next, autoCrossed: NO_AUTO_CROSSES };
    }
    return next.entries === state.entries
      ? next
      : crossed(state, next, formed, crossing);
  };
}

export function lineCrossModes<R>(
  reducer: (crossing: Crossing) => R,
): Record<LineCross, R> {
  const always = reducer("always");
  return {
    always,
    flag: always,
    correct: reducer("correct"),
    off: reducer("off"),
  };
}

export function formedWrongCells<M extends number, Run>(
  clues: LineClues<Run>,
  solution: readonly M[] | null,
  entries: readonly (M | null)[],
  formed: Formed<M, Run>,
): ReadonlySet<number> {
  if (solution === null) {
    return NONE;
  }
  const wrong = wrongCells(solution, null, entries);
  const flagged = new Set<number>();
  for (const { cells, runs } of boardLines(clues)) {
    if (formed(lineEntries(entries, cells), runs)) {
      for (const cell of cells) {
        if (wrong.has(cell)) {
          flagged.add(cell);
        }
      }
    }
  }
  return flagged;
}
