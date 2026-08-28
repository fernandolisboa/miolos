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
