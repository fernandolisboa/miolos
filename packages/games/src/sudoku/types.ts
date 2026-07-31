import type { Weekday } from "../weekday";

/** Difficulty tier, 1 (easiest) … 5 (hardest). See the grader ladder in grade.ts. */
export type SudokuTier = 1 | 2 | 3 | 4 | 5;

/**
 * Grade of a puzzle under the technique ladder. "beyond" = has a unique
 * solution reachable only with techniques outside the ladder (guessing);
 * never approved for a daily — every published puzzle is logically solvable.
 */
export type SudokuGrade = SudokuTier | "beyond";

/**
 * Flat row-major 9×9 grid, length 81, index = row * 9 + col.
 * Cell values: 0 = empty, 1–9 = digit. Plain readonly number[] (not a
 * branded type): boundary validation is the consumers' Zod duty; this
 * package validates shape at its own entry points (length 81, ints 0–9).
 */
export type SudokuGrid = readonly number[];

export interface SudokuPuzzle {
  /** Clues: 0 = empty cell to solve. */
  readonly givens: SudokuGrid;
  /**
   * The unique full solution. NOTE (ADR-0004, downstream duty): the engine
   * always carries the solution — the API layer (#23) must never serialize
   * it into a client response for the daily.
   */
  readonly solution: SudokuGrid;
  /** Grade actually achieved; equals the criteria's tier by construction. */
  readonly tier: SudokuTier;
  /** Number of non-zero givens. */
  readonly clueCount: number;
  /** The base seed the puzzle was generated from (provenance/debugging). */
  readonly seed: number;
}

export interface SudokuApprovalCriteria {
  /** gradeSudoku(givens) must equal this exactly. */
  readonly tier: SudokuTier;
  /** Inclusive band on clueCount. */
  readonly minClues: number;
  readonly maxClues: number;
}

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

export type { Weekday };
