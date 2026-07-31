// Public surface of @miolos/games/nonogram (plan §2). Pure and
// deterministic: no dates, no timezones, no Math.random — the caller
// (publishing cron, free play) supplies seed and weekday.
export { deriveClues } from "./clues";
export { WEEKDAY_CRITERIA } from "./difficulty";
export { generateNonogram } from "./generate";
export { effortScore, solveNonogram } from "./solve";
export { NonogramGenerationError } from "./types";
export { validateNonogram } from "./validate";
export type { Weekday } from "../weekday";
export type {
  CellState,
  DifficultyCriteria,
  NonogramClues,
  NonogramPuzzle,
  NonogramReveal,
  NonogramSolution,
  SolveResult,
  ValidationResult,
} from "./types";
