import type { GridLine } from "../line";
import type { Weekday } from "../weekday";

export const QUEENS_SIZES = [7, 8, 9] as const;

export type QueensSize = (typeof QUEENS_SIZES)[number];

export type QueensGrid = readonly (0 | 1)[];

export interface QueensBoard {
  readonly size: number;
  readonly regions: readonly number[];
}

export interface QueensPuzzle extends QueensBoard {
  readonly size: QueensSize;
  readonly seed: number;
  readonly weekday: Weekday;
  readonly solution: QueensGrid;
  readonly advancedSteps: number;
}

export type QueensTier = 1 | 2 | 3;

export interface QueensGrade {
  readonly solved: boolean;
  readonly maxTier: QueensTier;
  readonly advancedSteps: number;
}

export type QueensEntry = 0 | 1 | null;

export type QueensElimination =
  | "regionInRow"
  | "regionInColumn"
  | "rowInRegion"
  | "columnInRegion"
  | "blocking"
  | "regionGroupRows"
  | "regionGroupColumns";

export type QueensUnit =
  GridLine | { readonly kind: "region"; readonly index: number };

export interface QueensStep {
  readonly index: number;
  readonly unit: QueensUnit;
  readonly cells: readonly number[];
  readonly after: QueensElimination | null;
}

export type QueensRejectionReason =
  | "malformed"
  | "size-mismatch"
  | "region-count"
  | "region-disconnected"
  | "regions-not-canonical"
  | "solution-invalid"
  | "not-unique"
  | "beyond-ladder"
  | "too-hard"
  | "too-easy"
  | "steps-mismatch";

export type QueensValidationResult =
  | { readonly ok: true; readonly advancedSteps: number }
  | {
      readonly ok: false;
      readonly failures: readonly QueensRejectionReason[];
    };

export class QueensGenerationError extends Error {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly attempts: number;

  constructor(seed: number, weekday: Weekday, attempts: number) {
    super(
      `queens generation failed for seed ${String(seed)}, weekday ${String(weekday)} after ${String(attempts)} attempts`,
    );
    this.name = "QueensGenerationError";
    this.seed = seed;
    this.weekday = weekday;
    this.attempts = attempts;
  }
}
