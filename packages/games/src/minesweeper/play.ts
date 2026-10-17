import { layMines } from "./field";
import { assertCell, neighbours } from "./internal";
import type {
  MinesweeperField,
  MinesweeperMark,
  MinesweeperSize,
  MinesweeperState,
} from "./types";

type Board = Pick<MinesweeperState, "size" | "open" | "marks">;

function blankBoard(size: MinesweeperSize): Board {
  const cells = size.rows * size.columns;
  return {
    size,
    open: new Array<boolean>(cells).fill(false),
    marks: new Array<MinesweeperMark>(cells).fill(null),
  };
}

export function newMinesweeperGame(
  size: MinesweeperSize,
  seed: number,
): MinesweeperState {
  return {
    ...blankBoard(size),
    seed,
    field: null,
    status: "ready",
    hit: null,
  };
}

export function startMinesweeper(
  field: MinesweeperField,
  start: number,
): MinesweeperState {
  assertCell(field.mines.length, start);
  const size = {
    rows: field.rows,
    columns: field.columns,
    mines: field.mines.filter(Boolean).length,
  };
  return openCells(blankBoard(size), field, [start]);
}

function isOver(state: MinesweeperState): boolean {
  return state.status === "won" || state.status === "lost";
}

function openCells(
  state: Board,
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

  const { size } = state;
  if (hit !== null) {
    return { size, field, open, marks, status: "lost", hit };
  }
  if (field.mines.every((mine, i) => mine || open[i])) {
    const flagged = marks.map((mark, i) => (field.mines[i] ? "flag" : mark));
    return { size, field, open, marks: flagged, status: "won", hit: null };
  }
  return { size, field, open, marks, status: "playing", hit: null };
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
    state.field === null
      ? layMines({ seed: state.seed, size: state.size, safe: [index] })
      : state.field;
  return openCells(state, field, [index]);
}

export function chordTargets(
  state: MinesweeperState,
  index: number,
): readonly number[] {
  assertCell(state.open.length, index);
  const field = state.field;
  if (field === null || isOver(state) || !state.open[index]) {
    return [];
  }
  return neighbours(field.rows, field.columns, index).filter(
    (n) => !state.open[n] && state.marks[n] !== "flag",
  );
}

export function chordMinesweeper(
  state: MinesweeperState,
  index: number,
): MinesweeperState {
  const targets = chordTargets(state, index);
  const field = state.field;
  if (field === null || targets.length === 0) {
    return state;
  }
  const flags = neighbours(field.rows, field.columns, index).filter(
    (n) => state.marks[n] === "flag",
  ).length;
  if (flags !== field.counts[index]) {
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
