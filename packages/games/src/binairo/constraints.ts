import { cellAt, sideLength, toCellStates } from "./internal";
import type { CellState } from "./internal";
import type { BinairoGrid, BinairoSolvedGrid } from "./types";

/**
 * A rule violation in a (possibly partial) grid — the #18 local-validation
 * affordance (ADR-0004: local validation is a responsiveness affordance,
 * never a source of truth).
 */
export interface BinairoViolation {
  readonly rule: "run" | "balance" | "duplicate-line";
  /** Row-major indices involved. */
  readonly cells: readonly number[];
}

/** Row-major indices of a line: rows first (isRow), then columns. */
function lineIndices(n: number, isRow: boolean, line: number): number[] {
  const indices: number[] = [];
  for (let i = 0; i < n; i += 1) {
    indices.push(isRow ? line * n + i : i * n + line);
  }
  return indices;
}

/**
 * All rule violations in a partial grid. Empty cells never violate;
 * a complete grid with no violations satisfies rules 2–4.
 */
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
      // Rule 2 — no run of three identical digits.
      for (let start = 0; start + 2 < n; start += 1) {
        const window = indices.slice(start, start + 3);
        const values = window.map((index) => cellAt(cells, index));
        const first = values[0];
        if (
          first !== undefined &&
          first !== -1 &&
          values.every((value) => value === first)
        ) {
          violations.push({ rule: "run", cells: window });
        }
      }
      // Rule 3 — at most n/2 of each digit (exactly n/2 once complete).
      for (const digit of [0, 1] as const) {
        const holders = indices.filter(
          (index) => cellAt(cells, index) === digit,
        );
        if (holders.length > half) {
          violations.push({ rule: "balance", cells: holders });
        }
      }
    }
    // Rule 4 — no two identical complete parallel lines.
    const complete: { line: number; indices: number[]; values: CellState[] }[] =
      [];
    for (let line = 0; line < n; line += 1) {
      const indices = lineIndices(n, isRow, line);
      const values = indices.map((index) => cellAt(cells, index));
      if (values.every((value) => value !== -1)) {
        complete.push({ line, indices, values });
      }
    }
    for (let i = 0; i < complete.length; i += 1) {
      for (let j = i + 1; j < complete.length; j += 1) {
        const a = complete[i];
        const b = complete[j];
        if (
          a !== undefined &&
          b !== undefined &&
          a.values.every((value, k) => value === b.values[k])
        ) {
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

/** Rules 2 + 3 + 4 on a complete grid. */
export function isValidBinairoSolution(grid: BinairoSolvedGrid): boolean {
  return findBinairoViolations(grid).length === 0;
}
