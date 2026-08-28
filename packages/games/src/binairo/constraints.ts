import { cellAt, intAt, sideLength, toCellStates } from "./internal";
import type { CellState } from "./internal";
import type { BinairoGrid, BinairoSolvedGrid } from "./types";

export interface BinairoViolation {
  readonly rule: "run" | "balance" | "duplicate-line";

  readonly cells: readonly number[];
}

function lineIndices(n: number, isRow: boolean, line: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < n; i += 1) {
    indices.push(isRow ? line * n + i : i * n + line);
  }
  return indices;
}

export function findBinairoViolations(
  grid: BinairoGrid,
): readonly BinairoViolation[] {
  const n = sideLength(grid.length);
  const half = n / 2;
  const cells = toCellStates(grid);
  const violations: BinairoViolation[] = [];

  for (const isRow of [true, false]) {
    for (let line = 0; line < n; line += 1) {
      const indices = lineIndices(n, isRow, line);

      for (let start = 0; start + 2 < n; start += 1) {
        const window = indices.slice(start, start + 3);
        const first = cellAt(cells, intAt(window, 0));
        if (
          first !== -1 &&
          window.every((index) => cellAt(cells, index) === first)
        ) {
          violations.push({ rule: "run", cells: window });
        }
      }

      for (const digit of [0, 1] as const) {
        const holders = indices.filter(
          (index) => cellAt(cells, index) === digit,
        );
        if (holders.length > half) {
          violations.push({ rule: "balance", cells: holders });
        }
      }
    }

    const complete: { line: number; indices: number[]; values: CellState[] }[] =
      [];
    for (let line = 0; line < n; line += 1) {
      const indices = lineIndices(n, isRow, line);
      const values = indices.map((index) => cellAt(cells, index));
      if (values.every((value) => value !== -1)) {
        complete.push({ line, indices, values });
      }
    }
    for (const [i, a] of complete.entries()) {
      for (const b of complete.slice(i + 1)) {
        if (a.values.every((value, k) => value === b.values[k])) {
          violations.push({
            rule: "duplicate-line",
            cells: [...a.indices, ...b.indices],
          });
        }
      }
    }
  }
  return violations;
}

export function isValidBinairoSolution(grid: BinairoSolvedGrid): boolean {
  return findBinairoViolations(grid).length === 0;
}
