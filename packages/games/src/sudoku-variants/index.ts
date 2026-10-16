import { createSeededRandom, shuffleInPlace } from "../random";
import type { SeededRandom } from "../random";
import type { Weekday } from "../weekday";
import { CLASSIC_LAYOUT, POPCOUNT, geometryFor } from "../sudoku/board";
import type { SudokuGeometry } from "../sudoku/board";
import { sudokuCriteriaForWeekday } from "../sudoku/criteria";
import {
  SudokuGenerationError,
  attemptsOf,
  carve,
  generateDailySudoku,
} from "../sudoku/generate";
import { masksFor, takenAt, toggle } from "../sudoku/solve";
import { SUDOKU_VARIANTS } from "../sudoku/types";
import type {
  SudokuLayout,
  SudokuVariant,
  SudokuVariantPuzzle,
} from "../sudoku/types";
import { drawIrregularLayout } from "./irregular";

export { assertSudokuLayout } from "../sudoku/board";

const FILL_BUDGET = 1000;

const FAILURES_PER_MAP = 8;

export const DIAGONAL_LAYOUT: SudokuLayout = Object.freeze({
  regions: CLASSIC_LAYOUT.regions,
  extraUnits: Object.freeze([
    Object.freeze(Array.from({ length: 9 }, (_, k) => k * 10)),
    Object.freeze(Array.from({ length: 9 }, (_, k) => (k + 1) * 8)),
  ]),
});

// see ADR-0130 decision 2
export function fillVariant(
  geometry: SudokuGeometry,
  rng: SeededRandom,
  budget: number,
): number[] | null {
  const { units, regionOf } = geometry;
  const grid = new Array<number>(81).fill(0);
  const masks = masksFor(geometry);
  const free = new Array<number>(81).fill(0);
  const places = new Array<number>(9).fill(0);
  let nodes = budget;

  const movesAt = (): (readonly [number, number])[] | "solved" | "dead" => {
    let best = -1;
    let fewest = 10;
    for (let i = 0; i < 81; i += 1) {
      free[i] = grid[i]! === 0 ? ~takenAt(masks, regionOf, i) & 0x1ff : 0;
      const count = POPCOUNT[free[i]!]!;
      if (grid[i]! === 0 && count < fewest) {
        fewest = count;
        best = i;
      }
    }
    if (best === -1) {
      return "solved";
    }
    if (fewest === 0) {
      return "dead";
    }
    let scarceUnit = -1;
    let scarceBit = 0;
    for (let u = 0; u < units.length && fewest > 1; u += 1) {
      places.fill(0);
      let placed = 0;
      for (const i of units[u]!) {
        placed |= grid[i]! === 0 ? 0 : 1 << (grid[i]! - 1);
        for (let m = free[i]!; m !== 0; m &= m - 1) {
          const d = 31 - Math.clz32(m & -m);
          places[d] = places[d]! + 1;
        }
      }
      for (let m = ~placed & 0x1ff; m !== 0; m &= m - 1) {
        const d = 31 - Math.clz32(m & -m);
        if (places[d]! === 0) {
          return "dead";
        }
        if (places[d]! < fewest) {
          fewest = places[d]!;
          scarceUnit = u;
          scarceBit = 1 << d;
        }
      }
    }
    const moves: (readonly [number, number])[] = [];
    if (scarceUnit === -1) {
      for (let m = free[best]!; m !== 0; m &= m - 1) {
        moves.push([best, m & -m]);
      }
    } else {
      for (const i of units[scarceUnit]!) {
        if ((free[i]! & scarceBit) !== 0) {
          moves.push([i, scarceBit]);
        }
      }
    }
    shuffleInPlace(moves, rng);
    return moves;
  };

  const recurse = (): boolean => {
    if ((nodes -= 1) < 0) {
      return false;
    }
    const moves = movesAt();
    if (moves === "dead") {
      return false;
    }
    if (moves === "solved") {
      return true;
    }
    for (const [cell, bit] of moves) {
      grid[cell] = 32 - Math.clz32(bit);
      toggle(masks, regionOf, cell, bit);
      if (recurse()) {
        return true;
      }
      grid[cell] = 0;
      toggle(masks, regionOf, cell, bit);
      if (nodes < 0) {
        return false;
      }
    }
    return false;
  };

  return recurse() ? grid : null;
}

export function generateSudokuVariant(options: {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly variant: SudokuVariant;
  readonly maxAttempts?: number;
}): SudokuVariantPuzzle {
  const { variant } = options;
  if (!(SUDOKU_VARIANTS as readonly string[]).includes(variant)) {
    throw new RangeError(
      `variant must be one of ${SUDOKU_VARIANTS.join(", ")}, got ${String(variant)}`,
    );
  }
  if (variant === "classic") {
    return Object.freeze({
      ...generateDailySudoku(options),
      layout: CLASSIC_LAYOUT,
    });
  }
  const criteria = sudokuCriteriaForWeekday(options.weekday);
  const maxAttempts = attemptsOf(options.maxAttempts);
  const normalizedSeed = options.seed >>> 0;
  const master = createSeededRandom(normalizedSeed);
  let layout =
    variant === "diagonal" ? DIAGONAL_LAYOUT : drawIrregularLayout(master);
  let geometry = geometryFor(layout);
  let failures = 0;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const rng = createSeededRandom(master.nextInt(0x1_0000_0000));
    const solution = fillVariant(geometry, rng, FILL_BUDGET);
    const candidate =
      solution === null ? null : carve(solution, rng, criteria, geometry);
    if (candidate !== null) {
      return Object.freeze({ ...candidate, seed: normalizedSeed, layout });
    }
    failures += 1;
    if (
      variant === "irregular" &&
      (solution === null || failures === FAILURES_PER_MAP)
    ) {
      layout = drawIrregularLayout(master);
      geometry = geometryFor(layout);
      failures = 0;
    }
  }
  throw new SudokuGenerationError(normalizedSeed, criteria, maxAttempts);
}
