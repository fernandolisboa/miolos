# ADR-0136 — Campo Minado is a free-play screen with Windows' levels, a clock and a counter, and no hint, undo or Recomeçar

**Status:** Accepted — 2026-10-15 (issue #373)
**Depends on:** [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 1 (a fourth literal segment, `/modo-livre/campo-minado`), decisions 2 and 3 (Windows' three levels, one seed per game) and decision 6 (this game has a clock); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (the chrome's game widens to Campo Minado, the hint is optional, the confirm copy is per game); [ADR-0095](./0095-three-free-hints-per-puzzle.md) decision 2 and [ADR-0098](./0098-the-free-hint-allowance-is-a-remote-config-key-under-a-wire-ceiling.md) (free play offers no hint here); [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md) decision 3 (a game may keep a floor by scrolling inside the well); [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md) decision 3 (activation opens a cell); [ADR-0094](./0094-the-secondary-mouse-button-writes-the-opposite-mark.md) decision 1 (on this board the middle button, and both buttons together, chord, and a long press flags).

## Context

Fernando asked for the classic Windows Minesweeper, "same features, same way to play" (issue #373). The engine is ADR-0133. The screen has to decide how a game with no solution to check, a clock and a mine counter sits in a chrome built for daily puzzles with hints and Recomeçar, and how a 30-column board fits a phone.

## Decision

1. **`FreePlayGame` is `Game | "minesweeper"`**, defined in `free-play/catalog.ts`. `GAMES` in `packages/core` does not change, so no daily route, archive, streak, medal or statistic can name Campo Minado. The daily chrome stays closed (`DailyChromeGame`); `PlayScreenChrome` and `FreePlayChrome` take `PlayChromeGame`.
2. **No hint, no undo, no Recomeçar.** A hint needs a solution a player could be pointed at; a Windows field can force a guess (ADR-0133). `hint` is optional in the chrome's readouts and `onUndo` may be absent. *Novo jogo* takes the reset slot, behind the same confirm, with its own words; it is idle until the first open.
3. **The clock and the mine counter are part of the game.** The clock starts at the first open and stops at the end; *Mostrar cronômetro* hides it, and the card shows the final time either way. The counter is mines minus flags and may go negative. Neither is stored: free play still writes nothing.
4. **Input follows Windows.** Left click or tap opens, or chords on an open number; right click cycles the mark; middle, or both buttons, chords on release; a long press (350 ms) flags; *Revelar | Bandeira* under the board turns a tap into a flag. Marks (?) are a device setting, off by default.
5. **A cell is never below 24px.** When the board does not fit, it keeps its size and scrolls sideways inside its own well; the page and native pinch zoom are untouched. Below 754px of well, Especialista turns into 16 columns by 30 rows, so a phone scrolls a short way sideways rather than a long way. The shared sheet gains no-op custom properties for this (`--board-floor-side`, `--board-overflow-x`, `--board-shadow-slack`).
6. **The keyboard follows what is drawn.** At each key the board reads its computed `grid-auto-flow` and moves in the turned view's rows and columns; `data-cell-index` is always the board index.

## Rejected

- **Adding `minesweeper` to `GAMES`:** every daily table, route list and statistic would grow a game that has no daily puzzle.
- **Fitting the board to the width:** Especialista falls to 12px cells on a phone, below any touch target.
- **JavaScript sizing, or `(orientation: portrait)`, for the turn:** ADR-0103 sizes in CSS from the space a board has, and portrait says nothing about the well's width.
- **Panning or pinch inside the board:** it fights the browser's own zoom and the page scroll.

## Consequences

- Campo Minado has no undo (ADR-0126 covers the five grid games). Ctrl/⌘+Z does nothing on this screen.
- Fast times are not comparable between devices or kept anywhere; a server would have to replay moves (ADR-0133).
- A game that outgrows its well now has a place to say so in CSS; the six existing games set none of the new properties and render as before.
