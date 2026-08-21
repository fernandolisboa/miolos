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
 * The ink that is legible ON each accent fill — the filled buttons, the
 * stamped chips, the board cells. Never accent-coloured text on paper, which
 * ADR-0041 forbids outright: an accent may colour a shape, never a word.
 *
 * The property's range is "an ink that is legible on this accent", **not** "a
 * paper token" (ADR-0041 decision 2). Since #161 (ADR-0067) all four resolve
 * to a paper — that is the harmonization the ticket asked for — but the range
 * stays as decision 2 states it, because it is what allowed Termo's ink to be
 * `--ink` while the accent was too light to carry any paper. Three are
 * unchanged to the byte:
 *
 * - **Sudoku** `--paper-desk` on ink-blue — **7.5113:1**.
 * - **Binairo** `--paper-desk` on moss-green — **5.3066:1**.
 * - **Nonogram** `--paper-card` on terracotta — **4.5063:1**, and the reason
 *   this map exists at all: desk on terracotta is **4.318:1**, an AA failure
 *   for the 14px labels of `screen.hint`, `conclusion-view.emptyCta`,
 *   `conclusion-view.ctaNext` and the hub's `page.cta` (step-6 finding
 *   ISS-A2). It is the identical one-token argument
 *   `nonogram-board.module.css:461-463` already makes for `.controlActive`,
 *   where Binairo's shipped `.controlDigitActive` gets away with desk only
 *   because its label is a 24px Fraunces numeral, i.e. WCAG large text at a
 *   3:1 floor. A brush label is not, and neither is a button label.
 *
 * - **Termo** `--paper-desk` on deep mustard — **4.8433:1**, since #161
 *   (ADR-0067). The original mustard #C08A1E (L 0.29477163, greyscale
 *   148/255) cleared no paper — desk was 2.7311:1, card 2.8501:1, tint
 *   2.5457:1 — so Termo was the one game whose filled buttons carried
 *   `--ink` (5.4968:1 on the old value), and its hub card read as the odd
 *   one out beside three deep fills with light labels. ADR-0067 deepened
 *   the token to #8D6212 (L 0.14441758) for exactly that reason, and this
 *   row is the other half of the same decision: `--ink` ON the deep value
 *   is 3.0996:1, an AA failure, so the ink flip and the token move are one
 *   change, not two.
 *
 * ADR-0041 decision 6 ("the token values do not move") is superseded for
 * `--accent-termo` by ADR-0067, the new ADR that decision itself required.
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
 *
 * That fallback is per site rather than uniform (ADR-0041 consequence (c),
 * as amended by ADR-0067): since #161 every game's ink resolves to a paper,
 * so `var(--paper-desk)` is the safe fallback everywhere — including the
 * Termo board and keys, which carried `var(--ink)` while the accent was the
 * old light mustard (desk on #C08A1E was 2.7311:1). The per-site machinery
 * stays, because it is what let the flip happen at the sites and not in a
 * global constant; `apps/web/test/ink-on-accent.test.ts` still carries the
 * expected fallback per site.
 */
export function accentVars(game: Game): CSSProperties {
  return { "--accent": ACCENTS[game], "--ink-on-accent": INKS_ON_ACCENT[game] };
}
