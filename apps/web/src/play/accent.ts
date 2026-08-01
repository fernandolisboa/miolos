/**
 * The one place a game is mapped to the accent the shared stylesheets read.
 *
 * `play/screen.module.css` and `play/conclusion-view.module.css` are shared,
 * so every accent in them is `var(--accent)` (plan 018 §5.2 edit 1) and the
 * screen sets that custom property on its own root element. The value is a
 * token reference rather than a hex literal, so DESIGN.md's palette stays
 * the single source of the colour; `--accent` itself is declared on
 * csstype's `Properties` in `src/types/css.d.ts`, which is why the inline
 * style typechecks without a cast.
 *
 * A per-game CSS class could carry it for the play screens (they already
 * carry one, for the four geometry custom properties in §12.2) but NOT for
 * the conclusion, which has no per-game module at all — so one mechanism
 * serves both rather than two that can disagree.
 */
import type { Game } from "@miolos/core";

const ACCENTS: Readonly<Record<Game, string>> = {
  termo: "var(--accent-termo)",
  sudoku: "var(--accent-sudoku)",
  nonogram: "var(--accent-nonogram)",
  binairo: "var(--accent-binairo)",
};

/** The `--accent` value for `game`, ready to set inline on a screen root. */
export function accentVar(game: Game): string {
  return ACCENTS[game];
}
