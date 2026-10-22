# ADR-0150 — Free-play Campo Minado keeps a best time per level on the device, and offers a Personalizado size

**Status:** Accepted — 2026-10-22 (issue #425)
**Depends on:** [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md), [ADR-0136](./0136-campo-minado-free-play-screen.md), [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md)
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 4 and its rejected persistence namespace, [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md) decision 2 and [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 1 (free play also writes `miolos-minesweeper`); [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decision 1 (`T-WEB-S374` allows `localStorage` in a second named store); [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md) decision 5 (a fourth, custom size); [ADR-0136](./0136-campo-minado-free-play-screen.md) decisions 2, 3 and 5, and its clause that this screen's copy lives in `minesweeper/messages.ts`; [ADR-0018](./0018-i18n-is-an-in-repo-typed-message-module.md) (a second split copy module, `minesweeper/free-messages.ts`).

## Context

Fernando answered "sim" to both Windows features left out of #373: best times and a custom size (2026-10-22, the "Perguntas das issues abertas" project thread). Free play wrote nothing but the settings, and the screen sized only three fixed boards.

## Decision

1. **Best times.** A won game on Iniciante, Intermediário or Especialista keeps its time, in whole seconds (`Math.floor(elapsedMs / 1000)`, what the card shows), when strictly faster than the stored one. A first open that wins records 00:00. The result card says "Novo recorde!" for a new best, otherwise "Melhor tempo: mm:ss" on a win or a loss. Nothing leaves the device; streak, statistics and medals are untouched.
2. **Storage.** One unversioned key, `miolos-minesweeper`: `{ best?: {beginner?, intermediate?, expert?}, custom?: {rows, columns, mines} }`, parsed by Zod with `.catch` per field (`free-play/minesweeper-store.ts`). Each write re-reads the key and changes one field. It is not `miolos-settings`: a best time is not a setting, and settings will sync to the account (#317).
3. **Read at deal, write at the win.** The level's best is read when a game is dealt and carried in the reducer (`MinesweeperPlay.best`); an effect writes it at the win, only when faster, so a re-run writes nothing. No storage value reaches server-rendered markup: the Personalizado chip's name is fixed text and the size form mounts only after a deal.
4. **Personalizado** is a fourth *Nível* chip. It deals the last custom size at once (first time 9×9, 10 mines); a form under the chips takes Linhas, Colunas and Minas, and *Jogar* deals without a confirm. Windows' limits live in the engine (`MINESWEEPER_CUSTOM_LIMITS`, `customMinesweeperSize`): rows 9–24, columns 9–30, mines 10 to (rows−1)×(columns−1); out of range is clamped, empty or non-numeric is the minimum, fractions truncate. Custom games keep no best time. The last level is not remembered.
5. **Layout.** A `display: contents` wrapper (`.customSize` in `minefield.module.css`) sets `--rows` and `--columns` inline, and the floor, the well's minimum height, the aspect and the maximum derive from them, so one rule sizes every custom board. A custom board never turns: container queries cannot read `var()`. A wide one scrolls sideways in its well under ADR-0136's 24px floor. The finished field gets the same variables.
6. **Copy.** The level and custom copy lives in `minesweeper/free-messages.ts`, under ADR-0018's contract and out of the daily's graph (`T-WEB-S1052`): the daily stops shipping the level names.

## Consequences

- A best time on one device is not a ranking, a balance or a level: it is overwritten, never compared between players, never sent (ADR-0006 holds).
- Best times are per device and per browser; clearing site data loses them, and they never sync.
- A tall custom board makes the page, not the well, scroll.

## Rejected

- **Folding best times into `miolos-settings`:** they would sync with #317 and mix with preferences.
- **Milliseconds:** the card shows seconds, so a "new best" could look equal to the old one.
- **A best time per custom size, a best-times list, or a reset:** not asked for.
- **A JS-computed turn for custom boards:** ADR-0103 sizes in CSS, and container queries cannot read `var()`.
- **A versioned schema, or reading storage at render:** per-field `.catch` already degrades; render reads would break hydration.
