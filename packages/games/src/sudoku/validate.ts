// index reads use `!`: every index is produced by loops over [0, 81) / [0, 9);
// public entry points reject grids of the wrong length (assertSudokuGrid).
import { assertSudokuGrid, isSudokuSolved } from "./board";
import { gradeSudoku } from "./grade";
import { countSolutionsInternal } from "./solve";
import type { SudokuApprovalCriteria, SudokuPuzzle, SudokuTier } from "./types";

/**
 * Criteria sanity guard, shared by generation and validation. Throws
 * RangeError on out-of-domain criteria — a caller bug, not a candidate
 * rejection (mirrors validateBinairo throwing on a bad weekday).
 */
export function validateCriteria(criteria: SudokuApprovalCriteria): void {
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
 * Why a candidate was rejected. The union mirrors BinairoRejectionReason so
 * alerting can use the same taxonomy across engines; the Sudoku-specific
 * members reflect its exact-tier + clue-band semantics and the
 * self-describing fields (`tier`, `clueCount`) a SudokuPuzzle carries.
 */
export type SudokuRejectionReason =
  | "malformed-grid"
  | "solution-invalid"
  | "givens-contradict-solution"
  | "unsolvable"
  | "not-unique"
  | "too-hard"
  | "too-easy"
  | "tier-mismatch"
  | "clue-count-mismatch"
  | "too-few-clues"
  | "too-many-clues";

export type SudokuValidationResult =
  | {
      readonly approved: true;
      readonly tier: SudokuTier;
      readonly clueCount: number;
    }
  | {
      readonly approved: false;
      readonly reasons: readonly SudokuRejectionReason[];
    };

function isWellFormedGrid(grid: SudokuPuzzle["givens"]): boolean {
  try {
    assertSudokuGrid(grid);
    return true;
  } catch {
    return false;
  }
}

/**
 * The approval gate — distrusts its caller and collects every applicable
 * rejection reason (shape of validateBinairo). Approves only when ALL
 * hold: gradeSudoku(givens) === criteria.tier ("too-easy" / "too-hard"
 * otherwise, "beyond"-ladder grids are "too-hard"); countSudokuSolutions(
 * givens, 2) === 1 ("unsolvable" / "not-unique"); every non-zero given
 * equals the corresponding solution cell; isSudokuSolved(solution); the
 * declared `tier` and `clueCount` fields match reality; clueCount inside
 * the criteria band. Throws RangeError on out-of-domain criteria (a
 * caller bug, not a rejection).
 */
export function validateSudoku(
  candidate: Pick<SudokuPuzzle, "givens" | "solution" | "tier" | "clueCount">,
  criteria: SudokuApprovalCriteria,
): SudokuValidationResult {
  validateCriteria(criteria);
  if (
    !isWellFormedGrid(candidate.givens) ||
    !isWellFormedGrid(candidate.solution)
  ) {
    return { approved: false, reasons: ["malformed-grid"] };
  }

  const reasons: SudokuRejectionReason[] = [];

  if (!isSudokuSolved(candidate.solution)) {
    reasons.push("solution-invalid");
  }
  let actualClueCount = 0;
  let contradictsSolution = false;
  for (let i = 0; i < 81; i += 1) {
    const given = candidate.givens[i]!;
    if (given !== 0) {
      actualClueCount += 1;
      if (given !== candidate.solution[i]!) {
        contradictsSolution = true;
      }
    }
  }
  if (contradictsSolution) {
    reasons.push("givens-contradict-solution");
  }

  const solutionCount = countSolutionsInternal(candidate.givens, 2);
  if (solutionCount === 0) {
    reasons.push("unsolvable");
  } else if (solutionCount > 1) {
    reasons.push("not-unique");
  }

  const grade = gradeSudoku(candidate.givens);
  if (grade === "beyond" || grade > criteria.tier) {
    reasons.push("too-hard");
  } else if (grade < criteria.tier) {
    reasons.push("too-easy");
  }
  if (candidate.tier !== criteria.tier) {
    reasons.push("tier-mismatch");
  }

  if (candidate.clueCount !== actualClueCount) {
    reasons.push("clue-count-mismatch");
  }
  if (actualClueCount < criteria.minClues) {
    reasons.push("too-few-clues");
  }
  if (actualClueCount > criteria.maxClues) {
    reasons.push("too-many-clues");
  }

  if (reasons.length > 0) {
    return { approved: false, reasons };
  }
  return { approved: true, tier: criteria.tier, clueCount: actualClueCount };
}
