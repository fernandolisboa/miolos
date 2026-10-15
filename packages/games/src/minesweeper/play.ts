import { layMines } from "./field";
import { assertCell, neighbours } from "./internal";
import {
  MINESWEEPER_LEVELS,
  type MinesweeperField,
  type MinesweeperLevel,
  type MinesweeperMark,
  type MinesweeperState,
} from "./types";

export function newMinesweeperGame(
  level: MinesweeperLevel,
  seed: number,
): MinesweeperState {
  const { rows, columns } = MINESWEEPER_LEVELS[level];
  const cells = rows * columns;
  return {
    level,
    seed,
    field: null,
    open: new Array<boolean>(cells).fill(false),
    marks: new Array<MinesweeperMark>(cells).fill(null),
    status: "ready",
    hit: null,
  };
}

function isOver(state: MinesweeperState): boolean {
  return state.status === "won" || state.status === "lost";
}

function openCells(
  state: MinesweeperState,
  field: MinesweeperField,
  starts: readonly number[],
): MinesweeperState {
  const open = [...state.open];
  const marks = [...state.marks];
  let hit: number | null = null;
  const queue: number[] = [];

  for (const start of starts) {
    if (field.mines[start]) {
      hit ??= start;
    } else if (!open[start]) {
      open[start] = true;
      marks[start] = null;
      queue.push(start);
    }
  }
  while (queue.length > 0) {
    const cell = queue.pop()!;
    if (field.counts[cell] !== 0) {
      continue;
    }
    for (const n of neighbours(field.rows, field.columns, cell)) {
      if (!open[n] && marks[n] !== "flag") {
        open[n] = true;
        marks[n] = null;
        queue.push(n);
      }
    }
  }

  if (hit !== null) {
    return { ...state, field, open, marks, status: "lost", hit };
  }
  if (field.mines.every((mine, i) => mine || open[i])) {
    const flagged = marks.map((mark, i) => (field.mines[i] ? "flag" : mark));
    return { ...state, field, open, marks: flagged, status: "won" };
  }
  return { ...state, field, open, marks, status: "playing" };
}

export function openMinesweeperCell(
  state: MinesweeperState,
  index: number,
): MinesweeperState {
  assertCell(state.open.length, index);
  if (isOver(state) || state.open[index] || state.marks[index] === "flag") {
    return state;
  }
  const field =
    state.field ??
    layMines({ seed: state.seed, level: state.level, safe: index });
  return openCells(state, field, [index]);
}

export function chordMinesweeper(
  state: MinesweeperState,
  index: number,
): MinesweeperState {
  assertCell(state.open.length, index);
  const field = state.field;
  if (field === null || isOver(state) || !state.open[index]) {
    return state;
  }
  const around = neighbours(field.rows, field.columns, index);
  const flags = around.filter((n) => state.marks[n] === "flag").length;
  const targets = around.filter(
    (n) => !state.open[n] && state.marks[n] !== "flag",
  );
  if (flags !== field.counts[index] || targets.length === 0) {
    return state;
  }
  return openCells(state, field, targets);
}

export function cycleMinesweeperMark(
  state: MinesweeperState,
  index: number,
  questionMarks: boolean,
): MinesweeperState {
  assertCell(state.open.length, index);
  if (isOver(state) || state.open[index]) {
    return state;
  }
  const current = state.marks[index];
  const next: MinesweeperMark =
    current === null
      ? "flag"
      : current === "flag" && questionMarks
        ? "question"
        : null;
  const marks = [...state.marks];
  marks[index] = next;
  return { ...state, marks };
}
