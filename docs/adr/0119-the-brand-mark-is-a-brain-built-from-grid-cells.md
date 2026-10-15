# ADR-0119 — The brand mark is a brain built from grid cells

**Status:** Accepted — 2026-10-15
**Amends:** [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) decision 2 — `/modo-livre/nonogram` re-sized to 67 KB (decision 7 below).

## Context

"Miolos" alone does not tell a newcomer the product is about the brain or puzzles (Fernando, 2026-10-15, #354). The only mark was the app icon: a card with four accent squares. Five concepts were drawn in two rounds, each in both themes and at 16 px, 32 px, icon and header size: **A**, a brain cut into jigsaw pieces with one lifted out (Fernando's suggestion); **B**, a brain filled with a square grid; **C**, six lobes in six accents; **D**, B's grid under C's folds; **E**, C's lobes built from B's cells.

## Decision

1. **E**, Fernando's pick on 2026-10-15. He found C the fastest to read as a brain and liked B's grid, but rejected "one lobe per game": games may be added or switched off. E keeps C's lobes and B's cells. Its colours are the palette, not a game count. A was dropped because the jigsaw brain is the commonest stock image for the idea and the puzzle piece is a contested autism-awareness symbol; D because its folds read slower than coloured lobes.
2. **One drawing, two cuts.** `BrandMark` (`apps/web/src/components/brand-mark.tsx`) draws the detailed cut (4-unit cells) on the hub masthead and on a loading board, and the small cut (6-unit cells) beside every top-bar wordmark, at the hub sign-off and in the favicon. The cells are an encoded table, so the mark needs no clip path and costs little client JS.
3. **The mark is inline SVG coloured by tokens** through CSS-module classes, so it follows the in-app theme and holds no colour literal. It is `aria-hidden`; the wordmark text stays the accessible name.
4. **A loading board shows the mark shuffling** (`BoardCard` with `placeholder` and no overlay): CSS keyframes cycle each cell through the accents and blank paper on staggered durations, so it looks random with no JavaScript. Under reduced motion it stands still.
5. **Two static masters, both on token literals.** `apps/web/app/icon.svg` is the favicon, with an inline `prefers-color-scheme: dark` block; `apps/web/scripts/app-icon.svg` is the master `render-icons.mjs` turns into the PWA and apple PNGs. `T-WEB-S753` ties both to `BRAIN` and to `tokens.css`.
6. **The descriptor is copy.** The hub shows `messages.brand.tagline` under the wordmark and `messages.brand.signOff` at its foot; `meta.title`, `meta.description` and the OG site tagline are built from the same strings.
7. **`/modo-livre/nonogram` is re-sized from 66 to 67 KB.** The mark in the play top bar and on the loading board took it to 66.2 KB over `/`, measured after #359–#364. Splitting the mark out with `React.lazy` broke the preload contract T-WEB-S289 pins, so Fernando approved the raise on 2026-10-15 (decision card in the logo thread: up to 2–3 KB on the three free-play routes). Only Nonogram needed it; Termo (61.5 of 62) and Cruzadinha (663.4 of 664) still fit.

## Consequences

- Another concept later swaps the drawing inside `BrandMark` and the two masters; no caller changes.
- The favicon follows the OS scheme, not the in-app theme override, the limit ADR-0079 already accepts for `theme-color`.
- The `max-width: 1023px` block of `play/screen.module.css` hides `.wordmark`, so on phones and tablets play screens show the mark only on the loading board.
