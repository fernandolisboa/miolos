/**
 * Sudoku engine (@miolos/games/sudoku): seeded deterministic generator,
 * counting solver, validator, technique-tier grader, and the weekday
 * approval criteria table. Pure TypeScript — seed in, puzzle out.
 */
export type { Weekday } from "../weekday";
export {
  type SudokuApprovalCriteria,
  type SudokuGrade,
  type SudokuGrid,
  type SudokuPuzzle,
  type SudokuTier,
} from "./types";
export { getSudokuConflicts, isSudokuSolved } from "./board";
export { countSudokuSolutions, solveSudoku } from "./solve";
export { gradeSudoku } from "./grade";
export {
  SUDOKU_TIER_CRITERIA,
  SUDOKU_WEEKDAY_CRITERIA,
  sudokuCriteriaForWeekday,
} from "./criteria";
export {
  SUDOKU_MAX_GENERATION_ATTEMPTS,
  SudokuGenerationError,
  generateDailySudoku,
  generateSudoku,
} from "./generate";
export {
  validateSudoku,
  type SudokuRejectionReason,
  type SudokuValidationResult,
} from "./validate";
