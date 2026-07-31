import type { Weekday } from "../weekday";

export type CellState = "filled" | "empty" | "unknown";

/** [row][col], true = filled. The solution grid IS the picture. */
export type NonogramSolution = ReadonlyArray<ReadonlyArray<boolean>>;

export interface NonogramClues {
  readonly size: number;
  /** Run lengths per row, top→bottom; [] for an all-empty line (UI renders "0"). */
  readonly rows: ReadonlyArray<ReadonlyArray<number>>;
  /** Run lengths per column, left→right. */
  readonly cols: ReadonlyArray<ReadonlyArray<number>>;
}

/**
 * The payoff. Deliberately a single strippable field: everything outside
 * `reveal` is the complete playable projection, so the API layer (#17) can
 * withhold the picture identity pre-completion with a one-field omit
 * (ADR-0004 seam — see plan §6).
 */
export interface NonogramReveal {
  /** Stable kebab-case English id, e.g. "anchor" (pt-BR display name lives in `name`: "Âncora"). */
  readonly motifId: string;
  /** pt-BR display name, e.g. "Âncora". */
  readonly name: string;
  /** Whether the horizontal-mirror transform was applied. */
  readonly mirrored: boolean;
  readonly solution: NonogramSolution;
}

export interface NonogramPuzzle {
  readonly game: "nonogram";
  /** The input seed, uint32-coerced. */
  readonly seed: number;
  readonly weekday: Weekday;
  readonly size: number;
  /** clues + size + weekday = the playable projection. */
  readonly clues: NonogramClues;
  readonly reveal: NonogramReveal;
}

export interface SolveResult {
  readonly status: "solved" | "stuck" | "contradiction";
  readonly grid: ReadonlyArray<ReadonlyArray<CellState>>;
  /** Full sweeps that made progress (plan §3.2). */
  readonly passes: number;
  /** Fraction of cells determined after sweep 1, in [0, 1]. */
  readonly firstPassFill: number;
}

export interface DifficultyCriteria {
  readonly size: number;
  /** Inclusive lower bound: entry qualifies iff minEffort <= score. 0 for easy bands. */
  readonly minEffort: number;
  /**
   * Exclusive upper bound: entry qualifies iff score < maxEffort. T for easy
   * bands, Infinity for hard/whole-class bands. Half-open
   * [minEffort, maxEffort) — matches the weekday table (plan §1) exactly.
   */
  readonly maxEffort: number;
}

export interface ValidationResult {
  readonly ok: boolean;
  /** Machine-greppable reason codes. */
  readonly failures: ReadonlyArray<string>;
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
