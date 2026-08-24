/**
 * The Ateliê palette, as literals a PNG can hold (#34, ADR-0054 decision 12).
 *
 * No CSS custom property can reach a rasterised image: satori resolves no
 * cascade, so `var(--paper-desk)` is an unresolvable string. This module is
 * the one place the card spells the values out, each tied by NAME to the
 * token it mirrors in `packages/ui/tokens.css` — the same move
 * `app/layout.tsx`'s `themeColor` and `app/manifest.ts` already make.
 *
 * **The alpha values are 8-digit hex, and that is what makes the tie-back
 * assertable.** `T-WEB-S200` matches each literal's leading SEVEN characters
 * against `packages/ui/tokens.css`, so `#2E4E7E38` ties back to
 * `--accent-sudoku: #2E4E7E` by substring while `rgba(46,78,126,0.22)` would
 * tie back to nothing.
 */

/** `--paper-desk` — the desk the card sits on. */
export const PAPER_DESK = "#F7F2E9";
/** `--paper-card` — the card itself. */
export const PAPER_CARD = "#FBF7EF";
/** `--line` — the card's hairline border. */
export const LINE = "#D8D0C2";
/** `--ink` — the game name and the wordmark. */
export const INK = "#211D19";
/** `--ink-2` — the kicker, the date and the tagline. */
export const INK_2 = "#6E6659";

/**
 * `--texture-dots`'s own colour, `rgba(33,29,25,0.06)`, as 8-digit hex.
 * `0.06 × 255 = 15.3 → 0x0F`. It is the desk's definition (`DESIGN.md:13`),
 * not decoration, and it is the one thing that says *Ateliê* at thumbnail
 * size on a card that is otherwise a rectangle on flat cream.
 */
export const TEXTURE_DOT = "#211D190F";

/**
 * The per-game accent, at the two alphas the card uses. **These are the only
 * two surfaces the accent may touch** — `DESIGN.md`'s colour section retired
 * the accent-coloured kicker the reference frames carry, so every WORD on the
 * card is `--ink` or `--ink-2` (ADR-0041 decision 1, pinned by `T-WEB-S200`).
 *
 * `38` is α 0.22 (`0.22 × 255 = 56.1 → 0x38`) for the hard offset shadow;
 * `52` is α 0.32 (`0.32 × 255 = 81.6 → 0x52`) for the washi tape. Both alphas
 * are `DESIGN.md`'s own for those two surfaces.
 */
export const ACCENT_SHADOW = {
  termo: "#8D621238", // --accent-termo
  sudoku: "#2E4E7E38", // --accent-sudoku
  nonogram: "#B5563C38", // --accent-nonogram
  binairo: "#4E6B5238", // --accent-binairo
} as const;

export const ACCENT_TAPE = {
  termo: "#8D621252", // --accent-termo
  sudoku: "#2E4E7E52", // --accent-sudoku
  nonogram: "#B5563C52", // --accent-nonogram
  binairo: "#4E6B5252", // --accent-binairo
} as const;

/**
 * `--accent-app` — "sealing-wax red: streak, promo", the non-game surface
 * accent. The SITE card is not any one game's, so it takes this rather than
 * inventing a four-tape treatment `DESIGN.md:37` does not describe.
 */
export const ACCENT_APP_SHADOW = "#9E3B2F38";
export const ACCENT_APP_TAPE = "#9E3B2F52";
