# ADR-0104 — A Nonogram clue number is struck when the marks place it

**Status:** Accepted — 2026-10-14 (issue #324)
**Depends on:** [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0095](./0095-three-free-hints-per-puzzle.md), [ADR-0101](./0101-the-grid-game-hints-reveal-the-next-logical-step.md)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 2 (the Nonogram gains a second setting, on by default).

## Context

Fernando asked (#324) for a Nonogram row or column number to be struck once it is done, only when that is certain, and for it to be a setting. "Certain" can mean three things: the marks show the run, a line solver proves it, or the solution confirms it. The second hands out the same one-line deductions the hint gives, and the hint is capped (ADR-0095, ADR-0101).

## Decision

1. **A number is struck only from the marks and the public clue, never the solution** (`placedRuns` and `placedClues`, `packages/games/src/nonogram/placed.ts`). A closed block (edge or cross on both sides) reached from either end of the line through decided cells, in clue order, strikes its number; a line whose filled blocks equal its clue strikes every number.
2. **A line the decided cells alone contradict strikes nothing**: more filled cells than the clue's sum, a block longer than any number, more cross-separated groups of fills than numbers, or a fully decided line that is not its clue. None of these reads an undecided cell, so the rule never says what an undecided cell must be.
3. **It is the setting *Riscar números resolvidos* (`strikePlacedRuns`), on by default.**

## Consequences

- A closed block in the middle of a line, not reached from either end, stays unstruck.
- The whole-line match strikes blocks that are not closed, which tells the player the rest of the line is crossed. That is the one deduction it shares with the hint (ADR-0101 decision 4), accepted because the player can count it off the visible marks.
- A contradiction that only the undecided cells reveal (where nothing fits) can still leave a strike; finding it is a line solver's job.
- Marking toward the answer never unstrikes a number. A wrong mark can strike a number; the strike says the marks place it, not that they are right.
- It is not a hint: never recorded, never counted, no effect on the streak, the stats or the medals.

## Rejected

- **Forced placement (a line solver or a contradiction probe) as the rule:** always on, it would hand out unlimited one-line deductions, the ones the capped hint gives (ADR-0101, ADR-0095).
- **Reading the solution:** *Mostrar erros* already does that, opt-in (ADR-0102).
