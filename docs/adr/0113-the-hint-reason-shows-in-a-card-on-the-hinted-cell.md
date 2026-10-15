# ADR-0113 — The hint's reason shows in a card on the hinted cell

**Status:** Accepted — 2026-10-15 (issue #332)
**Depends on:** [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md), [ADR-0099](./0099-the-sudoku-hint-reveals-the-next-logical-step.md), [ADR-0101](./0101-the-grid-game-hints-reveal-the-next-logical-step.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md)
**Amends:** ADR-0099 decisions 4 and 5 (where the reason is seen, and for how long) and ADR-0103 decision 7 (the reserved slot is gone).

## Context

The reason sentence sat under the board in `.hintSlot`. On a desktop that is far from the cell the hint filled, so the player reads the cell in one place and the why in another. Fernando asked for a small card on the hinted cell instead.

## Decision

1. **The chrome draws one card for every grid game** (`play/hint-card.tsx`), in `section.board`, when the readouts carry a reason and `hint.cell` (the reducer's `lastIndex`). The boards are unchanged: the card finds the cell by `data-cell-index` and the board card by `boardCardOf` (`play/board-card.tsx`).
2. **Placement is a pure function** (`play/hint-card-place.ts`). The card sits above the cell with its tail on the cell's centre and its body running right; it runs left at the right edge of the board card, and is centred and clamped when neither side fits (phones). It drops below the cell when above would cross the top of the cell field (the first `data-cell-index`), so a Nonogram card never covers the column clues. Its width is three cells, never under 180px (a sentence on a 15×15 Nonogram cell stays readable), never wider than the board card. If the cell has scrolled above the viewport, only the board bounds it. It is measured before paint and again on window resize.
3. **It closes on the next press or key.** A document `pointerdown` or `keydown` closes it, except Tab, a modifier alone and key repeat. That covers the next move, a tap outside, Esc, Recomeçar and Ajustes, so only one overlay shows at a time. It is `pointer-events: none`, so it never blocks a cell: a tap through it reaches the cell underneath. Each hint opens a fresh card (`key={used}`). `useDismiss` (`play/use-dismiss.ts`) is shared with `InfoTip`.
4. **The reducer is unchanged.** The reason still stays in state until the next hint or Recomeçar (ADR-0099 decision 4); only the visible card closes sooner.
5. **The live region stays the screen-reader copy** (ADR-0099 decision 5), always mounted, keyed per hint, now visually hidden with the shared `components/visually-hidden.module.css` rule. The card is `aria-hidden`.
6. **No reserved slot.** `.hintSlot` and `--hint-line` are gone; the card is out of flow, so revealing a hint moves nothing and the board gets the 2–3 lines back.

## Consequences

- Pinned by `T-WEB-S690` (placement), `S691` (open, survive, close, reopen) and `S692` (each game anchors on the cell its hint wrote); `S367`, `S517`, `S555` and `S602` were re-aimed in place.
- The issue asked for about three cells; the 180px floor departs from that on small cells, on purpose.
- Tests that read the reason by text select the live region (`test/hint-reason.ts`), since the sentence is now in the DOM twice.

## Rejected

- **CSS anchor positioning:** it needs an `anchor-name` on the hinted cell in all five boards and fallback rules for older browsers; one small layout effect in the chrome needs neither.
- **A modal dialog:** it would take focus from the board and need its own close button for one sentence.
