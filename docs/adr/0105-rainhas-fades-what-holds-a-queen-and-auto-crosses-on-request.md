# ADR-0105 — Rainhas fades what holds a queen, and crosses for the player on request

**Status:** Accepted — 2026-10-14 (issue #326)
**Depends on:** [ADR-0090](./0090-rainhas-is-a-planted-grown-region-map-graded-by-a-deduction-ladder.md), [ADR-0101](./0101-the-grid-game-hints-reveal-the-next-logical-step.md)
**Supersedes in part:** [ADR-0092](./0092-the-rainhas-board-tap-cycles-drag-crosses-conflicts-show.md) decision 4 and its Rejected bullet *"Auto-X around each queen"*, for the opt-in case only.
**Amends:** ADR-0092's consequence on the hint order (decision 6 below); [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 2 (three Rainhas switches join the v1 list).

## Context

Fernando asked for the Sudoku highlight on Rainhas (#326). Two more assists came with it: show which lines and regions already hold a queen, and cross the cells a queen rules out. ADR-0092 rejected auto-X because it does the first tier of the deduction ladder for the player and would need a settings switch; ADR-0102 made the switch.

## Decision

1. **Three switches** in `settings.games.queens`: *Destacar linha, coluna e região* (on), *Esmaecer o que já tem rainha* (on), *Marcar ✕ automático* (off).
2. **The reach** tints the selected cell's row, column and region (`reachedCells` in `apps/web/src/queens/shading.ts`). It is hidden while a hint lights its unit, as on the Sudoku.
3. **The fade** washes every non-queen cell, ✕ included, that shares a row, column or region with any queen (`fadedCells`). It reads the board, never the solution: a wrong queen fades its lines too, and the conflict ring still flags it. It shows line and region membership only; the touch rule and every tier-2/3 deduction the ladder counts stay the player's.
4. **Queen cells take neither layer.** Both layers ride `background-image` over the region fill, so a conflict ring is always drawn on a bare region fill. On a spotlit cell, the hint's single layer replaces the wash while the hint is lit. `T-WEB-S457` measures the ratios and the visibility.
5. **Auto-✕ (the automatic X) is opt-in and owned.** A queen crosses the undecided cells it attacks (`queensAttackedCells` in `@miolos/games/queens`). Each automatic ✕ records the queens that claimed it (`autoCrossed`), and a queen placed later joins an existing claim. When a queen leaves, the cells that no queen still claims clear. A cell the player changes becomes theirs. The solving move crosses nothing. Turning the switch off crosses nothing new and still clears the existing ✕ with their queens. The claims ride the local play record, never the wire.
6. **The hint corrects a wrong queen before a wrong ✕** (`nextQueensHint`). With auto-✕, a wrong queen always crosses a solution cell, and that ✕ must not be fixed first.

## Consequences

- With auto-✕ off, which is the default, the weekday ramp ADR-0090 grades is unchanged: the graded steps are the player's.
- With auto-✕ on, it is an unlimited assist like *Mostrar erros*. Hints, the streak, the stats and the medals are unchanged.

## Rejected

- **Hover as a second trigger for the reach:** a touch screen has no hover, and with a mouse every click already selects.
- **"Any queen still attacks it" as the rule for keeping a ✕:** it would bring back a ✕ the player had cleared.
