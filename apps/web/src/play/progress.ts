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
