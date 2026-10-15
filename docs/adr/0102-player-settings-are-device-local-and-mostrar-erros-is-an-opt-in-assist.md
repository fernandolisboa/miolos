# ADR-0102 — Player settings are device-local, and *Mostrar erros* is an opt-in assist

**Status:** Accepted — 2026-10-13 (issue #300)
**Depends on:** [ADR-0027](./0027-the-hint-is-computed-on-the-client.md), [ADR-0079](./0079-the-theme-is-a-device-preference-applied-before-paint.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md)
**Supersedes in part:** [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md) decision 5, consequence (e) and its Rejected bullet *"A per-cell 'this is wrong' state, in any colour"*; [ADR-0032](./0032-a-nonogram-is-finished-when-the-picture-is-painted.md) decision 5's clause *"forbidden under any framing that arrives at it"*. Both for the opt-in case only.
**Amended at #325:** decision 2 gains Binairo *Primeiro valor* (1 or 0, default 1), the first setting that is not a switch: a literal union with its own fallback, shown as two radios.
**Amended by:** [ADR-0105](./0105-rainhas-fades-what-holds-a-queen-and-auto-crosses-on-request.md) (#326) — decision 2 gains the three Rainhas switches.
**Amends:** [ADR-0046](./0046-free-play-routes-levels-and-the-ephemeral-session.md) decision 4 and [ADR-0096](./0096-recomecar-clears-the-board-and-never-refunds-the-hint-or-the-clock.md) decision 2 (free play reads and writes the settings key, and nothing else); [ADR-0078](./0078-the-free-play-wall-is-proved-on-the-runtime-module-graph.md) decision 1 (`T-WEB-S374` allows `localStorage` in `settings.ts` only); [ADR-0042](./0042-the-termo-board-is-read-only-output.md) decision 3 (its Sudoku premise holds only with *Número fixo* off); [ADR-0077](./0077-the-play-screen-chrome-is-one-component.md) (a second stateful child in the reset area, and the clock gated by a setting).
**Amended by:** [ADR-0104](./0104-a-nonogram-clue-number-is-struck-when-the-marks-place-it.md) (#324) — decision 2: the Nonogram also has *Riscar números resolvidos* (on).
**Amended by:** [ADR-0118](./0118-a-game-that-just-ended-presses-or-runs-the-stamps-ink.md) (#353) — decision 2 gains *Animação no fim do jogo* (on) for every game, Termo included, in the general group, which now shows in every dialog; Termo has no dialog, so its switch is in Ajustes only.
**Amended by:** [ADR-0132](./0132-the-coloured-nonogram-is-a-free-play-variant-loaded-on-demand.md) (#372) — the *Mostrar erros* flag gains an edge stop in the label ink, so it reads on a tone fill (`T-WEB-S594`).

## Context

Fernando asked for settings that belong to the player: general ones, chosen by us, and per-game ones, starting with *Mostrar erros* and a Sudoku digit lock. Most players are signed out, and apps/web's database role reads only `daily_puzzles` (ADR-0026), so an account-backed setting needs an apps/api route, a table or column, a migration Fernando runs by hand, and rules for merging two devices. ADR-0037 and ADR-0032 forbade any per-cell check against the solution on the Nonogram; the owner now wants the player to be able to ask for it.

## Decision

1. **Settings live on the device**, in one `localStorage` key (`miolos-settings`) read through Zod with a per-field fallback (`apps/web/src/settings/settings.ts`), and read everywhere through `useSettings`; the server render uses the defaults. Free play reads it and writes it only from a switch; nothing else of free play is stored. Account sync is #317.
2. **v1 settings:** *Mostrar cronômetro* (on) for every screen with a clock; *Mostrar erros* per grid game (off); for Sudoku, *Número fixo com toque duplo* (off) and *Destacar linha, coluna e bloco* (on). Termo has none. They are in Ajustes' *Jogos* card and in each grid game's *Ajustes* dialog (`GameSettingsButton`, beside `ResetControl` in `PlayScreenChrome`); each can be switched off where it was switched on.
3. ***Mostrar erros* is an unlimited assist, not a hint.** A cell is wrong when its entry is not null and differs from the solution (`wrongCells` in `apps/web/src/play/grid-hint.ts`, the predicate the hint's correction uses). It is derived from the solution the client already has (ADR-0027, ADR-0086), never recorded or sent, and never touches the hint count, the streak, the stats or the medals. It is drawn as its own corner flag (`WrongMark`), on top of the rule rings, because Conflito stays a check against the rules; its paper band carries it where red meets the Nonogram's terracotta (`T-WEB-S594`).
4. **The locked digit is a sticky input mode,** like the Nonogram brush: `locked` in the Sudoku reducer, never in the play record, kept by Recomeçar. Only two pointer taps (`event.detail > 0`) on one keypad digit within 300 ms lock it, and the second tap undoes the first; keys and keyboard activation never lock. Two pointer taps on one board cell showing a digit (a given or an entry) lock that digit the same way, or release it when it is the locked one; the pair never changes an entry, and a third quick tap is ignored (#323). Digits carry `aria-pressed` only while the setting is on.

## Consequences

- With every setting at its default, the boards behave as ADR-0037, ADR-0032 and ADR-0042 describe. ADR-0032's progress meter still counts fills.
- With *Mostrar erros* on, the hint's correction step is free. Fernando chose this on #300; ADR-0006's grant economy is untouched.
- A completion played with errors shown looks like any other; nothing is ranked (ADR-0006). A player who clears site data loses their settings, as with the theme.

## Rejected

- **An account table now:** a hand-run migration and merge rules, while signed-out players need device storage anyway.
- **Counting *Mostrar erros* as a hint,** and **reusing the rule ring** (a conflict pair with one wrong cell would look unchanged).
