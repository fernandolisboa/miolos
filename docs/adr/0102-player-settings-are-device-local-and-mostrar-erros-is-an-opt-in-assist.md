# ADR-0102 — Player settings are device-local, and *Mostrar erros* is an opt-in assist

**Status:** Accepted — 2026-10-13 (issue #300)
**Depends on:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0079](./0079-the-theme-is-a-device-preference-applied-before-paint.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md)
**Supersedes in part:** [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md) decision 5 and its Rejected bullet *"A per-cell 'this is wrong' state, in any colour"*; [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md) decision 5's clause *"forbidden under any framing that arrives at it"*. Both for the opt-in case only.

## Context

Fernando asked for settings that belong to the player: general ones, chosen by us, and per-game ones, starting with *Mostrar erros* and a Sudoku digit lock. Most players are signed out, and apps/web's database role can read only `daily_puzzles` (ADR-0026), so an account-backed setting needs an apps/api route, a new table or column, a migration Fernando runs by hand, and rules for merging two devices.

ADR-0037 and ADR-0032 forbade any per-cell check against the solution on the Nonogram, because it hands the player the picture one wrong move at a time. That stays true; what changed is that the owner wants the player to be able to ask for it.

## Decision

1. **Settings live on the device**, in one `localStorage` key (`miolos-settings`) read through Zod with a per-field fallback (`apps/web/src/settings/settings.ts`). Every mounted screen reads them through `useSettings`; the server render uses the defaults. Account sync is deferred to its own issue.
2. **v1 settings:** *Mostrar cronômetro* for every game with a clock (on); *Mostrar erros* per grid game (off); for Sudoku, *Número fixo com toque duplo* (off) and *Destacar linha, coluna e bloco* (on). Termo has none. They are shown in the *Jogos* section of Ajustes and in each grid game's *Ajustes* dialog, and each can be switched off where it was switched on.
3. ***Mostrar erros* is an unlimited assist, not a hint.** A cell is wrong when its entry is not null and differs from the solution (`wrongCells` in `apps/web/src/play/grid-hint.ts`, the same predicate the hint uses to correct an entry). It is derived on the device from the solution the client already has (ADR-0027, ADR-0086), never recorded, never sent, and never touches the hint count, the streak, the stats or the medals.
4. **A wrong cell has its own mark,** a corner flag (`apps/web/src/play/wrong-mark.tsx`) distinct from the rule rings, because Conflito stays a check against the rules and never against the solution.

## Consequences

- With the setting off, every board behaves as ADR-0037 and ADR-0032 describe. ADR-0032's progress meter still counts fills.
- A completion played with errors shown looks like any other. Accepted, because nothing is ranked (ADR-0006).
- A player who changes device or clears site data loses their settings, as with the theme.
- Free play reads device storage for the first time (`T-WEB-S374` allows exactly `settings.ts`).

## Rejected

- **An account table now:** a hand-run migration and merge rules for a feature whose value is per device; signed-out players need device storage anyway.
- **Counting *Mostrar erros* as a hint:** the owner framed it as a display setting, and a metered oracle would still be an oracle.
- **Reusing the rule ring for wrong cells:** a conflict pair where only one cell is wrong would look unchanged.
