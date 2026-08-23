/**
 * The module is named `grid-hint`, not `hint`, because that argument is
 * scoped to games whose solution is recoverable from the published givens.
 * Termo's answer is never on the wire (`packages/core`'s strip table gives
 * its public projection as `game, date` only) and its guesses are judged
 * server-side, so #27 inherited neither this module nor ADR-0027's reasoning.
 */

export interface Hint<T> {
  readonly index: number;
  readonly value: T;
  readonly kind: "correction" | "fill";
}

export function nextHint<T>(
  solution: readonly T[],
  givens: readonly (T | null)[],
  entries: readonly (T | null)[],
): Hint<T> | null {
  let firstEmpty: Hint<T> | null = null;

  for (let index = 0; index < givens.length; index += 1) {
    if (givens[index] !== null) {
      continue;
    }
    const target = solution[index];
    if (target === undefined) {
      continue;
    }
    const entry = entries[index] ?? null;
    if (entry !== null && entry !== target) {
      return { index, value: target, kind: "correction" };
    }
    if (entry === null && firstEmpty === null) {
      firstEmpty = { index, value: target, kind: "fill" };
    }
  }

  return firstEmpty;
}
