import { createSeededRandom } from "../../src/index";
import type { QueensBoard, QueensGrid } from "../../src/queens/index";

function rowsOf(spec: string): string[] {
  return spec.split(/\s+/).filter((row) => row.length > 0);
}

export function board(spec: string): QueensBoard {
  const rows = rowsOf(spec);
  return {
    size: rows.length,
    regions: rows.flatMap((row) => [...row].map(Number)),
  };
}

export function queens(spec: string): QueensGrid {
  return rowsOf(spec).flatMap((row) =>
    [...row].map((ch): 0 | 1 => (ch === "Q" ? 1 : 0)),
  );
}

function permutationIsSolution(
  { size, regions }: QueensBoard,
  columns: readonly number[],
): boolean {
  const seen = new Set<number>();
  for (let row = 0; row < size; row += 1) {
    const col = columns[row]!;
    if (row > 0 && Math.abs(col - columns[row - 1]!) < 2) {
      return false;
    }
    seen.add(regions[row * size + col]!);
  }
  return seen.size === size;
}

export function instrumentSolutions(target: QueensBoard): QueensGrid[] {
  const { size } = target;
  const found: QueensGrid[] = [];
  const columns: number[] = [];
  const used = new Array<boolean>(size).fill(false);
  const visit = (): void => {
    if (columns.length === size) {
      if (permutationIsSolution(target, columns)) {
        const grid = new Array<0 | 1>(size * size).fill(0);
        columns.forEach((col, row) => (grid[row * size + col] = 1));
        found.push(grid);
      }
      return;
    }
    for (let col = 0; col < size; col += 1) {
      if (!used[col]) {
        used[col] = true;
        columns.push(col);
        visit();
        columns.pop();
        used[col] = false;
      }
    }
  };
  visit();
  return found;
}

export function isContiguous({ size, regions }: QueensBoard): boolean {
  const ids = new Set(regions);
  for (const id of ids) {
    const start = regions.indexOf(id);
    const reached = new Set([start]);
    const queue = [start];
    for (let cell = queue.pop(); cell !== undefined; cell = queue.pop()) {
      const row = Math.floor(cell / size);
      const col = cell % size;
      const near = [
        row > 0 ? cell - size : -1,
        row < size - 1 ? cell + size : -1,
        col > 0 ? cell - 1 : -1,
        col < size - 1 ? cell + 1 : -1,
      ];
      for (const next of near) {
        if (next >= 0 && regions[next] === id && !reached.has(next)) {
          reached.add(next);
          queue.push(next);
        }
      }
    }
    if (reached.size !== regions.filter((r) => r === id).length) {
      return false;
    }
  }
  return true;
}

export function isCanonical({ regions }: QueensBoard): boolean {
  const order = [...new Set(regions)];
  return order.every((id, index) => id === index);
}

export function randomContiguousMap(size: number, seed: number): QueensBoard {
  const rng = createSeededRandom(seed);
  const regions = new Array<number>(size * size).fill(-1);
  for (let id = 0; id < size;) {
    const cell = rng.nextInt(size * size);
    if (regions[cell] === -1) {
      regions[cell] = id;
      id += 1;
    }
  }
  while (regions.includes(-1)) {
    const cell = rng.nextInt(size * size);
    const near = [cell - size, cell + size]
      .concat(cell % size > 0 ? [cell - 1] : [])
      .concat(cell % size < size - 1 ? [cell + 1] : [])
      .filter((next) => (regions[next] ?? -1) >= 0);
    if (regions[cell] === -1 && near.length > 0) {
      regions[cell] = regions[near[rng.nextInt(near.length)]!]!;
    }
  }
  return { size, regions };
}
