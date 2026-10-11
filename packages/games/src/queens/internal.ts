import { QUEENS_SIZES } from "./types";
import type { QueensBoard, QueensGrid } from "./types";

const MAX_SIZE = Math.max(...QUEENS_SIZES);

export interface Geometry {
  readonly size: number;
  readonly regionOf: readonly number[];
  readonly rows: readonly (readonly number[])[];
  readonly cols: readonly (readonly number[])[];
  readonly regions: readonly (readonly number[])[];
  readonly units: readonly (readonly number[])[];
}

export function checkBoard({ size, regions }: QueensBoard): void {
  if (!Number.isInteger(size) || size < 4 || size > MAX_SIZE) {
    throw new RangeError(
      `size must be an integer in 4..${MAX_SIZE}, got ${String(size)}`,
    );
  }
  if (regions.length !== size * size) {
    throw new RangeError(
      `regions must hold ${size * size} cells, got ${regions.length}`,
    );
  }
  if (!regions.every((id) => Number.isInteger(id) && id >= 0 && id < size)) {
    throw new RangeError(`region ids must be integers in 0..${size - 1}`);
  }
}

export function checkGrid(size: number, grid: QueensGrid): void {
  if (
    grid.length !== size * size ||
    !grid.every((cell) => cell === 0 || cell === 1)
  ) {
    throw new RangeError(
      `a queens grid must hold ${size * size} cells of 0 or 1`,
    );
  }
}

export function geometryOf(board: QueensBoard): Geometry {
  checkBoard(board);
  const { size } = board;
  const rows = Array.from({ length: size }, (): number[] => []);
  const cols = Array.from({ length: size }, (): number[] => []);
  const regions = Array.from({ length: size }, (): number[] => []);
  for (let cell = 0; cell < size * size; cell += 1) {
    rows[Math.floor(cell / size)]!.push(cell);
    cols[cell % size]!.push(cell);
    regions[board.regions[cell]!]!.push(cell);
  }
  return {
    size,
    regionOf: board.regions,
    rows,
    cols,
    regions,
    units: [...rows, ...cols, ...regions],
  };
}

export function attacks(geometry: Geometry, a: number, b: number): boolean {
  const { size, regionOf } = geometry;
  const rowGap = Math.abs(Math.floor(a / size) - Math.floor(b / size));
  const colGap = Math.abs((a % size) - (b % size));
  return (
    a !== b &&
    (rowGap === 0 ||
      colGap === 0 ||
      regionOf[a] === regionOf[b] ||
      (rowGap === 1 && colGap === 1))
  );
}

export function neighbours(size: number, cell: number): number[] {
  const row = Math.floor(cell / size);
  const col = cell % size;
  const near: number[] = [];
  if (row > 0) near.push(cell - size);
  if (col > 0) near.push(cell - 1);
  if (col < size - 1) near.push(cell + 1);
  if (row < size - 1) near.push(cell + size);
  return near;
}

export function floodRegion(
  size: number,
  regions: readonly number[],
  start: number,
): Set<number> {
  const reached = new Set([start]);
  const stack = [start];
  for (let cell = stack.pop(); cell !== undefined; cell = stack.pop()) {
    for (const next of neighbours(size, cell)) {
      if (regions[next] === regions[start] && !reached.has(next)) {
        reached.add(next);
        stack.push(next);
      }
    }
  }
  return reached;
}
