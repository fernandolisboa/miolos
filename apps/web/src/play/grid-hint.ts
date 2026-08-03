/**
 * The one free hint for a GRID game (ADR-0006, ADR-0027, ADR-0029, plan 018
 * §10.2). Pure selection: the solution comes from the engine's own solver at
 * the call site, so the whole hint works offline (AC 4) and no hint endpoint
 * exists.
 *
 * Why computing it on the client is compatible with ADR-0004, recorded so
 * nobody rebuilds the argument wrong: today's board is PUBLISHED, its
 * givens are legitimately in the player's hands, and it is uniquely
 * solvable by construction (ADR-0020/0023) — so its solution is
 * client-recoverable in a fraction of a millisecond wherever the hint runs.
 * Stripping `solution` from the payload protects UNPUBLISHED content, which
 * is ADR-0004's actual scope; it is not, and must never be argued to be, a
 * confidentiality boundary for a published puzzle.
 *
 * The module is named `grid-hint`, not `hint`, because that argument is
 * scoped to games whose solution is recoverable from the published givens.
 * Termo's answer is never on the wire (`packages/core`'s strip table gives
 * its public projection as `game, date` only) and its guesses are judged
 * server-side, so #27 inherited neither this module nor ADR-0027's reasoning.
 *
 * DISCHARGED AT #27: ADR-0045 decision 1 decided it, and the decision is NO
 * HINT — there is nothing to reveal that is not the answer itself. So this
 * module keeps exactly three consumers, permanently, and a fourth game
 * arriving is not a reason to widen it (ADR-0029 consequence (g)).
 */

export interface Hint<T> {
  readonly index: number;
  readonly value: T;
  /** `correction` unblocks a wrong entry; `fill` reveals an empty cell. */
  readonly kind: "correction" | "fill";
}

/**
 * The next cell to reveal, or `null` when the grid is already complete and
 * correct. Deterministic: same state in, same hint out — the player may
 * not reroll a hint by re-rendering.
 *
 * A contradiction wins over an empty cell because it is the maximally
 * useful hint: it unblocks the mistake the player is actually stuck
 * behind, where filling one more correct cell leaves the contradiction in
 * place. Givens are never candidates in either branch — they cannot be
 * wrong and they cannot be empty.
 *
 * `T` is UNCONSTRAINED, deliberately: the body uses only `!== null` and
 * `!==` equality — nothing numeric — so `T extends number` would pre-exclude
 * a future letter game for no reason the algorithm has. `null` is the empty
 * cell in all three arrays, so Binairo passes its cells natively and Sudoku
 * passes its engine grid through `playableGivens`/`solutionDigits`.
 */
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
      // Row-major first contradiction: return immediately, so a later
      // mistake can never outrank an earlier one.
      return { index, value: target, kind: "correction" };
    }
    if (entry === null && firstEmpty === null) {
      firstEmpty = { index, value: target, kind: "fill" };
    }
  }

  return firstEmpty;
}
