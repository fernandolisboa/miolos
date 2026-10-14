# ADR-0103 — Boards size from the space they have, not from fixed cells

**Status:** Accepted — 2026-10-13 (issue #303)
**Depends on:** [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md), [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md), [ADR-0042](./0042-the-termo-board-is-read-only-output.md), [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md), [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md)
**Supersedes in part:** [ADR-0035](./0035-the-nonogram-board-is-a-ruled-continuous-field.md) decisions 5 and 6, and [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 6 geometry: pixel cells, the 1140px fold, the Termo card cap and `--board-mobile-max`. Two values change with them: the Termo keyboard rows go 52px to 48px (desktop `margin-top` 30px to 20px), and the Nonogram mobile brush control 60px to 48px tall. The 552px/350px Termo keyboard widths and the 13.203px clue floor stand.
**Amends:** ADR-0035 decision 7 (its exemption stands, the control height above changes); [ADR-0029](./0029-shared-daily-play-layer-in-apps-web-src-play.md) (`BoardCard` takes the controls as a node); [ADR-0041](./0041-accents-colour-shapes-never-words.md) consequence (d) (the kickers hide at 1023px on the play screen, 1140px on the conclusion).

## Context

Every board had fixed desktop cells (52px; Nonogram 52/52/48/32) and a ~350px phone cap. Fixed cells could not shrink, so one shared fold had to sit above the widest board: Binairo needs `80 + 330 + 72 + (8×52 + 7×4 + 2×16 + 2) + 80 = 1040px`, Sudoku `80 + 330 + 72 + 546 + 80 = 1108px`, so the shared sheet folded at 1140px. Below it the two-column layout overflowed, and neither scanned viewport (1440×900, 390×844) lies in that band, so CI could never catch it. ADR-0035 decision 6 kept that fold rather than move it to 1421px for one 15×15 weekday. The cost: tablets got a ~350px board in a 728px column, desktops a 314px Termo, Sudoku (928px tall at 390×844) pushed *Usar dica* below the fold, and Recomeçar reserved 104px.

## Decision

1. **A board is the largest square its column and the viewport allow, up to a per-game ceiling.** `BoardCard` (`play/board-card.tsx`), shared page-frame JSX that takes the controls as one node (`below`), wraps the card in `.boardWell`, a size container that takes the height the section leaves over. `--board-side = min(100cqi, (100cqb − --board-below) × --board-aspect, --board-max)`. Controls drawn under the card (Sudoku keypad, Binairo digits, Nonogram brush, Rainhas affordance; the Cruzadinha: decision 8) sit inside the well and declare their height in `--board-below`; Nonogram adds the worst-case clue-rail overhang, Termo `--board-aspect`. Games set only custom properties on their page class (ADR-0029). Replaces ADR-0035 decision 5 and ADR-0042 decision 6's pixel cells.
2. **Cells are fractional.** Tracks are `minmax(0, 1fr)`, squared by `aspect-ratio`; cell fonts clamp from `--board-side` with a 14px floor. Nonogram clue numerals stay 11px.
3. **The floor is `--board-min`, 280px:** the board a 320px phone already gets (the Cruzadinha: decision 8). A game may restate it as a height (Termo `--board-min: 338px`, the card's height at 280px wide). Every board keeps a cell of 24px or more there, except Nonogram 10×10 and 15×15, whose ADR-0035 decision 7 exemption stands; 15×15 keeps its 13.203px two-digit clue floor. Shorter viewports scroll rather than shrink a board.
4. **One fold, at 1024px.** Two columns `clamp(280px, 26vw, 330px) minmax(0, 1fr)`, gap `clamp(48px, 5vw, 72px)`, padding `clamp(40px, 6vw, 80px)`; 1440px reproduces 330/72/80; between the ends the clamps resolve off the 4pt scale (51.2px gap at 1024px), accepted. Below it, one column. This ends the 1140px fold of ADR-0035 decision 6: its reason, cells that cannot shrink, is gone. The conclusion page keeps its own 1140px fold (`conclusion-view.module.css`), so ADR-0041's kickers hide at 1023px on the play screen and at 1140px there.
5. **The page measures `100svh`,** so a collapsing mobile URL bar never resizes a board.
6. **Recomeçar reserves one 44px target.** The confirm opens downward over the hint, inside the space the two rows already take, and the hint is `visibility: hidden` while it is open. ADR-0096's behaviour and DOM order are unchanged.
7. **The hint explanation has a reserved slot** on the `aria-live` wrapper (`.hintSlot`): three lines up to 1023px wide when the viewport is 800px tall or more, two lines from 1024px. From 390×844 up, revealing a hint neither moves nor resizes a board. On shorter screens it may push the page to scroll a little.
8. **The Cruzadinha's clue list sits beside its grid when the board column is 640px or wider, and folds behind a *Pistas* button below that** (a `crossword` container query; `CrosswordLayout` in `crossword/board-view.tsx` places every slot). Its clue row and keyboard sit under the well, outside `--board-below`; its floor is 200px (5×5 cells stay at 29px or more), so the phone keyboard fits under it. The clue bar always reserves two lines, so a wrapping clue never resizes the board; the lexicon caps clues at 44 characters (`packages/games/test/crossword/lexicon.test.ts`), which wrap to two lines at a 360px phone. Opening the list shrinks the board to its floor and the page may scroll; choosing a clue folds it again.

## Consequences

- Sudoku at 1280×800 goes from 550 to about 490px so its keypad and hint fit; Termo at 1024×768 is bound by the keyboard stack under it, not by the width.
- jsdom has no layout, so the rules are pinned as stylesheet text (`T-WEB-S596…S604`, `apps/web/test/board-sizing.test.tsx` and `crossword-screen.test.tsx`, plus each game's geometry suite). The real geometry is not a CI gate.
- `--board-below` is a maintained mirror of the rows each game draws under its card. It drifts when a row changes; a well whose content overflows it is how to catch that.
- Sudoku's desktop keypad mirrors the board's columns but is never narrower than nine 44px targets, so under a 474px board the digits no longer sit under their columns.
- Termo's `--board-aspect` is 0.83, under the 0.841–0.845 the card measures, so the rotated card stays inside the well.

## Rejected

- **Moving the fold to 1421px** (ADR-0035) to keep 52px cells: three games re-laid out for one weekday, in a band no gate visits. Cells that shrink make it unnecessary.
- **Sizing the board with JavaScript** (a resize observer): a flash of unsized board, and layout logic the stylesheet already expresses.
- **A constant for the rest of the page** (header, hint, padding): it drifts the first time any of them changes. The flex space left over is exact; only the rows under the card are mirrored.
- **The Cruzadinha's clue list always open under the keyboard:** it pinned the board to its floor and pushed *Usar dica* off every phone (1372px tall at 390×844).
