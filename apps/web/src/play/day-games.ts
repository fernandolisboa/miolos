import type { Game } from "@miolos/core";

export const DAY_GAMES = [
  "termo",
  "crossword",
  "sudoku",
  "nonogram",
  "binairo",
  "queens",
  "minesweeper",
] as const satisfies readonly Game[];
