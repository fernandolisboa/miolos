import type {
  NonogramCellState,
  NonogramClues,
  NonogramSolveResult,
} from "./types";

export interface LineSolveResult {
  readonly contradiction: boolean;

  readonly states: ReadonlyArray<NonogramCellState>;
}

export function solveLine(
  states: ReadonlyArray<NonogramCellState>,
  runs: ReadonlyArray<number>,
): LineSolveResult {
  const n = states.length;
  const m = runs.length;

  const nextEmpty: number[] = new Array<number>(n + 1);
  nextEmpty[n] = n;
  for (let i = n - 1; i >= 0; i -= 1) {
    nextEmpty[i] = states[i] === "empty" ? i : (nextEmpty[i + 1] ?? n);
  }

  const suffixNoFilled: boolean[] = new Array<boolean>(n + 1);
  suffixNoFilled[n] = true;
  for (let i = n - 1; i >= 0; i -= 1) {
    suffixNoFilled[i] =
      states[i] !== "filled" && (suffixNoFilled[i + 1] ?? true);
  }

  const feasible: boolean[][] = [];
  for (let i = 0; i <= n; i += 1) {
    feasible.push(new Array<boolean>(m + 1).fill(false));
  }
  for (let i = 0; i <= n; i += 1) {
    const row = feasible[i];
    if (row !== undefined) {
      row[m] = suffixNoFilled[i] === true;
    }
  }
  for (let j = m - 1; j >= 0; j -= 1) {
    const runLength = runs[j] ?? 0;
    for (let i = n - 1; i >= 0; i -= 1) {
      const end = i + runLength;
      let ok = false;

      if (states[i] !== "filled" && feasible[i + 1]?.[j] === true) {
        ok = true;
      }

      if (!ok && end <= n && (nextEmpty[i] ?? n) >= end) {
        if (end === n) {
          ok = j === m - 1;
        } else if (states[end] !== "filled") {
          ok = feasible[end + 1]?.[j + 1] === true;
        }
      }
      const row = feasible[i];
      if (row !== undefined) {
        row[j] = ok;
      }
    }
  }

  if (feasible[0]?.[0] !== true) {
    return { contradiction: true, states: [...states] };
  }

  const canBeEmpty: boolean[] = new Array<boolean>(n).fill(false);
  const canBeFilled: boolean[] = new Array<boolean>(n).fill(false);
  const visited: boolean[][] = [];
  for (let i = 0; i <= n; i += 1) {
    visited.push(new Array<boolean>(m + 1).fill(false));
  }
  const stack: Array<readonly [number, number]> = [[0, 0]];
  while (stack.length > 0) {
    const top = stack.pop();
    if (top === undefined) {
      break;
    }
    const [i, j] = top;
    const visitedRow = visited[i];
    if (visitedRow === undefined || visitedRow[j] === true) {
      continue;
    }
    visitedRow[j] = true;
    if (i >= n) {
      continue;
    }

    if (states[i] !== "filled" && feasible[i + 1]?.[j] === true) {
      canBeEmpty[i] = true;
      stack.push([i + 1, j]);
    }

    if (j < m) {
      const runLength = runs[j] ?? 0;
      const end = i + runLength;
      if (end <= n && (nextEmpty[i] ?? n) >= end) {
        const separatorOk =
          end === n
            ? j === m - 1
            : states[end] !== "filled" && feasible[end + 1]?.[j + 1] === true;
        if (separatorOk) {
          for (let c = i; c < end; c += 1) {
            canBeFilled[c] = true;
          }
          if (end === n) {
            stack.push([n, m]);
          } else {
            canBeEmpty[end] = true;
            stack.push([end + 1, j + 1]);
          }
        }
      }
    }
  }

  const next: NonogramCellState[] = new Array<NonogramCellState>(n).fill(
    "unknown",
  );
  for (let i = 0; i < n; i += 1) {
    const filled = canBeFilled[i] === true;
    const empty = canBeEmpty[i] === true;
    if (filled && !empty) {
      next[i] = "filled";
    } else if (empty && !filled) {
      next[i] = "empty";
    } else if (!filled && !empty) {
      return { contradiction: true, states: [...states] };
    } else {
      next[i] = states[i] ?? "unknown";
    }
  }
  return { contradiction: false, states: next };
}

const MAX_SOLVE_SIZE = 15;

export function isWellFormedClues(clues: NonogramClues): boolean {
  const n = clues.size;
  if (!Number.isInteger(n) || n < 1 || n > MAX_SOLVE_SIZE) {
    return false;
  }
  if (clues.rows.length !== n || clues.cols.length !== n) {
    return false;
  }
  const wellFormedLine = (runs: ReadonlyArray<number>): boolean =>
    runs.every((run) => Number.isInteger(run) && run >= 1);
  return clues.rows.every(wellFormedLine) && clues.cols.every(wellFormedLine);
}

export function solveNonogram(clues: NonogramClues): NonogramSolveResult {
  if (!isWellFormedClues(clues)) {
    throw new RangeError(
      `malformed nonogram clues: size must be an integer in 1..${String(MAX_SOLVE_SIZE)} with size-length row/column clue lists of positive integer runs`,
    );
  }
  const n = clues.size;
  const grid: NonogramCellState[][] = [];
  for (let r = 0; r < n; r += 1) {
    grid.push(new Array<NonogramCellState>(n).fill("unknown"));
  }
  const rowDirty: boolean[] = new Array<boolean>(n).fill(true);
  const colDirty: boolean[] = new Array<boolean>(n).fill(true);

  let passes = 0;
  let firstPassFill = 0;
  let sweeps = 0;

  const countDetermined = (): number => {
    let determined = 0;
    for (const row of grid) {
      for (const cell of row) {
        if (cell !== "unknown") {
          determined += 1;
        }
      }
    }
    return determined;
  };

  const finish = (
    status: NonogramSolveResult["status"],
  ): NonogramSolveResult => ({
    status,
    grid,
    passes,
    firstPassFill,
  });

  while (rowDirty.includes(true) || colDirty.includes(true)) {
    sweeps += 1;
    let changedInSweep = 0;

    for (let r = 0; r < n; r += 1) {
      if (rowDirty[r] !== true) {
        continue;
      }
      rowDirty[r] = false;
      const line = grid[r];
      if (line === undefined) {
        continue;
      }
      const result = solveLine(line, clues.rows[r] ?? []);
      if (result.contradiction) {
        if (sweeps === 1) {
          firstPassFill = countDetermined() / (n * n);
        }
        return finish("contradiction");
      }
      for (let c = 0; c < n; c += 1) {
        const value = result.states[c];
        if (value !== undefined && value !== "unknown" && line[c] !== value) {
          line[c] = value;
          colDirty[c] = true;
          changedInSweep += 1;
        }
      }
    }

    for (let c = 0; c < n; c += 1) {
      if (colDirty[c] !== true) {
        continue;
      }
      colDirty[c] = false;
      const column: NonogramCellState[] = [];
      for (const row of grid) {
        column.push(row[c] ?? "unknown");
      }
      const result = solveLine(column, clues.cols[c] ?? []);
      if (result.contradiction) {
        if (sweeps === 1) {
          firstPassFill = countDetermined() / (n * n);
        }
        return finish("contradiction");
      }
      for (let r = 0; r < n; r += 1) {
        const value = result.states[r];
        const row = grid[r];
        if (
          row !== undefined &&
          value !== undefined &&
          value !== "unknown" &&
          row[c] !== value
        ) {
          row[c] = value;
          rowDirty[r] = true;
          changedInSweep += 1;
        }
      }
    }

    if (sweeps === 1) {
      firstPassFill = countDetermined() / (n * n);
    }
    if (changedInSweep > 0) {
      passes += 1;
    }
  }

  const solved = countDetermined() === n * n;
  return finish(solved ? "solved" : "stuck");
}

export function effortScore(result: NonogramSolveResult): number {
  return result.passes + (1 - result.firstPassFill);
}
