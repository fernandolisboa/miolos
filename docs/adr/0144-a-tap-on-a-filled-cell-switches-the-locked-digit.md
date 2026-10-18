# ADR-0144 — A tap on a filled cell switches the locked digit

**Status:** Accepted — 2026-10-18 (issue #397)
**Amends:** [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 4 and [ADR-0139](./0139-numero-fixo-works-in-rascunho-and-notes-share-the-highlight.md) decision 1.

## Context

With *Número fixo* on, a tap on a cell showing another digit overwrote an entry with the locked digit and did nothing on a given. Fernando asked that the tap switch the lock to the tapped digit instead, at least on givens. Only a quick double tap on the cell did that.

## Decision

1. With a digit locked and the board playing, one pointer tap on a cell showing a different digit (a given or an entry) selects the cell and locks its digit, in either mode, with no board change and no undo step. The predicate is `switchedLock` in `sudoku/state.ts`, shared by the reducer's `tap-cell` and `useDigitLock`.
2. An empty cell still takes the locked digit (or its note in *Rascunho*), and an entry holding the locked digit is still cleared by a tap.
3. The double tap keeps its meaning: the switch marks the cell tap settled, so a quick second tap is ignored instead of releasing the digit it just locked.
4. A switch changes no entry, so *Limite de 3 erros* judges nothing on it: a held wrong write elsewhere keeps waiting for the next board change (ADR-0128).

## Consequences

- A wrong entry can no longer be replaced in one tap. The player taps it (switch), taps it again slowly (clear), then locks the right digit again, or uses Apagar.

## Rejected

- **Overwriting, as before:** Fernando found it worse than switching.
- **Givens only:** an entry is the same "this number" signal to the player, and two rules for one tap would surprise.
