export {
  BINAIRO_SIZE,
  type BinairoCell,
  type BinairoGrid,
  type BinairoPuzzle,
  type BinairoRule,
  type BinairoSolvedGrid,
  type BinairoTier,
} from "./types";
export {
  findBinairoViolations,
  isValidBinairoSolution,
  type BinairoViolation,
} from "./constraints";
export {
  countBinairoSolutions,
  gradeBinairo,
  solveBinairo,
  type BinairoGrade,
} from "./solve";
export type { GridLine as BinairoLine } from "../line";
export { nextBinairoStep, type BinairoStep } from "./step";
export {
  BINAIRO_MAX_GENERATION_ATTEMPTS,
  BinairoGenerationError,
  generateBinairo,
} from "./generate";
export {
  BINAIRO_WEEKDAY_CRITERIA,
  validateBinairo,
  type BinairoApprovalCriteria,
  type BinairoRejectionReason,
  type BinairoValidationResult,
} from "./validate";
