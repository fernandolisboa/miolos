import { neighbours } from "./internal";
import {
  cycleMinesweeperMark,
  openMinesweeperCell,
  startMinesweeper,
} from "./play";
import type { MinesweeperField, MinesweeperState } from "./types";

interface Constraint {
  readonly cells: readonly number[];
  readonly mines: number;
}

function constraints(
  state: MinesweeperState,
  field: MinesweeperField,
): Map<number, Constraint> {
  const result = new Map<number, Constraint>();
  state.open.forEach((open, cell) => {
    if (!open) {
      return;
    }
    const around = neighbours(field.rows, field.columns, cell);
    const cells = around.filter(
      (n) => !state.open[n] && state.marks[n] !== "flag",
    );
    const flags = around.filter((n) => state.marks[n] === "flag").length;
    if (cells.length > 0) {
      result.set(cell, { cells, mines: field.counts[cell]! - flags });
    }
  });
  return result;
}

function settle(
  cells: readonly number[],
  mines: number,
  safe: Set<number>,
  flagged: Set<number>,
): void {
  if (mines === 0) {
    cells.forEach((cell) => safe.add(cell));
  } else if (mines === cells.length) {
    cells.forEach((cell) => flagged.add(cell));
  }
}

function nearby(
  known: ReadonlyMap<number, Constraint>,
  field: MinesweeperField,
  cell: number,
): Constraint[] {
  const row = Math.floor(cell / field.columns);
  const column = cell % field.columns;
  const result: Constraint[] = [];
  for (
    let r = Math.max(0, row - 2);
    r <= Math.min(field.rows - 1, row + 2);
    r += 1
  ) {
    for (
      let c = Math.max(0, column - 2);
      c <= Math.min(field.columns - 1, column + 2);
      c += 1
    ) {
      const constraint = known.get(r * field.columns + c);
      if (constraint !== undefined) {
        result.push(constraint);
      }
    }
  }
  return result;
}

function deduce(
  state: MinesweeperState,
  field: MinesweeperField,
): { safe: Set<number>; flagged: Set<number> } {
  const safe = new Set<number>();
  const flagged = new Set<number>();
  const known = constraints(state, field);
  for (const [cell, a] of known) {
    settle(a.cells, a.mines, safe, flagged);
    for (const b of nearby(known, field, cell)) {
      if (
        b.cells.length > a.cells.length &&
        a.cells.every((n) => b.cells.includes(n))
      ) {
        const rest = b.cells.filter((n) => !a.cells.includes(n));
        settle(rest, b.mines - a.mines, safe, flagged);
      }
    }
  }
  return { safe, flagged };
}

export function solveMinesweeper(
  field: MinesweeperField,
  start: number,
): MinesweeperState {
  let state = startMinesweeper(field, start);
  while (state.status === "playing") {
    const { safe, flagged } = deduce(state, field);
    if (safe.size === 0 && flagged.size === 0) {
      break;
    }
    for (const cell of flagged) {
      state = cycleMinesweeperMark(state, cell, false);
    }
    for (const cell of safe) {
      state = openMinesweeperCell(state, cell);
    }
  }
  return state;
}
