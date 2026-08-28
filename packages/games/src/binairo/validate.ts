import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { isValidBinairoSolution } from "./constraints";
import { gradeBinairo } from "./solve";
import { BINAIRO_SIZE } from "./types";
import type { BinairoGrid, BinairoSolvedGrid, BinairoTier } from "./types";

export interface BinairoApprovalCriteria {
  readonly maxTier: BinairoTier;

  readonly minTier: BinairoTier;
  readonly minGivens: number;
  readonly maxGivens: number;
}

export const BINAIRO_WEEKDAY_CRITERIA: Readonly<
  Record<Weekday, BinairoApprovalCriteria>
> = {
  1: { maxTier: 1, minTier: 1, minGivens: 34, maxGivens: 40 },
  2: { maxTier: 1, minTier: 1, minGivens: 30, maxGivens: 34 },
  3: { maxTier: 2, minTier: 1, minGivens: 26, maxGivens: 30 },
  4: { maxTier: 2, minTier: 2, minGivens: 24, maxGivens: 28 },
  5: { maxTier: 2, minTier: 2, minGivens: 20, maxGivens: 24 },
  6: { maxTier: 2, minTier: 2, minGivens: 18, maxGivens: 22 },
  7: { maxTier: 2, minTier: 2, minGivens: 16, maxGivens: 20 },
};

export type BinairoRejectionReason =
  | "malformed-grid"
  | "solution-invalid"
  | "givens-contradict-solution"
  | "unsolvable"
  | "not-unique"
  | "too-hard"
  | "too-easy"
  | "too-few-givens"
  | "too-many-givens";

export type BinairoValidationResult =
  | {
      readonly approved: true;
      readonly requiredTier: BinairoTier;
      readonly givensCount: number;
    }
  | {
      readonly approved: false;
      readonly reasons: readonly BinairoRejectionReason[];
    };

export function validateBinairo(
  candidate: {
    readonly givens: BinairoGrid;
    readonly solution?: BinairoSolvedGrid;
  },
  weekday: Weekday,
): BinairoValidationResult {
  if (!isWeekday(weekday)) {
    throw new RangeError(
      `weekday must be an integer in 1..7 (ISO 8601), got ${String(weekday)}`,
    );
  }
  const cellCount = BINAIRO_SIZE * BINAIRO_SIZE;
  const { givens, solution } = candidate;
  if (
    givens.length !== cellCount ||
    givens.some((cell) => cell !== 0 && cell !== 1 && cell !== null)
  ) {
    return { approved: false, reasons: ["malformed-grid"] };
  }

  const reasons: BinairoRejectionReason[] = [];

  if (solution !== undefined) {
    const wellFormed =
      solution.length === cellCount &&
      solution.every((cell) => cell === 0 || cell === 1);
    if (!wellFormed || !isValidBinairoSolution(solution)) {
      reasons.push("solution-invalid");
    }
    if (
      wellFormed &&
      givens.some((cell, index) => cell !== null && cell !== solution[index])
    ) {
      reasons.push("givens-contradict-solution");
    }
  }

  const criteria = BINAIRO_WEEKDAY_CRITERIA[weekday];
  const grade = gradeBinairo(givens);
  if (!grade.solvable) {
    reasons.push("unsolvable");
  } else if (!grade.unique) {
    reasons.push("not-unique");
  }
  const tier = grade.requiredTier;
  if (tier !== null) {
    if (tier > criteria.maxTier) {
      reasons.push("too-hard");
    }
    if (tier < criteria.minTier) {
      reasons.push("too-easy");
    }
  }

  const givensCount = givens.filter((cell) => cell !== null).length;
  if (givensCount < criteria.minGivens) {
    reasons.push("too-few-givens");
  }
  if (givensCount > criteria.maxGivens) {
    reasons.push("too-many-givens");
  }

  if (reasons.length > 0) {
    return { approved: false, reasons };
  }
  if (tier !== 1 && tier !== 2) {
    throw new RangeError(`unreachable: approved with tier ${String(tier)}`);
  }
  return { approved: true, requiredTier: tier, givensCount };
}
