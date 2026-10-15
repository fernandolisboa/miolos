# ADR-0119 — The brand mark is a brain drawn from the games' grid

**Status:** Accepted — 2026-10-15

## Context

"Miolos" alone does not tell a newcomer the product is about the brain or puzzles (Fernando, 2026-10-15, #354). The only mark was the app icon: a card with four accent squares. Three concepts were drawn, each in both themes and at 16 px, 32 px, icon and header size: **A**, a brain cut into jigsaw pieces with one piece lifted out (Fernando's suggestion); **B**, a brain filled with a square grid and one accent cell per game; **C**, six lobes, each a game accent.

## Decision

1. **B.** The grid is the board of five of the six games, so the mark is ours rather than stock "brain + puzzle" art, and it reads in ink alone. A was rejected because the jigsaw brain is the commonest stock image for the idea and the puzzle piece is a contested autism-awareness symbol; C because six full accents at once shout over the Ateliê palette and read as a school anatomy chart.
2. **One drawing, two cuts.** `BrandMark` (`apps/web/src/components/brand-mark.tsx`) draws the detailed cut (8-unit grid, one cell per game accent) where it is large, on the hub masthead, and the small cut (16-unit grid, three `--accent-app` cells) everywhere under ~32 px: every top bar, the hub sign-off, the favicon. The small cut uses the app accent so no three games get brand presence the other three lack.
3. **The mark is inline SVG coloured by tokens** through CSS-module classes, so it follows the theme like any other surface and holds no colour literal. It is `aria-hidden`; the wordmark text stays the accessible name.
4. **Two static masters, both on token literals.** `apps/web/app/icon.svg` is the favicon: the small cut alone, with an inline `prefers-color-scheme: dark` block. `apps/web/scripts/app-icon.svg` is the master `render-icons.mjs` turns into the PWA and apple PNGs: the detailed cut on the Ateliê card. `T-WEB-S753` ties every literal in both to `tokens.css`.
5. **The descriptor is copy, not the mark's job.** The hub shows `messages.brand.tagline` under the wordmark and `messages.brand.signOff` at its foot; `meta.title`, `meta.description` and the OG site tagline are built from the same two strings.

## Consequences

- A different concept later swaps the drawing inside `BrandMark` and the two masters; no caller changes.
- The favicon follows the OS scheme, not the in-app theme override, the limit ADR-0079 already accepts for `theme-color`.
- The mark is in the client JS of every play route (`PlayScreenChrome`, Termo's `play-view.tsx`), about 1 KB raw; the CI bundle check covers it.
- The conclusion top bar (`play/conclusion-view.tsx`) still shows the wordmark without the mark.
