# ADR-0120 — A win glows across the board before the result, and a loss drops heavily

**Status:** Accepted — 2026-10-15 (issue #357)
**Depends on:** [ADR-0028](./0028-daily-play-routes-and-the-conclusion.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md)
**Supersedes in part:** [ADR-0034](./0034-the-completion-celebration-renders-in-the-conclusion.md) decision 1's *"never as an animation on the play board"*, its Rejected *"Holding the play view open on a timer"* and consequence (a)'s one-frame board, for a win that just ended; [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 9's *"Nothing on this screen is a `@keyframes` animation"*; [ADR-0043](./0043-the-conclusion-has-a-fourth-state-and-it-is-a-loss.md) decision 3 again, for a loss that just ended; [ADR-0118](./0118-a-game-that-just-ended-presses-or-runs-the-stamps-ink.md) decision 1's loss half, decision 4, its Rejected *"Animating the solved board"*, and its consequence that the screens import only `just-ended.ts`.
**Amends:** ADR-0028 decision 2 (the swap waits for the glow); `PRODUCT.md` §3 and `DESIGN.md` § Motion.

## Context

Fernando liked the win stamp from ADR-0118 and asked for more: on a win, the board's cells should glow in a circle from the last cell entered, before the result appears. On a loss, no board motion. He judged the loss flourish (a sag and three drips) weak and amateur.

ADR-0034 kept the board still for two reasons: holding the view would fork each game's screen, and it would race the clock freeze. Both are gone. `DailyScreen`, `ArchiveScreen` and the free-play boards share one wrapper, and the hold starts only once `isClosedAndFrozen` is true, so the stamped time is already final.

## Decision

1. **`EndingStage` (`play/ending-stage.tsx`) wraps every play view.** It is a `display: contents` frame in both the playing and the glowing state, so the board never remounts. When the game is over and won, and the end animation can run, it keeps the board for one glow. Then it renders the ending: the conclusion, the late result or the free-play card. In every other case it renders the ending at once: a loss, a revisit, the setting off, `prefers-reduced-motion`, or no `matchMedia`.
2. **The glow is paint only.** Each `[data-cell-index]` cell gets a `--wave-delay` from its distance to the origin, from 0 up to 700 ms at the farthest cell. Its background flashes `--accent` and its glyph flashes `--ink-on-accent`, with no transform, because Nonogram and Rainhas have no gap between cells. The Cruzadinha's black squares (`data-block`) stay dark. The frame is `inert` while it glows, and the Sudoku, Binairo and Cruzadinha entry reducers ignore entries once solved (Nonogram and Rainhas already did), so nothing un-solves the board. The result appears on the farthest cell's `animationend`, or after 3 s if no animation ends.
3. **The origin is the last cell the player touched.** The frame records it on capture: the cell under a press or the last cell a drag passed over, or the selected cell when a key or the keypad was used. Termo marks the last tile of its last row with `data-wave-origin`, and its `--wave-lead` waits out the row reveal, computed from the same `--reveal-stagger` the reveal uses. With no record, the glow starts from the board's middle. On Termo the wash briefly hides which tiles were correct; each tile returns to its own colour before the result.
4. **A loss drops heavily.** The grey stamp falls from `scale(1.6)` on an ease-in with no overshoot. It lands, rocks about its base, and comes to rest, while four short grey strokes kick out along the desk. There is no accent and no `--ease-settle`: the stamp lands rather than settles.

## Consequences

- The `endAnimation` switch and reduced motion cover the glow too. Its hint copy now names both parts.
- The win glow adds about 1.2 s before the result, or about 1.6 s on Termo with the reveal. The time and the record are written before it starts.
- `DailyScreen`, `ArchiveScreen` and the six free-play boards import `ending-stage.tsx`, which reads the settings.

## Rejected

- **A glow on a loss.** Fernando asked for none.
- **Treating the glow as the reveal.** ADR-0034's Rejected in-place reveal still stands: the glow is a flourish that no reload replays, and the payoff stays in the conclusion.
- **Scaling the cells.** It paints over neighbours on gapless boards.
- **Origin from focus or `tabindex` alone.** Binairo has no roving focus, iOS does not focus a tapped button, and the Cruzadinha cursor moves on after each letter.
