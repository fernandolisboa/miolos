import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import { gradeQueens } from "./grade";
import { floodRegion } from "./internal";
import { isValidQueensSolution } from "./rules";
import { countQueensSolutions } from "./solve";
import type {
  QueensPuzzle,
  QueensRejectionReason,
  QueensSize,
  QueensTier,
  QueensValidationResult,
} from "./types";

export interface QueensCriteria {
  readonly size: QueensSize;
  readonly skew: number;
  readonly maxTier: QueensTier;
  readonly minSteps: number;
  readonly maxSteps: number;
}

export const QUEENS_WEEKDAY_CRITERIA: Readonly<
  Record<Weekday, QueensCriteria>
> = {
  1: { size: 7, skew: 4, maxTier: 1, minSteps: 0, maxSteps: 0 },
  2: { size: 7, skew: 2, maxTier: 2, minSteps: 1, maxSteps: 5 },
  3: { size: 8, skew: 2, maxTier: 2, minSteps: 1, maxSteps: 5 },
  4: { size: 8, skew: 1, maxTier: 2, minSteps: 3, maxSteps: 9 },
  5: { size: 9, skew: 1, maxTier: 3, minSteps: 3, maxSteps: 9 },
  6: { size: 9, skew: 0, maxTier: 3, minSteps: 6, maxSteps: 14 },
  7: { size: 9, skew: 0, maxTier: 3, minSteps: 10, maxSteps: 40 },
};

function rejected(
  failures: readonly QueensRejectionReason[],
): QueensValidationResult {
  return { ok: false, failures };
}

export function validateQueens(puzzle: QueensPuzzle): QueensValidationResult {
  const { weekday, size, regions, solution } = puzzle;
  if (!isWeekday(weekday)) {
    throw new RangeError(
      `weekday must be an integer in 1..7 (ISO 8601), got ${String(weekday)}`,
    );
  }
  const criteria = QUEENS_WEEKDAY_CRITERIA[weekday];
  const cellCount = criteria.size * criteria.size;
  if (size !== criteria.size) {
    return rejected(["size-mismatch"]);
  }
  if (
    regions.length !== cellCount ||
    !regions.every((id) => Number.isInteger(id)) ||
    solution.length !== cellCount ||
    !solution.every((cell) => cell === 0 || cell === 1)
  ) {
    return rejected(["malformed"]);
  }
  const ids = [...new Set(regions)];
  if (ids.length !== size || !ids.every((id) => id >= 0 && id < size)) {
    return rejected(["region-count"]);
  }

  const failures: QueensRejectionReason[] = [];
  if (
    ids.some(
      (id) =>
        floodRegion(size, regions, regions.indexOf(id)).size !==
        regions.filter((other) => other === id).length,
    )
  ) {
    failures.push("region-disconnected");
  }
  if (!ids.every((id, index) => id === index)) {
    failures.push("regions-not-canonical");
  }
  if (!isValidQueensSolution(puzzle, solution)) {
    failures.push("solution-invalid");
  }
  if (countQueensSolutions(puzzle, 2) > 1) {
    failures.push("not-unique");
  }
  const grade = gradeQueens(puzzle);
  if (!grade.solved) {
    failures.push("beyond-ladder");
  } else {
    if (
      grade.maxTier > criteria.maxTier ||
      grade.advancedSteps > criteria.maxSteps
    ) {
      failures.push("too-hard");
    }
    if (grade.advancedSteps < criteria.minSteps) {
      failures.push("too-easy");
    }
    if (grade.advancedSteps !== puzzle.advancedSteps) {
      failures.push("steps-mismatch");
    }
  }
  return failures.length > 0
    ? rejected(failures)
    : { ok: true, advancedSteps: grade.advancedSteps };
}
