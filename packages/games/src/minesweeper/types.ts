import type { Weekday } from "../weekday";

export interface MinesweeperSize {
  readonly rows: number;
  readonly columns: number;
  readonly mines: number;
}

export const MINESWEEPER_LEVELS = {
  beginner: { rows: 9, columns: 9, mines: 10 },
  intermediate: { rows: 16, columns: 16, mines: 40 },
  expert: { rows: 16, columns: 30, mines: 99 },
} as const satisfies Record<string, MinesweeperSize>;

export type MinesweeperLevel = keyof typeof MINESWEEPER_LEVELS;

export interface MinesweeperField {
  readonly rows: number;
  readonly columns: number;
  readonly mines: readonly boolean[];
  readonly counts: readonly number[];
}

export type MinesweeperMark = "flag" | "question" | null;

export type MinesweeperStatus = "ready" | "playing" | "won" | "lost";

export type MinesweeperState = {
  readonly size: MinesweeperSize;
  readonly open: readonly boolean[];
  readonly marks: readonly MinesweeperMark[];
  readonly status: MinesweeperStatus;
  readonly hit: number | null;
} & (
  | { readonly field: null; readonly seed: number }
  | { readonly field: MinesweeperField }
);

export interface MinesweeperDaily {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly rows: number;
  readonly columns: number;
  readonly mines: readonly (0 | 1)[];
  readonly start: number;
}

export type MinesweeperRejectionReason =
  | "malformed"
  | "size-mismatch"
  | "mine-count"
  | "start-not-clear"
  | "opens-too-much"
  | "needs-a-guess";

export type MinesweeperValidationResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly failures: readonly MinesweeperRejectionReason[];
    };

export class MinesweeperGenerationError extends Error {
  readonly seed: number;
  readonly weekday: Weekday;
  readonly attempts: number;

  constructor(seed: number, weekday: Weekday, attempts: number) {
    super(
      `minesweeper generation failed for seed ${String(seed)}, weekday ${String(weekday)} after ${String(attempts)} attempts`,
    );
    this.name = "MinesweeperGenerationError";
    this.seed = seed;
    this.weekday = weekday;
    this.attempts = attempts;
  }
}
