import type { Weekday } from "../weekday";

/** Daily Binairo grid side length — fixed 8×8 (design brief line 85). */
export const BINAIRO_SIZE = 8;

/** A single cell: 0, 1, or null when empty. */
export type BinairoCell = 0 | 1 | null;

/** Row-major partial grid; length 64 for the daily 8×8. */
export type BinairoGrid = readonly BinairoCell[];

/** Row-major complete grid. */
export type BinairoSolvedGrid = readonly (0 | 1)[];

/**
 * Solving-technique tiers (see techniques.ts). Tier 3 = guessing, never
 * approved for a daily puzzle.
 */
export type BinairoTier = 1 | 2;

/**
 * A generated daily puzzle. `givens` is shippable to the client;
 * `solution` is server-side only (ADR-0004) — callers ship givens without
 * the solution by destructuring, the sibling fields make the separation
 * structural.
 */
export interface BinairoPuzzle {
  readonly size: typeof BINAIRO_SIZE;
  /** Normalized uint32 (input seed >>> 0). */
  readonly seed: number;
  readonly weekday: Weekday;
  /** Shippable to the client (ADR-0004). */
  readonly givens: BinairoGrid;
  /** Server-side only — callers must not ship it (ADR-0004). */
  readonly solution: BinairoSolvedGrid;
  readonly givensCount: number;
  /** Hardest technique tier the puzzle requires. */
  readonly requiredTier: BinairoTier;
}
