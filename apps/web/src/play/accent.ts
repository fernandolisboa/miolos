import type { CSSProperties } from "react";

import type { Game } from "@miolos/core";

export const ACCENTS: Readonly<Record<Game, string>> = {
  termo: "var(--accent-termo)",
  sudoku: "var(--accent-sudoku)",
  nonogram: "var(--accent-nonogram)",
  binairo: "var(--accent-binairo)",
  crossword: "var(--accent-crossword)",
  queens: "var(--accent-queens)",
};

const INKS_ON_ACCENT: Readonly<Record<Game, string>> = {
  termo: "var(--paper-desk)",
  sudoku: "var(--paper-desk)",
  nonogram: "var(--paper-card)",
  binairo: "var(--paper-desk)",
  crossword: "var(--paper-desk)",
  queens: "var(--paper-desk)",
};

export function accentVars(game: Game): CSSProperties {
  return { "--accent": ACCENTS[game], "--ink-on-accent": INKS_ON_ACCENT[game] };
}
