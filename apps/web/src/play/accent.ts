/**
 * The one place a game is mapped to the accent the shared stylesheets read,
 * and to the ink that is legible ON that accent.
 *
 * `play/screen.module.css` and `play/conclusion-view.module.css` are shared,
 * so every accent in them is `var(--accent)` (plan 018 §5.2 edit 1) and the
 * screen sets that custom property on its own root element. The value is a
 * token reference rather than a hex literal, so DESIGN.md's palette stays
 * the single source of the colour; both properties are declared on csstype's
 * `Properties` in `src/types/css.d.ts`, which is why the inline style
 * typechecks without a cast.
 *
 * A per-game CSS class could carry them for the play screens (they already
 * carry one, for the four geometry custom properties in §12.2) but NOT for
 * the conclusion, which has no per-game module at all — so one mechanism
 * serves both rather than two that can disagree. The pair returned together
 * is the point: `--ink-on-accent` is only ever correct for the accent it
 * ships with, and `.ctaNext` proves why. That button renders on the
 * conclusion of the game just SOLVED while wearing the DESTINATION game's
 * accent, so it sets both on itself and overrides what it inherits from the
 * page root; a mechanism that could set one without the other would paint
 * one game's ink on another game's fill.
 */
import type { CSSProperties } from "react";

import type { Game } from "@miolos/core";

const ACCENTS: Readonly<Record<Game, string>> = {
  termo: "var(--accent-termo)",
  sudoku: "var(--accent-sudoku)",
  nonogram: "var(--accent-nonogram)",
  binairo: "var(--accent-binairo)",
};

/**
 * The text colour that sits on each accent FILL — the filled buttons, never
 * accent-coloured text on paper.
 *
 * `--paper-desk` for three of the four, which is what every filled button has
 * always painted. Nonogram is the exception and the reason this map exists:
 * desk on terracotta computes to **4.318:1**, an AA failure for the 14px
 * labels of `screen.hint`, `conclusion-view.emptyCta`, `conclusion-view
 * .ctaNext` and the hub's `page.cta` (step-6 finding ISS-A2). `--paper-card`
 * on the same fill is **4.506:1** — this is the identical one-token argument
 * `nonogram-board.module.css:461-463` already makes for `.controlActive`,
 * where Binairo's shipped `.controlDigitActive` gets away with desk only
 * because its label is a 24px Fraunces numeral, i.e. WCAG large text at a
 * 3:1 floor. A brush label is not, and neither is a button label.
 *
 * Termo is deliberately NOT rescued here: desk on mustard is 2.731:1 and
 * card would be 2.736:1, so nothing short of a palette change clears AA.
 * That, and the accent-on-PAPER half of the same pair (the 11px kickers at
 * 4.318:1, the 17px `.chipDone .chipName` at 3.969:1), is a decision about
 * the Ateliê palette rather than a bug fix, and is filed with every measured
 * figure as **#68**.
 */
const INKS_ON_ACCENT: Readonly<Record<Game, string>> = {
  termo: "var(--paper-desk)",
  sudoku: "var(--paper-desk)",
  nonogram: "var(--paper-card)",
  binairo: "var(--paper-desk)",
};

/**
 * The `--accent` / `--ink-on-accent` pair for `game`, ready to set inline on
 * a screen root or on a single filled button.
 *
 * Every consumer of the shared stylesheets reads the fill through
 * `var(--accent)` and the label through `var(--ink-on-accent,
 * var(--paper-desk))`. The fallback is real and load-bearing — unlike
 * `--board-mobile-max`, which `screen.module.css:409` reads with none
 * (landmine N12) — so a surface that renders outside an accent root still
 * paints the shipped desk ink instead of nothing.
 */
export function accentVars(game: Game): CSSProperties {
  return { "--accent": ACCENTS[game], "--ink-on-accent": INKS_ON_ACCENT[game] };
}
