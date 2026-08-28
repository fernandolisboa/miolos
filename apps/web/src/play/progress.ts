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
