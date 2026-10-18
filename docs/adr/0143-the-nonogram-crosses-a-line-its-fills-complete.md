# ADR-0143 — The Nonogram crosses a line its fills complete

**Status:** Accepted — 2026-10-18 (issue #402)
**Depends on:** [ADR-0104](./0104-a-nonogram-clue-number-is-struck-when-the-marks-place-it.md), [ADR-0105](./0105-rainhas-fades-what-holds-a-queen-and-auto-crosses-on-request.md), [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md), [ADR-0128](./0128-the-three-mistake-limit-is-a-local-opt-in-challenge.md)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 2; [ADR-0104](./0104-a-nonogram-clue-number-is-struck-when-the-marks-place-it.md)'s whole-line consequence; [ADR-0101](./0101-the-grid-game-hints-reveal-the-next-logical-step.md) decision 1; [ADR-0126](./0126-undo-steps-back-one-gesture-in-memory-never-past-a-hint.md) decision 3; [ADR-0132](./0132-the-coloured-nonogram-is-a-free-play-variant-loaded-on-demand.md). Departs from [ADR-0105](./0105-rainhas-fades-what-holds-a-queen-and-auto-crosses-on-request.md) decision 5 on persistence.

## Context

Fernando asked (#402) that a Nonogram row or column whose fills complete its clue get ✕ on the rest of its cells, right or wrong, with choices in Ajustes for a wrong line. The daily, the archive, Clássico and Cores free play share one board model, and `/nonogram` has little bundle headroom.

## Decision

1. **A line forms its clue** when the maximal runs of its fills equal the clue, in order (`formsClue` in `packages/games/src/nonogram/placed.ts`, also `placedRuns`' whole-line branch). In Cores an undecided cell reads as 0 and `coloredRuns` must equal the clue's tones and lengths.
2. **The transition crosses.** After a move that changes `entries`, each line that did not form its clue before and does after sets its undecided cells to ✕ and owns them (`apps/web/src/nonogram/line-cross.ts`; rows are owners 0..n-1, columns n..2n-1). A line with no runs never claims. The solving move crosses nothing. `restore` and Recomeçar clear the claims and measure no transition, so turning the setting on mid-game crosses no line that already formed.
3. **Ownership is ADR-0105 d5's**, lifted into `apps/web/src/play/auto-cross.ts`: after every change, a claimed cell the player changed is theirs; else it keeps the owners that still form their clue and clears when none is left. Release runs in every mode, *Desligado* included.
4. **The setting** `settings.games.nonogram.lineCross`, *Marcar ✕ ao completar a linha*: *Sempre* (`always`, the default) never reads the solution; *Sempre e mostrar o erro* (`flag`) crosses the same way and flags, with `WrongMark`, the `wrongCells` of every line that forms its clue; *Só se estiver certa* (`correct`) crosses only when every fill of that line equals the solution, and never without a solution; *Desligado* (`off`). One reducer per mode is built once; `always` and `flag` share one.
5. **The ✕ ride the move.** They are written inside the reducer `undoable` wraps and `autoCrossed` joins the Nonogram snapshot, so one undo reverts a move and its ✕, and a drag stays one step. They are crosses, so the mistake limit never counts them.
6. **The hint corrects a wrong fill before a wrong ✕** (`nextPictureHint`), for both variants: a wrong fill crosses solution cells, and those ✕ must not be fixed first.
7. **Claims are in memory only.** No `playRecordSchema` change, to keep `/nonogram`'s bytes. After a reload the old automatic ✕ are the player's.

## Consequences

- By default the whole-line deduction ADR-0104 accepted is now written for the player, even with *Riscar números resolvidos* off. The capped hint is unchanged; the streak, the stats and the medals are untouched.
- *Mostrar o erro* and *Só se estiver certa* read the solution the client already holds, like *Mostrar erros* (ADR-0102 d3).
- `/nonogram` measured 51.1 KB (budget 50); it rises to 52 KB, the minimum whole step, under Fernando's standing approval of budget raises (2026-10-16). `/modo-livre/nonogram` (75.6 of 76) and `/arquivo/[data]/nonogram` (46.0 of 48) fit.
- Settings with a choice share one row driven by a table in `game-settings.tsx`; its options wrap below the text when they do not fit.

## Rejected

- **Persisting the claims as Rainhas does:** a schema change and record bytes on the daily route for a convenience that a reload can drop.
- **Crossing every formed line on each move:** it would bring back a ✕ the player had cleared.
- **Off by default:** `always` reads only the marks and the public clue, the same whole-line fact the strike, on by default, already shows.
