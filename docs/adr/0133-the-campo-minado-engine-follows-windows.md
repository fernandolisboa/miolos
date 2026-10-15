# ADR-0133 — The Campo Minado engine follows Windows and is not logically solvable

**Status:** Accepted — 2026-10-15 (issue #373)
**Depends on:** [ADR-0011](./0011-free-play-is-generated-on-the-client.md), [ADR-0019](./0019-per-game-subpath-exports-in-packages-games.md), [ADR-0008](./0008-completion-and-streak-semantics-across-play-modes.md)
**Amends:** [ADR-0023](./0023-proved-not-sampled-property-testing.md) — for Campo Minado only, "every puzzle solvable" and "every puzzle unique" do not bind; seed → field stays deterministic, and the construction invariants below are proved.

## Context

Fernando asked for classic Windows Minesweeper, "the same features and the same way to play" (issue #373). It is a free-play game: free play is generated on the client and records nothing, so no streak, medal or statistic depends on a field being fair. Classic Minesweeper can force a guess; that is part of the game he asked for. ADR-0023 and CLAUDE.md's gate say every generated puzzle is solvable, which a classic field is not.

## Decision

1. **`@miolos/games/minesweeper` is a pure state machine.** `newMinesweeperGame`, `openMinesweeperCell`, `chordMinesweeper` and `cycleMinesweeperMark` take a state and return the next one, so a native app reuses the rules whole. A finished game ignores every move.
2. **Mines are laid at the first open**, from the seed, over every cell but that one (`layMines`, `shuffleInPlace` over the other cells). The exact mine count, the safe first cell and the numbers hold by construction and are re-checked by property; seed and first cell → field is deterministic.
3. **Logical solvability is waived for this game only.** A field can force a guess, as in Windows. A no-guess generator is what a daily Campo Minado would need, if one is ever wanted.
4. **Windows' rules.** A 0 flood-opens its neighbours, never through a flag; a `?` cell opens and loses its mark. A flagged cell cannot be opened. A chord on an open number opens its unflagged neighbours only when the flags around it equal the number, so a wrong flag loses; `?` does not count as a flag. A loss keeps the flags and records the first mine hit in reading order; a win flags every mine. Marks cycle flag → hidden, with `?` between only when the player turns `?` on.
5. **Windows' three levels:** Iniciante 9×9 with 10 mines, Intermediário 16×16 with 40, Especialista 16 rows × 30 columns with 99. Not the weekday ramp.

## Consequences

- `GAMES` in `packages/core` does not change. The free-play screen, and how it reaches the free-play catalogue without opening the daily chrome, is #373's second PR with its own ADR.
- If best times are ever kept on a server, a client that holds the seed and the field can fake a win and its time; that would need a server replaying the moves, a different trust model from this one.
