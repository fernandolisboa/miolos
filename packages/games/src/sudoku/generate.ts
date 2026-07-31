// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
import { createSeededRandom } from "../random";
import type { Weekday } from "../weekday";
import { assertSudokuGrid, isSudokuSolved } from "./board";
import { gradeInternal, gradeSudoku } from "./grade";
import { countSolutionsInternal, fillGrid, shuffleInPlace } from "./solve";
import {
  SudokuGenerationError,
  type SudokuApprovalCriteria,
  type SudokuGrid,
  type SudokuPuzzle,
  type SudokuTier,
} from "./types";
import { sudokuCriteriaForWeekday } from "./criteria";

/**
 * Default attempt cap. Sized from the measured tier-5 attempt distribution
 * (docs/plans/011 §8.1: p99 = 404 attempts, ~1.2% per-attempt approval);
 * residual cap-hit probability ≈ (1 − 0.012)^1200 ≈ 5e-7 per seed.
 */
export const SUDOKU_MAX_GENERATION_ATTEMPTS = 1200;

interface GenerationCandidate {
  readonly givens: SudokuGrid;
  readonly solution: SudokuGrid;
  readonly tier: SudokuTier;
  readonly clueCount: number;
}

function validateCriteria(criteria: SudokuApprovalCriteria): void {
  if (
    !Number.isInteger(criteria.tier) ||
    criteria.tier < 1 ||
    criteria.tier > 5
  ) {
    throw new RangeError(
      `criteria.tier must be an integer 1-5, got ${String(criteria.tier)}`,
    );
  }
  if (
    !Number.isInteger(criteria.minClues) ||
    !Number.isInteger(criteria.maxClues) ||
    criteria.minClues < 17 ||
    criteria.minClues > criteria.maxClues ||
    criteria.maxClues > 81
  ) {
    throw new RangeError(
      `criteria clue band must satisfy 17 <= minClues <= maxClues <= 81, ` +
        `got minClues ${String(criteria.minClues)}, maxClues ${String(criteria.maxClues)}`,
    );
  }
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
 * SudokuGenerationError when options.maxAttempts (default
 * SUDOKU_MAX_GENERATION_ATTEMPTS = 1200) attempts all fail approval.
 */
export function generateSudoku(
  seed: number,
  criteria: SudokuApprovalCriteria,
  options?: { readonly maxAttempts?: number },
): SudokuPuzzle {
  validateCriteria(criteria);
  const maxAttempts = options?.maxAttempts ?? SUDOKU_MAX_GENERATION_ATTEMPTS;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
    throw new RangeError(
      `maxAttempts must be a positive integer, got ${String(maxAttempts)}`,
    );
  }
  const normalizedSeed = seed >>> 0;
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
 * Convenience: generateSudoku(seed, sudokuCriteriaForWeekday(weekday),
 * options). options threads through so the attempt cap is reachable and
 * adjustable from this API too.
 */
export function generateDailySudoku(
  seed: number,
  weekday: Weekday,
  options?: { readonly maxAttempts?: number },
): SudokuPuzzle {
  return generateSudoku(seed, sudokuCriteriaForWeekday(weekday), options);
}

/**
 * The pipeline's independent verification hook — distrusts its caller.
 * True iff ALL of: gradeSudoku(puzzle.givens) === criteria.tier;
 * minClues <= clueCount <= maxClues with clueCount matching the actual
 * non-zero count; countSudokuSolutions(givens, 2) === 1; every non-zero
 * given equals the corresponding solution cell; isSudokuSolved(solution).
 * Cost is µs–low-ms — cheap enough for #17 to run on every candidate.
 */
export function isSudokuApproved(
  puzzle: SudokuPuzzle,
  criteria: SudokuApprovalCriteria,
): boolean {
  validateCriteria(criteria);
  assertSudokuGrid(puzzle.givens);
  assertSudokuGrid(puzzle.solution);
  let actualClueCount = 0;
  for (let i = 0; i < 81; i += 1) {
    const given = puzzle.givens[i]!;
    if (given !== 0) {
      actualClueCount += 1;
      if (given !== puzzle.solution[i]!) {
        return false;
      }
    }
  }
  if (puzzle.clueCount !== actualClueCount) {
    return false;
  }
  if (
    actualClueCount < criteria.minClues ||
    actualClueCount > criteria.maxClues
  ) {
    return false;
  }
  if (!isSudokuSolved(puzzle.solution)) {
    return false;
  }
  if (countSolutionsInternal(puzzle.givens, 2) !== 1) {
    return false;
  }
  return gradeSudoku(puzzle.givens) === criteria.tier;
}
