# ADR-0139 — Número fixo works in Rascunho, and notes holding the digit get a lighter highlight

**Status:** Accepted — 2026-10-16 (issue #390)
**Amends:** [ADR-0127](./0127-sudoku-notes-are-a-local-per-cell-mask.md) decision 3 (Rascunho no longer releases or blocks *Número fixo*) and its consequence "a note never counts … not in the same-digit highlight"; [ADR-0102](./0102-player-settings-are-device-local-and-mostrar-erros-is-an-opt-in-assist.md) decision 4 (a fixed digit notes instead of writing while Rascunho is on).

## Context

Fernando asked that the quick selection (*Número fixo com toque duplo*) work while noting, and that cells whose notes hold the selected number get a highlight lighter than the same-digit one. ADR-0127 had made the two modes exclusive, so a double tap in Rascunho fixed nothing.

## Decision

1. **The fixed digit is independent of the mode.** `toggle-noting` keeps `locked`; `lock-digit` works in either mode. In Rascunho a tap on a cell (`tap-cell`) selects it and toggles the fixed digit's note in an empty playable cell; a given or an entry is only selected. The keypad and board double taps lock exactly as in ADR-0102 d4, and the first tap's note toggle is undone by the existing `DigitLockUndo` notes.
2. **A note toggle is a gesture like any other press.** It is an undo step (ADR-0127 d5) and, through `withMistakes`, it settles a held wrong write elsewhere, which may be the third mistake that drops it (ADR-0128). The note itself is never judged.
3. **`note-digit` is a third `CellHighlight`** (`sudoku/highlights.ts`), ranked same-digit > note-digit > unit. Its digit is `noteFocus`: the selected cell's value, else the fixed digit, with or without a selection. `same-digit` still reads only the selected cell's value. It shares the *Destacar linha, coluna e bloco* gate and gives way to the hint spotlight. The cell takes a 20% accent tint (unit is 8%, same-digit solid) and the matching small digit is drawn in the accent.

## Consequences

- A note still never counts in the tally, *Mostrar erros*, progress or the same-digit highlight.
- Pinned by `T-WEB-S930…S935`. `T-WEB-S833` lost its two exclusion cases to `S930`.

## Rejected

- **Releasing the fixed digit on a mode switch:** the player would re-fix the same digit to note it right after writing it.
- **Highlighting notes through `same-digit`:** a solid fill on a cell of small notes reads as a placed copy, which is what Fernando asked to avoid.
