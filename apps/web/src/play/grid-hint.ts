export interface Hint<T> {
  readonly index: number;
  readonly value: T;
  readonly kind: "correction" | "fill";
}

export interface PlainHintReason {
  readonly kind: "correction" | "fill";
}

export type HintReason<S> =
  PlainHintReason | { readonly kind: "step"; readonly step: S };

export interface FoundStep<S> {
  readonly index: number;
  readonly value: unknown;
  readonly step: S;
}

export interface Revealed<T, R> {
  readonly index: number;
  readonly value: T;
  readonly reason: R;
  readonly spotlight?: readonly number[];
}

export type LogicalHint<T, S> = Revealed<T, HintReason<S>>;

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

export function nextLogicalHint<T, S>(
  solution: readonly T[],
  first: Hint<T> | null,
  findStep: () => FoundStep<S> | null,
): LogicalHint<T, S> | null {
  if (first === null) {
    return null;
  }
  const found = first.kind === "fill" ? findStep() : null;
  const target = found === null ? undefined : solution[found.index];
  if (found !== null && target !== undefined && target === found.value) {
    return {
      index: found.index,
      value: target,
      reason: { kind: "step", step: found.step },
    };
  }
  return {
    index: first.index,
    value: first.value,
    reason: { kind: first.kind },
  };
}

export function plainHint<T>(
  hint: Hint<T> | null,
): Revealed<T, PlainHintReason> | null {
  return hint === null
    ? null
    : { index: hint.index, value: hint.value, reason: { kind: hint.kind } };
}
