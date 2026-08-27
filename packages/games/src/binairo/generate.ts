import { createSeededRandom } from "../random";
import type { SeededRandom } from "../random";
import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { seededPermutation, toSolvedGrid } from "./internal";
import { countBinairoSolutions } from "./solve";
import { emptyState, place, unplace } from "./techniques";
import type { SolverState } from "./techniques";
import { BINAIRO_SIZE } from "./types";
import type { BinairoCell, BinairoPuzzle, BinairoSolvedGrid } from "./types";
import { BINAIRO_WEEKDAY_CRITERIA, validateBinairo } from "./validate";

export const BINAIRO_MAX_GENERATION_ATTEMPTS = 64;

export class BinairoGenerationError extends Error {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly attempts: number;

  constructor(seed: number, weekday: Weekday, attempts: number) {
    super(
      `Binairo generation exhausted ${attempts} attempts for seed ${seed}, weekday ${weekday}`,
    );
    this.name = "BinairoGenerationError";
    this.seed = seed;
    this.weekday = weekday;
    this.attempts = attempts;
  }
}

function buildSolvedGrid(rng: SeededRandom): BinairoSolvedGrid {
  const state = emptyState(BINAIRO_SIZE);
  if (!fillFrom(state, 0, rng)) {
    throw new RangeError("unreachable: full-grid construction failed");
  }
  return toSolvedGrid(state.cells);
}

function fillFrom(
  state: SolverState,
  index: number,
  rng: SeededRandom,
): boolean {
  if (index === state.cells.length) {
    return true;
  }

  const first: 0 | 1 = rng.nextInt(2) === 0 ? 0 : 1;
  const second: 0 | 1 = first === 0 ? 1 : 0;
  for (const value of [first, second]) {
    if (place(state, index, value)) {
      if (fillFrom(state, index + 1, rng)) {
        return true;
      }
      unplace(state, index);
    }
  }
  return false;
}

export function generateBinairo(options: {
  seed: number;
  weekday: Weekday;
}): BinairoPuzzle {
  const seed = options.seed >>> 0;
  const { weekday } = options;
  if (!isWeekday(weekday)) {
    throw new RangeError(
      `weekday must be an integer in 1..7 (ISO 8601), got ${String(weekday)}`,
    );
  }
  const criteria = BINAIRO_WEEKDAY_CRITERIA[weekday];
  const seedRng = createSeededRandom(seed);
  const cellCount = BINAIRO_SIZE * BINAIRO_SIZE;

  for (
    let attempt = 1;
    attempt <= BINAIRO_MAX_GENERATION_ATTEMPTS;
    attempt += 1
  ) {
    const subSeed = Math.floor(seedRng.next() * 0x100000000);
    const rng = createSeededRandom(subSeed);

    const solution = buildSolvedGrid(rng);
    const spread = criteria.maxGivens - criteria.minGivens + 1;
    const target = criteria.minGivens + rng.nextInt(spread);
    const order = seededPermutation(cellCount, rng);

    const givens: BinairoCell[] = [...solution];
    let givensCount = cellCount;
    for (const index of order) {
      if (givensCount <= target) {
        break;
      }
      const previous = givens[index];
      if (previous === null || previous === undefined) {
        continue;
      }
      givens[index] = null;
      if (countBinairoSolutions(givens, 2) > 1) {
        givens[index] = previous;
      } else {
        givensCount -= 1;
      }
    }

    const verdict = validateBinairo({ givens, solution }, weekday);
    if (verdict.approved) {
      return {
        size: BINAIRO_SIZE,
        seed,
        weekday,
        givens,
        solution,
        givensCount: verdict.givensCount,
        requiredTier: verdict.requiredTier,
      };
    }
  }

  throw new BinairoGenerationError(
    seed,
    weekday,
    BINAIRO_MAX_GENERATION_ATTEMPTS,
  );
}
