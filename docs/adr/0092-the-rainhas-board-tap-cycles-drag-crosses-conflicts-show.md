# ADR-0092 — The Rainhas board: tap cycles, drag crosses, conflicts show

**Status:** Accepted — 2026-10-11 (issue #285)
**Depends on:** [ADR-0030](./0030-grid-games-are-composite-widgets-one-tab-stop-roving-focus.md), [ADR-0037](./0037-the-nonogram-board-is-a-three-state-brush-board.md), [ADR-0041](./0041-accents-colour-shapes-never-words.md), [ADR-0091](./0091-rainhas-joins-the-catalogue-as-the-sixth-daily.md)
**Amends:** ADR-0030 decision 3, for Rainhas only: `Enter`/`Space` activation cycles the cell instead of only selecting it.
**Amended by:** [ADR-0094](./0094-the-secondary-mouse-button-writes-the-opposite-mark.md) (#299) — decision 1 for the secondary button: a right click places or removes a queen; tap and left click keep the cycle.
**Superseded in part by:** [ADR-0105](./0105-rainhas-fades-what-holds-a-queen-and-auto-crosses-on-request.md) (#326) — decision 4 and the Rejected bullet *"Auto-X around each queen"*: the automatic X exists as an opt-in setting, off by default; the hint now corrects a wrong queen first.

## Context

A Rainhas cell has three states: undecided, crossed (an X the player rules out) and queen. The player marks far more cells than they crown, often in a sweep across a row or a region. The board has no givens, so the region map has to be readable without colour alone.

## Decision

1. **Activation cycles** undecided → crossed → queen → undecided: a tap, a click, or `Enter`/`Space` on the focused cell. `Board` in `apps/web/src/queens/board.tsx` sits on `useBinaryBoard`, the same composite widget and pointer stroke as the Nonogram board.
2. **A drag crosses.** `usePointerStroke` with `painting: true`; each undecided cell a stroke enters becomes crossed. A stroke never overwrites a queen and never clears.
3. **Keys:** arrows move and clamp, `Home`/`End` and `PageUp`/`PageDown` jump to the edges, `1` places a queen, `2` crosses, `0`/`Backspace`/`Delete` clear. The same key again clears the cell.
4. **No auto-X.** Placing a queen crosses nothing for the player.
5. **Conflicts show.** A queen that breaks a rule (`findQueensViolations`) gets a 3 px `--accent-app` inset ring and ", em conflito" in its accessible name. The rules are public, so this checks the rules and never the solution; ADR-0037 decision 5 is about the Nonogram only.
6. **Regions have three carriers:** a fill (`--queens-region-1…9`), a 2 px `--ink` boundary where the region changes (1 px `--line` inside a region), and "região N" in each cell's accessible name.
7. **Glyphs and rings are measured.** The queen and the X are `--ink`, at least 7:1 on every region fill in both themes; the conflict ring and the hint ring (`--accent`) are at least 3:1. No text is drawn in an accent colour. `T-WEB-S457` pins every ratio.

## Consequences

- Placing a queen takes two taps from undecided. Crossing takes one tap or one drag, which is the common act.
- The hint is `nextBinaryHint`: it fixes a wrong queen or an X on a queen's cell first, then places a queen.

## Rejected

- **ADR-0037 decision 1's sticky brush.** A brush makes the player switch modes between crossing and crowning, which they do every few moves here. The drag needs no mode, since it only ever writes one value, so the brush would add a control row and nothing else.
- **Auto-X around each queen.** It does the first tier of the deduction ladder (ADR-0090) for the player, flattens the weekday ramp, and would need a settings switch.
- **Hiding conflicts until the board is full.** The rules are public; a player who cannot see a broken rule hunts for it, which is not the puzzle.
