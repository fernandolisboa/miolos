import type { Weekday } from "../weekday";

export const BINAIRO_SIZE = 8;

export type BinairoCell = 0 | 1 | null;

export type BinairoGrid = readonly BinairoCell[];

export type BinairoSolvedGrid = readonly (0 | 1)[];

export type BinairoTier = 1 | 2;

export interface BinairoPuzzle {
  readonly size: typeof BINAIRO_SIZE;

  readonly seed: number;
  readonly weekday: Weekday;

  readonly givens: BinairoGrid;

  readonly solution: BinairoSolvedGrid;
  readonly givensCount: number;

  readonly requiredTier: BinairoTier;
}
