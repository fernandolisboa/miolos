# ADR-0123 — In one column the rules sit behind an (i) and the hint shares the reset row

**Status:** Accepted — 2026-10-15 (issue #375)
**Amends:** [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md) decision 6 (in one column the confirm opens upward, over the controls above the row); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (the title block is a shared `PlayTitle`, also used by Termo); [ADR-0112](./0112-the-grid-game-routes-bundle-budget-is-a-leak-tripwire.md) (its named *Ajustes* relief is spent).
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md)
**Amended by:** [ADR-0142](./0142-redo-replays-undone-steps-until-a-new-move.md) — the undo/redo pair is wider, so under 360px the hint takes its own row below the controls.
**Amended by:** [ADR-0135](./0135-termo-free-play-offers-dueto-and-quarteto.md) (#374) — decision 1: on a phone free-play Quarteto drops the whole title block, (i) included, to keep its tiles at the 24px floor; its variant menu carries the full rules instead.

## Context

Fernando found the Nonogram hard to paint on a phone, with a lot of empty space on the sides, and too much explanatory text. At 390×664 (an iPhone with Safari's bars) every grid board sat at its 280px floor in a 390px screen and the page still scrolled: the rules paragraph took 50–90px and the Recomeçar/Ajustes row plus a full-width hint bar about 106px, all in the height the board sizes from (ADR-0103).

## Decision

1. **The rules move behind an (i) beside the title, up to 1023px.** `PlayTitle` (`play/play-title.tsx`) renders the whole title block for the chrome and for Termo; the trailing readout is its `children`, so Termo's exclusion from the chrome (ADR-0077) stands. The rules stay one paragraph, made a native `popover` the (i) targets: two columns undo the popover box and read it inline as before; one column hides it until the (i) opens it as a card pinned to the top of the screen. No JavaScript opens it, and the browser gives Escape and outside-tap dismissal; where popovers are unsupported, the paragraph shows inline. The skeleton draws the ring with no control.
2. **In one column Recomeçar, Ajustes and the hint share one row.** The grid is `minmax(0, 1fr) auto` and its last row `"reset hint"`; `.reset` spans both tracks so the confirm still covers the whole row and hides the hint. The confirm rises as a paper card over what is above the row.
3. **The hint's accessible name is always the full label** (`aria-label`). Two columns show the label; one column hides it and draws "Dica" and a count badge from `data-short` and `data-left` ("0" when spent). The badge is a `currentColor` ring with no fill, so the digit keeps the pill's measured ink-on-accent ratio. "Dica" is inside both names, so the visible text stays in the name (WCAG 2.5.3). The skeleton carries the same data, so the pill keeps its width.
4. **A phone page has a 16px side margin** (`--space-4`, was 20px), and the free-play picker sits 8px above the board. 16px is the least `impeccable detect` accepts for body text at the viewport edge.

## Consequences

- At 390×844 Nonogram, Sudoku and Cruzadinha boards reach about 370px (Cruzadinha was 265px). At 390×664 Nonogram goes from 284 to 319px, Binairo from 282 to 353px, Rainhas to 369px; Termo and Cruzadinha stay bound by their keyboards.
- The new markup costs about 0.9 KB on every play route and put `/nonogram` at 48.4 KB, over ADR-0112's 48 KB. This change takes the relief ADR-0112 named: the *Ajustes* panel (`GameSettings`) loads through `lazyChunk` (`components/lazy-chunk.ts`, shared with `HintCard`), fetched after hydration and retried on each tap, and the dialog opens once it is there. `/nonogram` ends at 46.0 KB, `/modo-livre/nonogram` at 66.6 of 69, `/modo-livre/cruzadinha` at 664.0 of 667. The next relief is the `playRecordSchema` split ADR-0112 also names.
- A tap on the board while the card is open closes it and also reaches the cell, as with `InfoTip` and `HintCard`. Change all three together or none.

## Rejected

- **Dropping the rules:** a first-time player of Binairo or Rainhas has nowhere else to read them on the screen.
- **A short hint label in the copy for every width:** desktop has the room, and the full sentence reads better there.
- **`useTip` for the toggle:** script for what the browser's popover does natively, on routes with under 1 KB to spare.
- **A per-route `/nonogram` budget of 49 KB:** ADR-0112 rejected per-route entries for the grid routes and named the lazy panel first.
- **Letting the page scroll so boards size from width alone:** ADR-0103 keeps the board and its controls on one screen.
