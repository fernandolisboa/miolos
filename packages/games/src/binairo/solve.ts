import { isValidBinairoSolution } from "./constraints";
import { toSolvedGrid } from "./internal";
import {
  cloneState,
  isComplete,
  place,
  propagate,
  stateFromGrid,
} from "./techniques";
import type { SolverState } from "./techniques";
import type { BinairoGrid, BinairoSolvedGrid, BinairoTier } from "./types";

/**
 * Count solutions under rules 1–4, early-exiting at `limit` (default 2 —
 * enough to decide unsolvable / unique / ambiguous). Propagate-then-branch
 * DFS; propagation runs tier 1 only (plan §3.3 latitude — propagation
 * strength affects speed, never the count), branching is fixed row-major.
 * Grids larger than BINAIRO_SIZE per side throw a RangeError (DFS cost
 * bound); smaller even sizes are accepted for test fixtures.
 */
export function countBinairoSolutions(givens: BinairoGrid, limit = 2): number {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(
      `limit must be a positive integer, got ${String(limit)}`,
    );
  }
  const state = stateFromGrid(givens);
  if (state === null) {
    return 0;
  }
  return countFrom(state, limit);
}

function countFrom(state: SolverState, limit: number): number {
  if (!propagate(state, 1)) {
    return 0;
  }
  const index = state.cells.indexOf(-1);
  if (index === -1) {
    // Defense in depth: re-verify the completed grid against the full
    // ruleset with the independent checker.
    return isValidBinairoSolution(toSolvedGrid(state.cells)) ? 1 : 0;
  }
  let found = 0;
  for (const value of [0, 1] as const) {
    const branch = cloneState(state);
    if (place(branch, index, value)) {
      found += countFrom(branch, limit - found);
      if (found >= limit) {
        return found;
      }
    }
  }
  return found;
}

/**
 * First solution in fixed search order, or null when none exists. Same
 * size contract as countBinairoSolutions: side ≤ BINAIRO_SIZE or
 * RangeError.
 */
export function solveBinairo(givens: BinairoGrid): BinairoSolvedGrid | null {
  const state = stateFromGrid(givens);
  if (state === null) {
    return null;
  }
  return solveFrom(state);
}

function solveFrom(state: SolverState): BinairoSolvedGrid | null {
  if (!propagate(state, 1)) {
    return null;
  }
  const index = state.cells.indexOf(-1);
  if (index === -1) {
    const grid = toSolvedGrid(state.cells);
    return isValidBinairoSolution(grid) ? grid : null;
  }
  for (const value of [0, 1] as const) {
    const branch = cloneState(state);
    if (place(branch, index, value)) {
      const solution = solveFrom(branch);
      if (solution !== null) {
        return solution;
      }
    }
  }
  return null;
}

export interface BinairoGrade {
  readonly solvable: boolean;
  readonly unique: boolean;
  /** 3 = needs guessing; null = unsolvable. */
  readonly requiredTier: BinairoTier | 3 | null;
}

/**
 * Grade a puzzle with the technique-tier instrument (plan §3.4): tier 1 if
 * the tier-1 fixpoint completes the grid, tier 2 if the tier-1+2 fixpoint
 * does, tier 3 otherwise (branching required). Soundness: every technique
 * is a forced deduction under rules 1–4, so a tier-T completion is a proof
 * of tier-T solvability. Same size contract as countBinairoSolutions:
 * side ≤ BINAIRO_SIZE or RangeError.
 */
export function gradeBinairo(givens: BinairoGrid): BinairoGrade {
  const count = countBinairoSolutions(givens, 2);
  if (count === 0) {
    return { solvable: false, unique: false, requiredTier: null };
  }
  const unique = count === 1;
  const tier1State = stateFromGrid(givens);
  if (
    tier1State !== null &&
    propagate(tier1State, 1) &&
    isComplete(tier1State)
  ) {
    return { solvable: true, unique, requiredTier: 1 };
  }
  const tier2State = stateFromGrid(givens);
  if (
    tier2State !== null &&
    propagate(tier2State, 2) &&
    isComplete(tier2State)
  ) {
    return { solvable: true, unique, requiredTier: 2 };
  }
  return { solvable: true, unique, requiredTier: 3 };
}
