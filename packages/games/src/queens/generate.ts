import { createSeededRandom, shuffleInPlace } from "../random";
import type { SeededRandom } from "../random";
import { assertWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { gradeQueens } from "./grade";
import { floodRegion, neighbours } from "./internal";
import { searchQueens } from "./solve";
import { QueensGenerationError } from "./types";
import type { QueensPuzzle } from "./types";
import {
  QUEENS_WEEKDAY_CRITERIA,
  gradeFailures,
  validateQueens,
} from "./validate";

export const QUEENS_MAX_GENERATION_ATTEMPTS = 128;
const MAX_REPAIRS = 64;

function plant(size: number, rng: SeededRandom): number[] {
  const columns: number[] = [];
  const fill = (): boolean => {
    if (columns.length === size) {
      return true;
    }
    const order = Array.from({ length: size }, (_, col) => col);
    shuffleInPlace(order, rng);
    const previous = columns.at(-1);
    for (const col of order) {
      if (
        !columns.includes(col) &&
        (previous === undefined || Math.abs(col - previous) >= 2)
      ) {
        columns.push(col);
        if (fill()) {
          return true;
        }
        columns.pop();
      }
    }
    return false;
  };
  fill();
  return columns.map((col, row) => row * size + col);
}

function adjacentRegions(
  size: number,
  regions: readonly number[],
  cell: number,
): number[] {
  return [
    ...new Set(
      neighbours(size, cell)
        .map((next) => regions[next]!)
        .filter((id) => id >= 0 && id !== regions[cell]),
    ),
  ];
}

function grow(
  size: number,
  queens: readonly number[],
  skew: number,
  rng: SeededRandom,
): number[] {
  const regions = new Array<number>(size * size).fill(-1);
  const frontiers = queens.map((): number[] => []);
  const claim = (cell: number, id: number): void => {
    regions[cell] = id;
    for (const frontier of frontiers) {
      const at = frontier.indexOf(cell);
      if (at >= 0) {
        frontier.splice(at, 1);
      }
    }
    const own = frontiers[id]!;
    for (const next of neighbours(size, cell)) {
      if (regions[next] === -1 && !own.includes(next)) {
        own.push(next);
      }
    }
  };
  queens.forEach((cell, id) => claim(cell, id));
  // Repeated multiplication, not `**`: Math.pow is not correctly rounded on every engine.
  const weights = queens.map(() => {
    const u = 1 - rng.next();
    let weight = 1;
    for (let i = 0; i < skew; i += 1) {
      weight *= u;
    }
    return weight;
  });
  for (let free = size * size - size; free > 0; free -= 1) {
    const growing = frontiers.flatMap((cells, id) =>
      cells.length > 0 ? [id] : [],
    );
    let pick = rng.next() * growing.reduce((sum, id) => sum + weights[id]!, 0);
    const id =
      growing.find((candidate) => (pick -= weights[candidate]!) < 0) ??
      growing.at(-1)!;
    const frontier = frontiers[id]!;
    claim(frontier[rng.nextInt(frontier.length)]!, id);
  }
  return regions;
}

export function repairRegions(
  size: number,
  regions: number[],
  queens: readonly number[],
  rng: SeededRandom,
): boolean {
  for (let moves = 0; ; moves += 1) {
    const other = searchQueens({ size, regions }, 2).find((found) =>
      queens.some((cell) => found[cell] !== 1),
    );
    if (other === undefined) {
      return true;
    }
    const movable = other.flatMap((mark, cell) =>
      mark === 1 &&
      !queens.includes(cell) &&
      adjacentRegions(size, regions, cell).length > 0
        ? [cell]
        : [],
    );
    if (moves === MAX_REPAIRS || movable.length === 0) {
      return false;
    }
    const cell = movable[rng.nextInt(movable.length)]!;
    const targets = adjacentRegions(size, regions, cell);
    const target = targets[rng.nextInt(targets.length)]!;
    const source = regions[cell]!;
    regions[cell] = target;
    // Whatever this cuts off from the source's queen touched `cell`, so it joins `target`: both stay 4-connected.
    const kept = floodRegion(size, regions, queens[source]!);
    regions.forEach((id, index) => {
      if (id === source && !kept.has(index)) {
        regions[index] = target;
      }
    });
  }
}

function relabel(regions: readonly number[]): number[] {
  const order = [...new Set(regions)];
  return regions.map((id) => order.indexOf(id));
}

export function generateQueens(options: {
  seed: number;
  weekday: Weekday;
}): QueensPuzzle {
  const seed = options.seed >>> 0;
  const weekday = assertWeekday(options.weekday);
  const criteria = QUEENS_WEEKDAY_CRITERIA[weekday];
  const { size, skew } = criteria;
  const seedRng = createSeededRandom(seed);
  for (
    let attempt = 1;
    attempt <= QUEENS_MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const rng = createSeededRandom(Math.floor(seedRng.next() * 0x100000000));
    const queens = plant(size, rng);
    const grown = grow(size, queens, skew, rng);
    if (!repairRegions(size, grown, queens, rng)) {
      continue;
    }
    const regions = relabel(grown);
    const grade = gradeQueens({ size, regions });
    if (gradeFailures(grade, criteria).length > 0) {
      continue;
    }
    const puzzle: QueensPuzzle = {
      size,
      seed,
      weekday,
      regions,
      solution: regions.map((_, cell) => (queens.includes(cell) ? 1 : 0)),
      advancedSteps: grade.advancedSteps,
    };
    if (validateQueens(puzzle).ok) {
      return puzzle;
    }
  }
  throw new QueensGenerationError(
    seed,
    weekday,
    QUEENS_MAX_GENERATION_ATTEMPTS,
  );
}
