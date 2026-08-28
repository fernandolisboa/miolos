import type { Weekday } from "../weekday";

export type NonogramCellState = "filled" | "empty" | "unknown";

export type NonogramSolution = ReadonlyArray<ReadonlyArray<boolean>>;

export interface NonogramClues {
  readonly size: number;

  readonly rows: ReadonlyArray<ReadonlyArray<number>>;

  readonly cols: ReadonlyArray<ReadonlyArray<number>>;
}

export interface NonogramReveal {
  readonly motifId: string;

  readonly name: string;

  readonly mirrored: boolean;
  readonly solution: NonogramSolution;
}

export interface NonogramPuzzle {
  readonly game: "nonogram";

  readonly seed: number;
  readonly weekday: Weekday;
  readonly size: number;

  readonly clues: NonogramClues;
  readonly reveal: NonogramReveal;
}

export interface NonogramSolveResult {
  readonly status: "solved" | "stuck" | "contradiction";
  readonly grid: ReadonlyArray<ReadonlyArray<NonogramCellState>>;

  readonly passes: number;

  readonly firstPassFill: number;
}

export interface NonogramApprovalCriteria {
  readonly size: number;

  readonly minEffort: number;

  readonly maxEffort: number;
}

export type NonogramRejectionReason =
  | "weekday-out-of-range"
  | "solution-dimensions-mismatch"
  | "size-field-mismatch"
  | "size-out-of-criteria"
  | "clues-malformed"
  | "clues-solution-mismatch"
  | "not-line-solvable"
  | "solved-grid-differs-from-solution"
  | "effort-out-of-band"
  | "reveal-name-empty"
  | "reveal-motif-unknown"
  | "reveal-solution-motif-mismatch";

export interface NonogramValidationResult {
  readonly ok: boolean;

  readonly failures: ReadonlyArray<NonogramRejectionReason>;
}

export class NonogramGenerationError extends Error {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly attempts: number;

  constructor(seed: number, weekday: Weekday, attempts: number) {
    super(
      `nonogram generation failed for seed ${String(seed)}, weekday ${String(weekday)} after ${String(attempts)} attempts`,
    );
    this.name = "NonogramGenerationError";
    this.seed = seed;
    this.weekday = weekday;
    this.attempts = attempts;
  }
}
