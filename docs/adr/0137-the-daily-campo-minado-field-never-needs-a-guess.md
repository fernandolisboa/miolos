# ADR-0137 — The daily Campo Minado field never needs a guess

**Status:** Accepted — 2026-10-16 (issue #389)
**Depends on:** [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0090](./0090-rainhas-is-a-planted-grown-region-map-graded-by-a-deduction-ladder.md)
**Amends:** [ADR-0133](./0133-the-campo-minado-engine-follows-windows.md) decision 3 — the waiver now covers free play only; [ADR-0023](./0023-proved-not-sampled-property-testing.md) — "every puzzle solvable" binds again for the daily field, proved from the start cell by an independent solver. Uniqueness follows: a field the solver clears by deduction has one mine layout consistent with what the player sees.

## Context

Campo Minado becomes a daily (#389): one field a day, the same for everyone, feeding the streak. A field that forces a guess makes the streak a coin toss, so the daily cannot reuse free play's Windows fields. A no-guess proof starts from a known cell, so the daily field comes with its first cell fixed. Whether the game joins the catalogue is the next ADR; this one covers the engine only.

## Decision

1. **`generateMinesweeperDaily({ seed, weekday })`** returns `{ seed, weekday, rows, columns, mines: (0|1)[], start }`. The field is 16 rows × 10 columns (`MINESWEEPER_DAILY_SIZE`), with `MINESWEEPER_WEEKDAY_MINES` ramping 20 on Monday by two to 32 on Sunday.
2. **Each attempt draws a sub-seed and a start cell from one seeded stream**, lays the mines with `layMines` around the start's 3×3, and keeps the field only if `validateMinesweeperDaily` passes. The start is any cell; at an edge its clearing is clipped. After 128 failed attempts it throws `MinesweeperGenerationError`. `layMines` now takes a set of safe cells; with one cell its output is byte-identical to before, so free play is unchanged.
3. **The validator** checks size, the weekday's exact mine count, a mine-free 3×3 around the start, that `startMinesweeper`'s flood leaves at least 40 safe cells closed (a quarter of the board, so a day is never won before the first move), and that `solveMinesweeper` (`minesweeper/solve.ts`, internal) opens every safe cell from the start.
4. **The solver is local:** the single-number rule, plus the subset rule between two numbers at most two cells apart. It reads only what a player sees, and plays through the engine's own `openMinesweeperCell` and `cycleMinesweeperMark`.
5. **The state carries `size`, not `level`**, and `seed` only while the mines are not laid. `minesweeperField` is the one routine that numbers a field.

## Measured (Node 24, 20,000 attempts per weekday; 10,000 seeds per weekday for times)

- Attempt success, Monday → Sunday: 72.2, 66.8, 57.9, 46.8, 34.7, 22.9, 13.8 %. Mean attempts 1.4 → 7.1; worst 8, 10, 12, 17, 20, 36, 51. P(128 Sunday failures) ≈ 5·10⁻⁹.
- Warm worst per generated daily: 4.6, 2.9, 4.1, 7.3, 7.2, 12.5, 16.8 ms (means 0.4 → 2.1 ms). Cold, the worst Sunday seed in a fresh process: 49 ms.
- The 40-cell floor costs 5.5 % of Monday's attempts and 0.005 % of Sunday's; a solved Monday field leaves a median 84 safe cells closed.

## Rejected

- **The global mine count in the solver:** one global step after the local rules stall gains 0.7–1.2 points of success per weekday, and a player would need to count the whole board to use it.
- **Only interior start cells:** 79.1 vs 77.7 % on Monday, 14.6 vs 13.8 % on Sunday; not worth the second rule.
- **A Windows level as the daily size:** Intermediário does not fit 360px at 24px cells, and Iniciante has no room for a ramp.

## Consequences

- `GAMES` does not change here. The catalogue (projection, completion, the *played* loss, the medal) is ADR-0138 in the next PR.
- Free play keeps Windows' fields and can still force a guess.
