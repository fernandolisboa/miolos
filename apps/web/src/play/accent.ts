import type { CSSProperties } from "react";

import type { FreePlayGame } from "../free-play/catalog";

export const ACCENTS: Readonly<Record<FreePlayGame, string>> = {
  termo: "var(--accent-termo)",
  sudoku: "var(--accent-sudoku)",
  nonogram: "var(--accent-nonogram)",
  binairo: "var(--accent-binairo)",
  crossword: "var(--accent-crossword)",
  queens: "var(--accent-queens)",
  minesweeper: "var(--accent-minesweeper)",
};

const INKS_ON_ACCENT: Readonly<Record<FreePlayGame, string>> = {
  termo: "var(--paper-desk)",
  sudoku: "var(--paper-desk)",
  nonogram: "var(--paper-card)",
  binairo: "var(--paper-desk)",
  crossword: "var(--paper-desk)",
  queens: "var(--paper-desk)",
  minesweeper: "var(--paper-desk)",
};

export function accentVars(game: FreePlayGame): CSSProperties {
  return { "--accent": ACCENTS[game], "--ink-on-accent": INKS_ON_ACCENT[game] };
}
