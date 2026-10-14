# ADR-0104 — A Nonogram clue number is struck when the marks place it

**Status:** Accepted — 2026-10-14 (issue #324)
**Depends on:** [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0095](./0095-three-free-hints-per-puzzle.md), [ADR-0101](./0101-the-grid-game-hints-reveal-the-next-logical-step.md)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 2 (the Nonogram gains a second setting, on by default).

## Context

Fernando asked (#324) for a Nonogram row or column number to be struck once it is done, only when that is certain, and for it to be a setting. "Certain" can mean three things: the marks show the run, a line solver proves it, or the solution confirms it. The second hands out the same one-line deductions the hint gives, and the hint is capped (ADR-0095, ADR-0101).

## Decision

1. **The rule reads the marks and the public clue, never the solution** (`placedClues` and `placedRuns` in `packages/games/src/nonogram/placed.ts`). Walking in from each end, skipping crosses, every filled block closed on both sides by an edge or a cross whose length is the next clue number strikes that number; the walk stops at the first undecided cell, an unclosed block or a mismatch. If the line's filled blocks equal its clue exactly, every number is struck.
2. **A contradiction strikes nothing.** A fully decided line strikes all its numbers iff its blocks equal the clue, else none. A line with an undecided cell strikes none when the two walks together see more blocks than the clue has numbers.
3. **The setting is `strikePlacedRuns`, *Riscar números resolvidos*, on by default** (`apps/web/src/settings/settings.ts`).
4. **A struck number is drawn in `--ink-2` with a line-through** (`.clueNumberPlaced`), and the rail's label says "N feito". An empty line's "0" is never struck.

## Consequences

- A closed block in the middle of a line, not reached by either walk, stays unstruck until the walks or the whole-line match reach it.
- Marking toward the answer never unstrikes a number. A wrong mark can strike a number; the strike says the marks place it, not that they are right.
- It is not a hint: never recorded, never counted, no effect on the streak, the stats or the medals.

## Rejected

- **Forced placement (a line solver or a contradiction probe) as the rule:** always on, it would hand out unlimited one-line deductions, the ones the capped hint gives (ADR-0101, ADR-0095).
- **Reading the solution:** *Mostrar erros* already does that, opt-in (ADR-0102).
