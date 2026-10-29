# ADR-0158 — On a phone the Nonogram board takes the full width, Cores is a toggle, and the group rules are thinner

**Status:** Accepted — 2026-10-28 (issue #455)
**Amends:** [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md) decision 3 (the Nonogram's phone floor); [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md) decision 2 (rule widths); [ADR-0132](./0132-the-coloured-nonogram-is-a-free-play-variant-loaded-on-demand.md) decision 1 (the *Variante* control).

## Context

Fernando could not play a 15×15 Nonogram on his phone without zooming, and a pinch landed taps on cells (#455). At about 384×680 the free-play card was 281px wide: the board was bound by the height left under two rows of choice chips, not by the width. He also found the *Clássico / Cores* buttons heavy and the four inner 5×5 rules too thick.

## Decision

1. **Up to 480px wide, the Nonogram well's floor is the column's width** (`--board-min: min(100vw − 2 × --space-4, --board-max)` on `.pageNonogram`), so the board always spans the column and the page scrolls if it must. It covers the daily, the archive and free play, which share `nonogramPageModifier`. Wider screens, landscape phones and foldables keep ADR-0103's sizing. The gutter mirrors `.page`'s phone padding (pinned by T-WEB-S1105).
2. **Cores is one toggle button** beside the level chips, on the same row: `aria-pressed`, labelled *Variante: Cores*, icon only. Its icon is a 3×3 grid, every cell in the game accent when off and in four picture tones when on, each cell outlined in ink. Off looks like an idle chip; on sinks with an ink border. The variant is still a `Choice` (with `toggle: { on, off }`), so the solved card names it. When the toggle held focus as the screen remounted, its next mount takes focus back; any other remount leaves focus alone.
3. **The inner group rules are 2.5px; the frame stays 3px** on all four edges (`cellEdgeTop`/`cellEdgeLeft` join right and bottom). Contrast is unchanged: same `--ink`.

## Consequences

- A 15×15 at 360×640 scrolls 37px, at 384×680 21px (measured on `next start`); 360×780 and taller fit. The chips, the brush and the reset row stay scrollable; only the grid is `touch-action: none`.
- On a 3.5× phone the 2.5px rule snaps to about 2.3px; at 1× it draws 2px, the width #301 found too thin beside the old smaller board.

## Rejected

- **Shrinking the chrome until a 15×15 fits 640px tall:** it means changing the shared play sheet for every game to save one game's 37px.
- **A wider breakpoint (768px):** a 740×360 landscape phone would get a 727px well.
