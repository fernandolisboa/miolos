/**
 * Cells carrying a value, givens included.
 *
 * Nonogram and Termo deliberately do NOT use this function. Nonogram has
 * its own `countFilledCells`: under its encoding a cross is `0`, which is
 * not nullish, so this function would count crosses as progress — the
 * "amount of work performed" readout, not the "how close to done" one the
 * shared `Progresso` slot means on the other screens. That is the shallow
 * reuse ADR-0029 rejects. Termo has no `givens` and no null-empty cell
 * array at all.
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
