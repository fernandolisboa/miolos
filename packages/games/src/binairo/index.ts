// Public API of @miolos/games/binairo (ADR-0019 subpath). Solver
// internals (techniques.ts, internal.ts) stay unexported.

export {
  BINAIRO_SIZE,
  type BinairoCell,
  type BinairoGrid,
  type BinairoPuzzle,
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
