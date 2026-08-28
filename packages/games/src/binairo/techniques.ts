import { cellAt, intAt, setCellAt, sideLength, toCellStates } from "./internal";
import type { CellState } from "./internal";
import type { BinairoGrid } from "./types";

export interface SolverState {
  readonly n: number;
  readonly half: number;
  readonly cells: CellState[];
  readonly rowZeros: number[];
  readonly rowOnes: number[];
  readonly colZeros: number[];
  readonly colOnes: number[];
}

export function emptyState(n: number): SolverState {
  return {
    n,
    half: n / 2,
    cells: new Array<CellState>(n * n).fill(-1),
    rowZeros: new Array<number>(n).fill(0),
    rowOnes: new Array<number>(n).fill(0),
    colZeros: new Array<number>(n).fill(0),
    colOnes: new Array<number>(n).fill(0),
  };
}

export function cloneState(state: SolverState): SolverState {
  return {
    n: state.n,
    half: state.half,
    cells: [...state.cells],
    rowZeros: [...state.rowZeros],
    rowOnes: [...state.rowOnes],
    colZeros: [...state.colZeros],
    colOnes: [...state.colOnes],
  };
}

export function stateFromGrid(grid: BinairoGrid): SolverState | null {
  const n = sideLength(grid.length);
  const state = emptyState(n);
  const cells = toCellStates(grid);
  for (let index = 0; index < cells.length; index += 1) {
    const value = cellAt(cells, index);
    if (value === -1) {
      continue;
    }
    if (!place(state, index, value)) {
      return null;
    }
  }
  return state;
}

export function isComplete(state: SolverState): boolean {
  return !state.cells.includes(-1);
}

function createsRun(
  state: SolverState,
  row: number,
  col: number,
  value: 0 | 1,
): boolean {
  const { n, cells } = state;
  for (
    let start = Math.max(0, col - 2);
    start <= Math.min(col, n - 3);
    start += 1
  ) {
    if (
      cellAt(cells, row * n + start) === value &&
      cellAt(cells, row * n + start + 1) === value &&
      cellAt(cells, row * n + start + 2) === value
    ) {
      return true;
    }
  }
  for (
    let start = Math.max(0, row - 2);
    start <= Math.min(row, n - 3);
    start += 1
  ) {
    if (
      cellAt(cells, start * n + col) === value &&
      cellAt(cells, (start + 1) * n + col) === value &&
      cellAt(cells, (start + 2) * n + col) === value
    ) {
      return true;
    }
  }
  return false;
}

function rowIsComplete(state: SolverState, row: number): boolean {
  return intAt(state.rowZeros, row) + intAt(state.rowOnes, row) === state.n;
}

function colIsComplete(state: SolverState, col: number): boolean {
  return intAt(state.colZeros, col) + intAt(state.colOnes, col) === state.n;
}

function completesDuplicateLine(
  state: SolverState,
  row: number,
  col: number,
): boolean {
  const { n, cells } = state;
  if (rowIsComplete(state, row)) {
    for (let other = 0; other < n; other += 1) {
      if (other === row || !rowIsComplete(state, other)) {
        continue;
      }
      let equal = true;
      for (let c = 0; c < n; c += 1) {
        if (cellAt(cells, row * n + c) !== cellAt(cells, other * n + c)) {
          equal = false;
          break;
        }
      }
      if (equal) {
        return true;
      }
    }
  }
  if (colIsComplete(state, col)) {
    for (let other = 0; other < n; other += 1) {
      if (other === col || !colIsComplete(state, other)) {
        continue;
      }
      let equal = true;
      for (let r = 0; r < n; r += 1) {
        if (cellAt(cells, r * n + col) !== cellAt(cells, r * n + other)) {
          equal = false;
          break;
        }
      }
      if (equal) {
        return true;
      }
    }
  }
  return false;
}

export function place(
  state: SolverState,
  index: number,
  value: 0 | 1,
): boolean {
  const current = cellAt(state.cells, index);
  if (current === value) {
    return true;
  }
  if (current !== -1) {
    return false;
  }
  const { n, half } = state;
  const row = Math.floor(index / n);
  const col = index % n;
  const rowCounts = value === 0 ? state.rowZeros : state.rowOnes;
  const colCounts = value === 0 ? state.colZeros : state.colOnes;
  setCellAt(state.cells, index, value);
  rowCounts[row] = intAt(rowCounts, row) + 1;
  colCounts[col] = intAt(colCounts, col) + 1;
  if (
    intAt(rowCounts, row) > half ||
    intAt(colCounts, col) > half ||
    createsRun(state, row, col, value) ||
    completesDuplicateLine(state, row, col)
  ) {
    setCellAt(state.cells, index, -1);
    rowCounts[row] = intAt(rowCounts, row) - 1;
    colCounts[col] = intAt(colCounts, col) - 1;
    return false;
  }
  return true;
}

export function unplace(state: SolverState, index: number): void {
  const value = cellAt(state.cells, index);
  if (value === -1) {
    throw new RangeError(`cell ${index} is already empty`);
  }
  const { n } = state;
  const row = Math.floor(index / n);
  const col = index % n;
  const rowCounts = value === 0 ? state.rowZeros : state.rowOnes;
  const colCounts = value === 0 ? state.colZeros : state.colOnes;
  setCellAt(state.cells, index, -1);
  rowCounts[row] = intAt(rowCounts, row) - 1;
  colCounts[col] = intAt(colCounts, col) - 1;
}

type RuleOutcome = "progress" | "none" | "contradiction";

function flip(value: 0 | 1): 0 | 1 {
  return value === 0 ? 1 : 0;
}

function applyTier1(state: SolverState): RuleOutcome {
  const { n, half, cells } = state;
  let progress = false;

  for (const isRow of [true, false]) {
    for (let line = 0; line < n; line += 1) {
      for (let start = 0; start + 2 < n; start += 1) {
        const i0 = isRow ? line * n + start : start * n + line;
        const i1 = isRow ? line * n + start + 1 : (start + 1) * n + line;
        const i2 = isRow ? line * n + start + 2 : (start + 2) * n + line;
        const a = cellAt(cells, i0);
        const b = cellAt(cells, i1);
        const c = cellAt(cells, i2);

        if (a !== -1 && a === b && c === -1) {
          if (!place(state, i2, flip(a))) {
            return "contradiction";
          }
          progress = true;
        } else if (b !== -1 && b === c && a === -1) {
          if (!place(state, i0, flip(b))) {
            return "contradiction";
          }
          progress = true;
        } else if (a !== -1 && a === c && b === -1) {
          if (!place(state, i1, flip(a))) {
            return "contradiction";
          }
          progress = true;
        }
      }
    }
  }

  for (const isRow of [true, false]) {
    const zeroCounts = isRow ? state.rowZeros : state.colZeros;
    const oneCounts = isRow ? state.rowOnes : state.colOnes;
    for (let line = 0; line < n; line += 1) {
      for (const digit of [0, 1] as const) {
        const count =
          digit === 0 ? intAt(zeroCounts, line) : intAt(oneCounts, line);
        if (count !== half) {
          continue;
        }
        for (let i = 0; i < n; i += 1) {
          const index = isRow ? line * n + i : i * n + line;
          if (cellAt(cells, index) === -1) {
            if (!place(state, index, flip(digit))) {
              return "contradiction";
            }
            progress = true;
          }
        }
      }
    }
  }

  return progress ? "progress" : "none";
}

function applyTier2(state: SolverState): RuleOutcome {
  const { n, cells } = state;

  for (let index = 0; index < cells.length; index += 1) {
    if (cellAt(cells, index) !== -1) {
      continue;
    }
    for (const value of [0, 1] as const) {
      const scratch = cloneState(state);
      if (!place(scratch, index, value) || !propagate(scratch, 1)) {
        if (!place(state, index, flip(value))) {
          return "contradiction";
        }
        return "progress";
      }
    }
  }

  for (const isRow of [true, false]) {
    for (let a = 0; a < n; a += 1) {
      const aComplete = isRow
        ? rowIsComplete(state, a)
        : colIsComplete(state, a);
      if (!aComplete) {
        continue;
      }
      for (let b = 0; b < n; b += 1) {
        if (b === a) {
          continue;
        }
        const empties: number[] = [];
        let agrees = true;
        for (let i = 0; i < n; i += 1) {
          const aIndex = isRow ? a * n + i : i * n + a;
          const bIndex = isRow ? b * n + i : i * n + b;
          const bValue = cellAt(cells, bIndex);
          if (bValue === -1) {
            empties.push(i);
          } else if (bValue !== cellAt(cells, aIndex)) {
            agrees = false;
            break;
          }
        }
        if (!agrees || empties.length !== 2) {
          continue;
        }
        const [e1, e2] = empties;
        if (e1 === undefined || e2 === undefined) {
          continue;
        }
        const a1 = cellAt(cells, isRow ? a * n + e1 : e1 * n + a);
        const a2 = cellAt(cells, isRow ? a * n + e2 : e2 * n + a);
        if (a1 === -1 || a2 === -1 || a1 === a2) {
          continue;
        }
        const b1 = isRow ? b * n + e1 : e1 * n + b;
        const b2 = isRow ? b * n + e2 : e2 * n + b;
        if (!place(state, b1, a2) || !place(state, b2, a1)) {
          return "contradiction";
        }
        return "progress";
      }
    }
  }

  return "none";
}

export function propagate(state: SolverState, maxTier: 1 | 2): boolean {
  for (;;) {
    const tier1 = applyTier1(state);
    if (tier1 === "contradiction") {
      return false;
    }
    if (tier1 === "progress") {
      continue;
    }
    if (maxTier === 1) {
      return true;
    }
    const tier2 = applyTier2(state);
    if (tier2 === "contradiction") {
      return false;
    }
    if (tier2 === "none") {
      return true;
    }
  }
}
