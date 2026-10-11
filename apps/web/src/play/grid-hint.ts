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

export function nextBinaryHint(
  solution: readonly (0 | 1)[],
  entries: readonly (0 | 1 | null)[],
): Hint<0 | 1> | null {
  const noGivens = solution.map(() => null);
  const first = nextHint<0 | 1>(solution, noGivens, entries);
  if (first === null || first.kind === "correction" || first.value === 1) {
    return first;
  }
  const onesOnly = solution.map((mark) => (mark === 1 ? null : 0));
  return nextHint<0 | 1>(solution, onesOnly, entries) ?? first;
}
