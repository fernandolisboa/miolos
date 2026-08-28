export type SudokuTier = 1 | 2 | 3 | 4 | 5;

export type SudokuGrade = SudokuTier | "beyond";

export type SudokuGrid = readonly number[];

export interface SudokuPuzzle {
  readonly givens: SudokuGrid;

  readonly solution: SudokuGrid;

  readonly tier: SudokuTier;

  readonly clueCount: number;

  readonly seed: number;
}

export interface SudokuApprovalCriteria {
  readonly tier: SudokuTier;

  readonly minClues: number;
  readonly maxClues: number;
}
