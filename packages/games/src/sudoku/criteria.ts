import { isWeekday } from "../weekday";
import type { Weekday } from "../weekday";
import type { SudokuApprovalCriteria, SudokuTier } from "./types";

export const SUDOKU_TIER_CRITERIA: Readonly<
  Record<SudokuTier, SudokuApprovalCriteria>
> = Object.freeze({
  1: Object.freeze({ tier: 1, minClues: 36, maxClues: 56 } as const),
  2: Object.freeze({ tier: 2, minClues: 30, maxClues: 50 } as const),
  3: Object.freeze({ tier: 3, minClues: 26, maxClues: 46 } as const),
  4: Object.freeze({ tier: 4, minClues: 24, maxClues: 42 } as const),
  5: Object.freeze({ tier: 5, minClues: 22, maxClues: 40 } as const),
});

export const SUDOKU_WEEKDAY_CRITERIA: Readonly<
  Record<Weekday, SudokuApprovalCriteria>
> = Object.freeze({
  1: SUDOKU_TIER_CRITERIA[1],
  2: SUDOKU_TIER_CRITERIA[2],
  3: SUDOKU_TIER_CRITERIA[2],
  4: SUDOKU_TIER_CRITERIA[3],
  5: SUDOKU_TIER_CRITERIA[3],
  6: SUDOKU_TIER_CRITERIA[4],
  7: SUDOKU_TIER_CRITERIA[5],
});

export function sudokuCriteriaForWeekday(
  weekday: Weekday,
): SudokuApprovalCriteria {
  if (!isWeekday(weekday)) {
    throw new RangeError(
      `weekday must be an integer 1-7 (ISO 8601, Monday=1), got ${String(weekday)}`,
    );
  }
  return SUDOKU_WEEKDAY_CRITERIA[weekday];
}
