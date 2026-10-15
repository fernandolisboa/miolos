interface MinesweeperSize {
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

export interface MinesweeperState {
  readonly level: MinesweeperLevel;
  readonly seed: number;
  readonly field: MinesweeperField | null;
  readonly open: readonly boolean[];
  readonly marks: readonly MinesweeperMark[];
  readonly status: MinesweeperStatus;
  readonly hit: number | null;
}
