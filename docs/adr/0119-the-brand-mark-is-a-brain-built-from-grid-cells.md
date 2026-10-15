# ADR-0119 — The brand mark is a brain built from grid cells

**Status:** Accepted — 2026-10-15

## Context

"Miolos" alone does not tell a newcomer the product is about the brain or puzzles (Fernando, 2026-10-15, #354). The only mark was the app icon: a card with four accent squares. Five concepts were drawn in two rounds, each in both themes and at 16 px, 32 px, icon and header size: **A**, a brain cut into jigsaw pieces with one lifted out (Fernando's suggestion); **B**, a brain filled with a square grid; **C**, six lobes in six accents; **D**, B's grid under C's folds; **E**, C's lobes built from B's cells.

## Decision

1. **E**, Fernando's pick on 2026-10-15. He found C the fastest to read as a brain and liked B's grid, but rejected "one lobe per game": games may be added or switched off. E keeps C's lobes and B's cells. Its colours are the palette, not a game count. A was dropped because the jigsaw brain is the commonest stock image for the idea and the puzzle piece is a contested autism-awareness symbol; D because its folds read slower than coloured lobes.
2. **One drawing, two cuts.** `BrandMark` (`apps/web/src/components/brand-mark.tsx`) draws the detailed cut (4-unit cells) on the hub masthead and on a loading board, and the small cut (6-unit cells) beside every top-bar wordmark, at the hub sign-off and in the favicon. The cells are an encoded table, so the mark needs no clip path and costs little client JS.
3. **The mark is inline SVG coloured by tokens** through CSS-module classes, so it follows the in-app theme and holds no colour literal. It is `aria-hidden`; the wordmark text stays the accessible name.
4. **A loading board shows the mark shuffling** (`BoardCard` with `placeholder` and no overlay): CSS keyframes cycle each cell through the accents and blank paper on staggered durations, so it looks random with no JavaScript. Under reduced motion it stands still.
5. **Two static masters, both on token literals.** `apps/web/app/icon.svg` is the favicon, with an inline `prefers-color-scheme: dark` block; `apps/web/scripts/app-icon.svg` is the master `render-icons.mjs` turns into the PWA and apple PNGs. `T-WEB-S753` ties both to `BRAIN` and to `tokens.css`.
6. **The descriptor is copy.** The hub shows `messages.brand.tagline` under the wordmark and `messages.brand.signOff` at its foot; `meta.title`, `meta.description` and the OG site tagline are built from the same strings.

## Consequences

- Another concept later swaps the drawing inside `BrandMark` and the two masters; no caller changes.
- The favicon follows the OS scheme, not the in-app theme override, the limit ADR-0079 already accepts for `theme-color`.
- Play screens hide the top-bar wordmark at 768 px and below, so on phones the mark shows on the hub, the secondary pages and the loading board.
