import type { MinesweeperSize } from "./types";

export const MINESWEEPER_CUSTOM_LIMITS = {
  rows: { min: 9, max: 24 },
  columns: { min: 9, max: 30 },
  mines: { min: 10 },
} as const;

function clamp(value: number, min: number, max: number): number {
  const whole = Math.trunc(value);
  return Number.isNaN(whole) ? min : Math.min(max, Math.max(min, whole));
}

export function maxCustomMines(rows: number, columns: number): number {
  return (rows - 1) * (columns - 1);
}

export function customMinesweeperSize(
  rows: number,
  columns: number,
  mines: number,
): MinesweeperSize {
  const limits = MINESWEEPER_CUSTOM_LIMITS;
  const r = clamp(rows, limits.rows.min, limits.rows.max);
  const c = clamp(columns, limits.columns.min, limits.columns.max);
  return {
    rows: r,
    columns: c,
    mines: clamp(mines, limits.mines.min, maxCustomMines(r, c)),
  };
}
