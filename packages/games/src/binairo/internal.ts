import type { SeededRandom } from "../random";
import { BINAIRO_SIZE } from "./types";
import type { BinairoGrid, BinairoSolvedGrid } from "./types";

export type CellState = -1 | 0 | 1;

export function cellAt(cells: readonly CellState[], index: number): CellState {
  const value = cells[index];
  if (value === undefined) {
    throw new RangeError(`cell index out of range: ${index}`);
  }
  return value;
}

export function setCellAt(
  cells: CellState[],
  index: number,
  value: CellState,
): void {
  if (index < 0 || index >= cells.length) {
    throw new RangeError(`cell index out of range: ${index}`);
  }
  cells[index] = value;
}

export function intAt(values: readonly number[], index: number): number {
  const value = values[index];
  if (value === undefined) {
    throw new RangeError(`index out of range: ${index}`);
  }
  return value;
}

export function sideLength(cellCount: number): number {
  const n = Math.sqrt(cellCount);
  if (!Number.isInteger(n) || n === 0 || n % 2 !== 0) {
    throw new RangeError(
      `grid must be square with an even side, got ${cellCount} cells`,
    );
  }
  if (n > BINAIRO_SIZE) {
    throw new RangeError(`grid side must be at most ${BINAIRO_SIZE}, got ${n}`);
  }
  return n;
}

export function toCellStates(grid: BinairoGrid): CellState[] {
  return grid.map((cell) => (cell === null ? -1 : cell));
}

export function toSolvedGrid(cells: readonly CellState[]): BinairoSolvedGrid {
  return cells.map((cell): 0 | 1 => {
    if (cell === -1) {
      throw new RangeError("grid is not complete");
    }
    return cell;
  });
}

export function seededPermutation(length: number, rng: SeededRandom): number[] {
  const values = Array.from({ length }, (_, i) => i);
  for (let i = length - 1; i > 0; i -= 1) {
    const j = rng.nextInt(i + 1);
    const a = intAt(values, i);
    const b = intAt(values, j);
    values[i] = b;
    values[j] = a;
  }
  return values;
}
