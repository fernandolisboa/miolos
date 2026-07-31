/**
 * Deterministic seeded PRNG (splitmix32) — the substrate for "seed in,
 * puzzle out" generation (ADR-0011). Pure: no Node, no DOM, no state
 * outside the returned closure.
 */
export interface SeededRandom {
  /** Next value in [0, 1). */
  next(): number;
  /** Next integer in [0, maxExclusive). */
  nextInt(maxExclusive: number): number;
}

export function createSeededRandom(seed: number): SeededRandom {
  let state = seed >>> 0;

  const next = (): number => {
    state = (state + 0x9e3779b9) >>> 0;
    let z = state;
    z ^= z >>> 16;
    z = Math.imul(z, 0x21f0aaad);
    z ^= z >>> 15;
    z = Math.imul(z, 0x735a2d97);
    z ^= z >>> 15;
    return (z >>> 0) / 0x100000000;
  };

  return {
    next,
    nextInt(maxExclusive: number): number {
      if (!Number.isInteger(maxExclusive) || maxExclusive <= 0) {
        throw new RangeError(
          `maxExclusive must be a positive integer, got ${String(maxExclusive)}`,
        );
      }
      return Math.floor(next() * maxExclusive);
    },
  };
}
