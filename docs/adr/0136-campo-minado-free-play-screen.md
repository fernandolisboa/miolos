# ADR-0136 — Campo Minado is a free-play screen with Windows' levels, a clock and a counter, and no hint, undo or Recomeçar

**Status:** Accepted — 2026-10-15 (issue #373)
**Depends on:** [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md), [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md), [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 1 (`/modo-livre/campo-minado`), decisions 2 and 3 (Windows' three levels, default Iniciante where the others default to Médio, one seed per game) and decision 6 (this game has a clock); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (the chrome's game widens to Campo Minado, the hint is optional, the confirm copy comes from the screen); [ADR-0095](./0095-three-free-hints-per-puzzle.md) decision 2 and [ADR-0098](./0098-the-free-hint-allowance-is-a-remote-config-key-under-a-wire-ceiling.md) (no hint here); [ADR-0103](./0103-boards-size-from-the-space-they-have-not-from-fixed-cells.md) decision 3 (a game may keep a floor by scrolling inside the well); [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md) decision 3 (activation opens a cell; `keyMove` and `movedSelection` take rows and columns); [ADR-0094](./0094-the-secondary-mouse-button-writes-the-opposite-mark.md) decision 1 (here the middle button, and both buttons together, chord, and a long press flags); [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 2 (the setting *Marcas (?)*); [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) (this game has no undo); [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md) (this screen's copy lives in `minesweeper/messages.ts`).

## Context

Fernando asked for the classic Windows Minesweeper, "same features, same way to play" (#373). The engine is ADR-0133. The screen has to fit a game with no solution to check, a clock and a mine counter into a chrome built for daily puzzles, and a 30-column board onto a phone.

## Decision

1. **`FreePlayGame` is `Game | "minesweeper"`**, defined in `free-play/catalog.ts`. `GAMES` in `packages/core` does not change, so no daily route, archive, streak, medal or statistic can name Campo Minado. The daily chrome stays closed (`DailyChromeGame`); `PlayScreenChrome` and `FreePlayChrome` take `PlayChromeGame`, derived from `FreePlayGame`.
2. **No hint, no undo, no Recomeçar.** A hint needs a solution a player could be pointed at; a Windows field can force a guess (ADR-0133). *Novo jogo* takes the reset slot, behind the same confirm, with its own words (`resetCopy` in the readouts); it is idle until the first open. Choosing another level mid-game deals it without a confirm, as Windows does; choosing the level already shown does nothing.
3. **The clock and the mine counter are part of the game.** The clock starts at the first open and stops at the end (a first open that wins never starts it); *Mostrar cronômetro* hides it, and the card shows the final time either way. The counter is mines minus flags and may go negative. Neither is stored: free play still writes nothing.
4. **Input follows Windows.** Left click or tap opens, or chords on an open number; right click cycles the mark; middle, or both buttons, chord on release; a long press (350 ms) flags; *Abrir | Bandeira* under the board turns a tap on a closed cell into a flag, and a tap on an open number still chords. Marks (?) are a device setting, off by default.
5. **A playable cell is never below 24px.** The floor is 25px a cell (the cell and the gap after it) plus the card's chrome. When the board does not fit, it keeps its size and scrolls sideways inside its own well; the page and native pinch zoom are untouched. Below 1280px, when the well is narrower than 30 cells (785px), Especialista turns into 16 columns by 30 rows. From 1280px it stays landscape and overhangs its column into the gaps beside it. The shared sheet gains one no-op custom property, `--board-floor-side`; the scrolling and the shadow's room live in `minesweeper/minefield.module.css`. The finished field on the result card is a picture, not a target: it shrinks to fit the card and turns 16×30 when the card is 390px or narrower.
6. **The keyboard follows what is drawn.** At each key the board reads its computed `grid-auto-flow` and moves in the turned view's rows and columns; `data-cell-index` is always the board index. A cell's spoken row and column are the board's, not the drawn ones; they follow DOM order, which is what a screen reader walks.
7. **The eight numbers have their own colours** (`--mine-1…8`, the Windows family), each measured at 4.5:1 on the open cell in both themes (`T-WEB-S883`). This is the one place a literal colour carries meaning; DESIGN.md records it.

## Rejected

- **Adding `minesweeper` to `GAMES`:** every daily table, route list and statistic would grow a game that has no daily puzzle.
- **Fitting the board to the width:** Especialista falls to 12px cells on a phone, below any touch target.
- **JavaScript sizing, or `(orientation: portrait)`, for the turn:** ADR-0103 sizes in CSS from the space a board has, and portrait says nothing about the well's width.
- **Panning or pinch inside the board:** it fights the browser's own zoom and the page scroll.

## Consequences

- Ctrl/⌘+Z does nothing on this screen.
- Fast times are not comparable between devices or kept anywhere; a server would have to replay moves (ADR-0133).
- A game that outgrows its well sets `--board-floor-side` and styles its own well; the other games set nothing and render as before.
- The copy is a module of its own, not part of `messages.ts`: moving it there measured +741 bytes of first-load JS on 31 of the 37 routes, and +212 on this one.
