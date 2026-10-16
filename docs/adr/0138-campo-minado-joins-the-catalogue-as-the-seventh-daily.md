# ADR-0138 — Campo Minado joins the catalogue as the seventh daily

**Status:** Accepted — 2026-10-16 (issue #389)
**Source:** Fernando chose "Sim, diário" on 2026-10-16 in the "campo minado nao tem o diario?" project thread (the "A daily Campo Minado?" Done row in `docs/pending-fernando.md`).
**Depends on:** [ADR-0137](./0137-the-daily-campo-minado-field-never-needs-a-guess.md), [ADR-0086](./0086-the-cruzadinha-daily-ships-its-letters.md), [ADR-0091](./0091-rainhas-joins-the-catalogue-as-the-sixth-daily.md), [ADR-0004](./0004-no-unpublished-puzzle-reaches-the-client.md)
**Amends:** [ADR-0136](./0136-campo-minado-free-play-screen.md) decision 1, and reverses its rejection of "Adding `minesweeper` to `GAMES`"; [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md)'s "`GAMES` does not change" consequence; [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md) rule 3 (Termo and Campo Minado can end *played*); [ADR-0052](./0052-medals-are-derived-facts-plus-curated-grants.md) decision 7 (the quota table); [ADR-0091](./0091-rainhas-joins-the-catalogue-as-the-sixth-daily.md)'s T-CORE-S70 consequence; and the game counts in [ADR-0087](./0087-dia-perfeito-counts-the-dailies-published-that-day.md), [ADR-0051](./0051-statistics-are-read-time-derivations-on-closed-contracts.md), [ADR-0053](./0053-the-archive-is-a-public-past-only-read-and-a-late-write.md), [ADR-0047](./0047-bundle-markers-are-route-scoped.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0080](./0080-paper-dark-accents-lighten-under-a-paper-label.md) and [ADR-0129](./0129-dia-cheio-is-three-on-time-wins-in-a-day.md).

## Context

ADR-0137 gives Campo Minado a daily field that never needs a guess, so a loss is the player's mistake, not a coin toss. Fernando said yes to the daily, which ADR-0136 had kept out of `GAMES`. A minefield has no solution to submit: the field itself is the answer.

## Decision

1. **Campo Minado (`minesweeper`) is the seventh daily**, last in `GAMES` and `DAY_GAMES`, at `/campo-minado` with `/arquivo/<data>/campo-minado`.
2. **The projection ships the layout**, as the Cruzadinha ships its letters (ADR-0086): `dailyMinesweeperResponseSchema` is `{game, date, rows, columns, mines, start}`, 16 × 10 (`DAILY_MINESWEEPER_SIZE`), and the start's 3×3 holds no mine. `seed` and `weekday` are withheld; `stripDailyContent` picks by allowlist.
3. **The completion body is `{game, date, hit, elapsedMs, hintsUsed: 0}`**, with no grid: the client already holds the layout, so echoing it proves nothing. `hit: null` is a win; `hit` on a stored mine is a loss; `hit` on a safe cell is 422 `hit-mismatch`. The row is write-once like every other. Trust matches the Cruzadinha's.
4. **A loss is played** (ADR-0008 rule 3 now covers Termo and Campo Minado): it counts for no streak, time, Dia Cheio, Dia Perfeito or medal. No game-specific code does this; every derivation already reads only won rows.
5. **Timed, with no hint, undo or Recomeçar.** `TIMED_GAMES` gains it. The start is pre-opened, and the clock is the shared daily clock: the time visible since hydration.
6. **`minesweeper-30` follows `queens-30`.** The per-game quota rises to 4–7 and `termoGuessWins` narrows to exactly 3, so the maxima still sum to 30.
7. **The cron runs it third**, after Binairo (≈ 15 ms) and before the Nonogram (≈ 20 ms): its worst warm daily is ≈ 17 ms, ≈ 50 ms cold (ADR-0137). `COST_ASCENDING_GAMES` holds the order; `MAX_MINESWEEPER_SEED_RETRIES_PER_DATE` is 8, as for Rainhas.
8. **Web:** the daily is the free-play board (`Minefield`, *Abrir | Bandeira*) on a 10-column class whose width follows the well's height down to the 24 px-cell floor, then scrolls. A loss shows the *Jogado* stamp and shares as played (`isPlayedRecord`); the conclusion's one figure slot holds the finished field. The hub and stats grids rotate on six-step `nth-child` cycles and centre a short last row. The light accent is `#1E6E7C`, ΔE76 ≥ 25 from every other accent in both themes.

## Consequences

- Migration 0017 widens both `game in (...)` CHECKs. Fernando ran it on production on 2026-10-16, before this shipped.
- Inserting `minesweeper-30` at place 12 moves every later medal one place, so their static tilts (ADR-0122) shift once.
- Seven per-game medals is T-CORE-S70's maximum, and `termoGuessWins` is at its minimum. An eighth game needs a quota decision first.
- `all-games` stays on `ORIGINAL_GAMES`.

## Rejected

- **Echoing the grid in the completion**, as the plan first had: it carries nothing the server does not already store.
- **Server-judged opens:** a round trip per tap, for a field the client already holds.
