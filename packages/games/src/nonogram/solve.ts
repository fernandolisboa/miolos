import type {
  NonogramCellState,
  NonogramClues,
  NonogramSolveResult,
} from "./types";

export interface LineSolveResult {
  readonly contradiction: boolean;
  /** The line after forcing; same reference semantics as the input (new array). */
  readonly states: ReadonlyArray<NonogramCellState>;
}

/**
 * Per-line deduction (plan §3.2): classic reachability DP over
 * (cell index, run index). Computes, across ALL placements of `runs`
 * consistent with the current `states`, which cells are forced filled,
 * forced empty, or stay unknown. Forced-cells-only — the solver never
 * guesses. O(n²·m) worst case; trivial at n <= 15.
 *
 * Internal seam, exported for unit tests and future hint machinery; not part
 * of the public barrel.
 */
export function solveLine(
  states: ReadonlyArray<NonogramCellState>,
  runs: ReadonlyArray<number>,
): LineSolveResult {
  const n = states.length;
  const m = runs.length;

  // nextEmpty[i] = smallest index >= i whose state is "empty" (n if none):
  // a run may occupy i..end-1 iff nextEmpty[i] >= end.
  const nextEmpty: number[] = new Array<number>(n + 1);
  nextEmpty[n] = n;
  for (let i = n - 1; i >= 0; i -= 1) {
    nextEmpty[i] = states[i] === "empty" ? i : (nextEmpty[i + 1] ?? n);
  }

  // suffixNoFilled[i] = no cell in i..n-1 is "filled".
  const suffixNoFilled: boolean[] = new Array<boolean>(n + 1);
  suffixNoFilled[n] = true;
  for (let i = n - 1; i >= 0; i -= 1) {
    suffixNoFilled[i] =
      states[i] !== "filled" && (suffixNoFilled[i + 1] ?? true);
  }

  // feasible[i][j] = cells i..n-1 can be completed placing runs j..m-1.
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
      // Empty branch: cell i stays empty.
      if (states[i] !== "filled" && feasible[i + 1]?.[j] === true) {
        ok = true;
      }
      // Run branch: run j occupies i..end-1, then a separator or line end.
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

  // Forward reachability from (0, 0) over feasible states, marking which
  // cells can be empty / filled in at least one complete arrangement.
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
    // Empty move.
    if (states[i] !== "filled" && feasible[i + 1]?.[j] === true) {
      canBeEmpty[i] = true;
      stack.push([i + 1, j]);
    }
    // Run move.
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
      // Unreachable when feasible[0][0] holds (every cell lies on some
      // complete arrangement), kept as defense in depth.
      return { contradiction: true, states: [...states] };
    } else {
      next[i] = states[i] ?? "unknown";
    }
  }
  return { contradiction: false, states: next };
}

/**
 * Largest supported grid side. The shipped size classes are 5/8/10/15
 * (Sat/Sun cap the ramp at 15); the guard bounds solver CPU/memory against
 * untyped callers rather than encoding a gameplay rule.
 */
const MAX_SOLVE_SIZE = 15;

/**
 * Structural well-formedness of a clue set: integer size within the
 * supported bound, exactly `size` row and column clue lines, every run a
 * positive integer. Feasibility (runs fitting the line) is the solver's
 * job — an infeasible but well-formed clue set is a "contradiction", not
 * a malformed input.
 */
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

/**
 * Full-grid fixpoint (plan §3.2): rows 0..n-1 then columns 0..n-1 per sweep,
 * Gauss–Seidel style (deductions visible immediately within the sweep;
 * deterministic because the order is fixed), with dirty-line skipping. Ends
 * "solved" when no unknowns remain, "stuck" at a fixpoint with unknowns,
 * "contradiction" when some line becomes infeasible.
 *
 * Input contract: `clues` bound total CPU/memory, so the entry throws a
 * typed RangeError on structurally malformed or oversized clue sets
 * (non-integer/out-of-bound size, jagged line counts, non-positive runs).
 * Anything crossing a trust boundary must still be Zod-parsed before it
 * reaches this engine (CLAUDE.md boundary rule).
 */
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

/**
 * Mechanical human-effort proxy (plan §3.2): more propagation sweeps and a
 * thinner first-pass fill both mean more work. Higher = harder.
 */
export function effortScore(result: NonogramSolveResult): number {
  return result.passes + (1 - result.firstPassFill);
}
