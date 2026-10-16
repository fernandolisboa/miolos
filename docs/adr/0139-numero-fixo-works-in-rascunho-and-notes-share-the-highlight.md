# ADR-0139 — Número fixo works in Rascunho, and notes holding the digit get a lighter highlight

**Status:** Accepted — 2026-10-16 (issue #390)
**Amends:** [ADR-0127](./0127-sudoku-notes-are-a-local-per-cell-mask.md) decision 3 (Rascunho no longer releases or blocks *Número fixo*); [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 4 (a locked digit notes instead of writing while Rascunho is on).

## Context

Fernando asked that the quick selection (*Número fixo com toque duplo*) work while noting, and that cells whose notes hold the selected number get a highlight lighter than the same-digit one. ADR-0127 had made the two modes exclusive, so a double tap in Rascunho locked nothing.

## Decision

1. **The locked digit is independent of the mode.** `toggle-noting` keeps `locked`; `lock-digit` works in either mode. In Rascunho a tap on a cell (`tap-cell`) selects it and toggles the locked digit's note in an empty playable cell; a given or an entry is only selected. The keypad and board double taps lock exactly as in ADR-0102 d4, and the first tap's note toggle is undone by the existing `DigitLockUndo` notes.
2. **A note toggle is a gesture like any other press.** It is an undo step (ADR-0127 d5) and, through `withMistakes`, it settles a held wrong write elsewhere, which may be the third mistake that drops it (ADR-0128). The note itself is never judged.
3. **The matching note is drawn as a tiny accent chip** (`.noteMatch`): accent fill, `--ink-on-accent` numeral, bold. Its digit is `noteFocus` (`sudoku/notes.ts`): the selected cell's value, else the locked digit, with or without a selection. It shares the *Destacar linha, coluna e bloco* gate and gives way to the hint spotlight. The cell's own look (`CellHighlight`) is untouched, so `same-digit` still reads only the selected cell's value.
4. **No cell tint for it.** On `--paper-desk` in light, `--ink-2` notes drop to 3.70:1 under a 20% tint, so a noted-cell tint would break the body-text floor for its other notes. The reach's 8% tint (#368) already puts them at 4.496:1, just under the floor; that is #393, not this decision.

## Consequences

- A note still never counts in the tally, *Mostrar erros*, progress or the same-digit highlight.
- Pinned by `T-WEB-S930…S936` (`S936` measures the chip). `T-WEB-S833` lost its two exclusion cases to `S930`.

## Rejected

- **Releasing the locked digit on a mode switch:** the player would re-lock the same digit to note it right after writing it.
- **A 20% cell tint with accent note text:** 3.99:1 for `--accent-sudoku-text` in dark and 3.70:1 for `--ink-2` in light.
- **A third `CellHighlight` for noted cells:** a cell carries one tint, so a noted cell inside the reach would lose the reach's tint.
- **Highlighting notes through `same-digit`:** a solid fill on a cell of small notes reads as a placed copy.
