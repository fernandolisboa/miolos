// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
import { createSeededRandom } from "../random";
import type { Weekday } from "../weekday";
import { gradeInternal } from "./grade";
import { countSolutionsInternal, fillGrid, shuffleInPlace } from "./solve";
import type {
  SudokuApprovalCriteria,
  SudokuGrid,
  SudokuPuzzle,
  SudokuTier,
} from "./types";
import { sudokuCriteriaForWeekday } from "./criteria";
import { validateCriteria } from "./validate";

/**
 * Default attempt cap. Sized from the measured tier-5 attempt distribution
 * (docs/plans/011 §8.1: p99 = 404 attempts, ~1.2% per-attempt approval);
 * residual cap-hit probability ≈ (1 − 0.012)^1200 ≈ 5e-7 per seed.
 */
export const SUDOKU_MAX_GENERATION_ATTEMPTS = 1200;

/**
 * Thrown when no approved puzzle is found within the attempt cap.
 * Fully deterministic — the same (seed, criteria, maxAttempts) either always
 * returns the same puzzle or always throws with the same fields. With the
 * default cap and the shipped criteria tables this error is practically
 * unreachable (measured: residual risk ≈ 5e-7 per seed for tier 5, lower for
 * the rest); it signals a generation bug or hand-rolled impossible criteria.
 * Pipeline #17 must catch it and alert — never publish a fallback puzzle
 * silently.
 */
export class SudokuGenerationError extends Error {
  /** The normalized (uint32) base seed generation started from. */
  readonly seed: number;
  /** The exact criteria object the caller passed in. */
  readonly criteria: SudokuApprovalCriteria;
  /** Number of attempts consumed (=== the effective maxAttempts). */
  readonly attempts: number;

  constructor(
    seed: number,
    criteria: SudokuApprovalCriteria,
    attempts: number,
  ) {
    super(
      `No approved Sudoku found for seed ${String(seed)} with criteria ` +
        `{ tier: ${String(criteria.tier)}, minClues: ${String(criteria.minClues)}, ` +
        `maxClues: ${String(criteria.maxClues)} } after ${String(attempts)} attempts`,
    );
    this.name = "SudokuGenerationError";
    this.seed = seed;
    this.criteria = criteria;
    this.attempts = attempts;
  }
}

interface GenerationCandidate {
  readonly givens: SudokuGrid;
  readonly solution: SudokuGrid;
  readonly tier: SudokuTier;
  readonly clueCount: number;
}

/**
 * One generation attempt (docs/plans/011 §3.3): randomized full-grid fill,
 * then single-pass grade-capped clue removal over a shuffled cell order.
 * A clue is removed only if the puzzle stays unique (counter early-exits
 * at 2) and its grade stays within the target tier — uniqueness and
 * ladder-solvability hold by construction. Returns null when the attempt
 * stalls below the target tier or outside the clue band.
 */
function tryGenerate(
  attemptSeed: number,
  criteria: SudokuApprovalCriteria,
): GenerationCandidate | null {
  const rng = createSeededRandom(attemptSeed);
  const solution = fillGrid(rng);
  const order = Array.from({ length: 81 }, (_, i) => i);
  shuffleInPlace(order, rng);
  const grid = [...solution];
  let clues = 81;
  for (const idx of order) {
    if (clues === criteria.minClues) {
      break;
    }
    const removed = grid[idx]!;
    grid[idx] = 0;
    if (countSolutionsInternal(grid, 2) > 1) {
      grid[idx] = removed;
      continue;
    }
    const grade = gradeInternal(grid).grade;
    if (grade === "beyond" || grade > criteria.tier) {
      grid[idx] = removed;
      continue;
    }
    clues -= 1;
  }
  const finalGrade = gradeInternal(grid).grade;
  if (finalGrade !== criteria.tier) {
    return null;
  }
  if (clues < criteria.minClues || clues > criteria.maxClues) {
    return null;
  }
  return {
    givens: Object.freeze(grid),
    solution: Object.freeze(solution),
    tier: finalGrade,
    clueCount: clues,
  };
}

/**
 * Deterministic: same (seed, criteria, maxAttempts) ⇒ deep-equal puzzle,
 * always — including across rejected attempts (each attempt draws exactly
 * one uint32 from the master stream regardless of why it failed). seed is
 * coerced uint32 like createSeededRandom (>>> 0). Throws
 * SudokuGenerationError when maxAttempts (default
 * SUDOKU_MAX_GENERATION_ATTEMPTS = 1200) attempts all fail approval.
 *
 * `maxAttempts` and the criteria bound total CPU (each attempt is a full
 * grid fill + repeated counting + grading): never derive them from
 * untrusted input — near-impossible-but-valid criteria under a huge cap is
 * an arbitrarily long synchronous loop (same duty as the Binairo grid-size
 * bound; downstream note for #23/#17).
 */
export function generateSudoku(options: {
  readonly seed: number;
  readonly criteria: SudokuApprovalCriteria;
  readonly maxAttempts?: number;
}): SudokuPuzzle {
  const { criteria } = options;
  validateCriteria(criteria);
  const maxAttempts = options.maxAttempts ?? SUDOKU_MAX_GENERATION_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      `maxAttempts must be a positive integer, got ${String(maxAttempts)}`,
    );
  }
  const normalizedSeed = options.seed >>> 0;
  const master = createSeededRandom(normalizedSeed);
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    // Exact uint32 draw (splitmix32 next() * 2^32 is integral).
    const attemptSeed = master.nextInt(0x1_0000_0000);
    const candidate = tryGenerate(attemptSeed, criteria);
    if (candidate !== null) {
      return Object.freeze({ ...candidate, seed: normalizedSeed });
    }
  }
  throw new SudokuGenerationError(normalizedSeed, criteria, maxAttempts);
}

/**
 * Convenience: generateSudoku with sudokuCriteriaForWeekday(weekday) —
 * the semantic twin of generateBinairo({ seed, weekday }). maxAttempts
 * threads through so the attempt cap is reachable from this API too.
 */
export function generateDailySudoku(options: {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly maxAttempts?: number;
}): SudokuPuzzle {
  return generateSudoku({
    seed: options.seed,
    criteria: sudokuCriteriaForWeekday(options.weekday),
    ...(options.maxAttempts !== undefined
      ? { maxAttempts: options.maxAttempts }
      : {}),
  });
}
