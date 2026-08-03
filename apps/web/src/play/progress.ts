/**
 * The `{filled} de {total}` readout every grid game shows (plan 018 §5.2),
 * moved verbatim out of `use-binairo-play.ts` and widened to a number grid.
 */

/**
 * Cells carrying a value, givens included.
 *
 * `null` is the ONLY empty marker this function knows, and the signature
 * says so deliberately: Sudoku's engine grid uses `0` for an empty cell,
 * which is not nullish, so `given ?? entries[i]` short-circuits to `0` on
 * every empty given and the counter reports 81 of 81 filled from the first
 * paint. Sudoku therefore passes `playableGivens(givens)` — its `0`s mapped
 * to `null` — never the raw `SudokuGrid` (plan 018 S6, landmine 22).
 *
 * TWO OF THE FOUR GAMES DELIBERATELY DO NOT USE THIS, for two different
 * reasons, and this paragraph exists so a later "cleanup" cannot silently
 * reinstate the wrong meter for either.
 *
 * NONOGRAM has its own `countFilledCells` (plan 020 P13/P14). Under its
 * encoding a cross is `0`, which is not nullish, so this function would count
 * crosses as progress — the "amount of work performed" readout, not the "how
 * close to done" one the shared `Progresso` slot means on the other screens.
 * Making it compute Nonogram's readout would need two synthetic arrays: an
 * all-`null` `givens` of length n² (a parameter Nonogram has no concept of)
 * and a projected `entries` with `0 → null`. That is the shallow reuse
 * ADR-0029 rejects.
 *
 * TERMO (#27) is the second, and its reason is sharper: it has no `givens`
 * and no null-empty cell array AT ALL. Its board is read-only output
 * (ADR-0042) and its readout is `guesses spent / MAX_GUESSES`, composed in
 * `messages.ts` from `state.guesses.length` — two parallel index-aligned
 * arrays are not a shape it could supply even synthetically. Same verdict,
 * second time.
 */
export function countFilled(
  givens: readonly (number | null)[],
  entries: readonly (number | null)[],
): number {
  let filled = 0;
  for (const [index, given] of givens.entries()) {
    if ((given ?? entries[index] ?? null) !== null) {
      filled += 1;
    }
  }
  return filled;
}
