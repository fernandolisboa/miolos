# ADR-0156 — Each daily is its own taped card, and no card sits alone on a row

**Status:** Accepted — 2026-10-26 (issue #445, epic #442)
**Depends on:** [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md)

## Context

With seven dailies, the hub's three-column grid left Campo Minado alone on its last row, and the roster still grows (Fernando, 2026-10-15). Fernando approved "D refinada · cards com fita" on 2026-10-26: small cards, each with its own washi tape. ADR-0052 forbids a progress bar or locked cards, so what is left to play shows only through the cards themselves.

## Decision

1. **One card per daily**, in `DAY_GAMES` order: tape in the game's accent, the static `GameThumbnail`, kicker, name, tagline, then the existing `HubCardAction`. The thumbnail sits in a fixed square, so kickers and names line up across a row.
2. **One input.** The page sets `--card-count` on `.games`; the stylesheet derives the rest: `--rows: round(up, count / max, 1)`, `--per-row: round(up, count / rows, 1)`. Nothing else knows the count, and nothing is hard-coded.
3. **Wider than 768px**, a centred flex wrap. `--max-per-row` is 7 from 1280px and 4 between 769 and 1279px. Each card's basis is its exact share of the row less 0.1px, so a row never wraps early on a layout unit that rounds up. The 230px cap sits on the container, not the card: a capped card would let flex fit more cards on a line than `--per-row`.
4. **Up to 768px**, two columns; an odd last card spans both and lays out as a row, the only phone card that shows its tagline.
5. **The button and the done stamp share one box**, and the stamp shows the short result ("Feito 8:32"), so a card never changes height when the device's state arrives.

## Consequences

- **Deviation from #445's "one row up to 7" on desktop:** between 769 and 1279px the content box is 609–1119px, so seven cards would be 66–143px wide; that range takes 4 per row (today 4 + 3).
- No card is alone on a row from 2 to 12 cards. Rows are not always even (10 cards in the mid range are 4 + 4 + 2; 16 on a wide screen are 6 + 6 + 4), and 13 cards in the mid range leave one alone (4 + 4 + 4 + 1): revisit before the roster reaches 13.
- #446 (*Feitos hoje*) changes only which cards are in the grid and `--card-count`; the rule follows.
- A browser without CSS `round()` (before Chrome 125, Firefox 118, Safari 15.4) gets cards that wrap by their content width, uncapped.
- The hub ships no new client JS; the long result ("em 8:32") and its messages are gone.

## Rejected

- **Computing the row length in TypeScript** and passing it as two properties: the maximums would live in TS and the breakpoint in CSS, and #446's count is only known on the device.
- **A grid with fixed tracks**: it cannot centre a short last row for every count without one rule per remainder.
- **Seven per row at every desktop width**: cards under ~140px clip "Cruzadinha" and the done stamp.
