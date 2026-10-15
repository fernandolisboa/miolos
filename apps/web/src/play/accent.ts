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

export function accentVars(game: FreePlayGame): CSSProperties {
  return {
    "--accent": ACCENTS[game],
    "--ink-on-accent":
      game === "nonogram" ? "var(--paper-card)" : "var(--paper-desk)",
  };
}
