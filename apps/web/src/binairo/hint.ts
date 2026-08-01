/**
 * The one free hint (ADR-0006, ADR-0027, plan 017 §10). Pure selection: the
 * solution comes from `solveBinairo(givens)` at the call site, so the whole
 * hint works offline (AC 3) and no hint endpoint exists.
 *
 * Why computing it on the client is compatible with ADR-0004, recorded so
 * nobody rebuilds the argument wrong: today's board is PUBLISHED, its
 * givens are legitimately in the player's hands, and it is uniquely
 * solvable by construction (ADR-0020/0023) — so its solution is
 * client-recoverable in a fraction of a millisecond wherever the hint runs.
 * Stripping `solution` from the payload protects UNPUBLISHED content, which
 * is ADR-0004's actual scope; it is not, and must never be argued to be, a
 * confidentiality boundary for a published puzzle.
 */
import type {
  BinairoCell,
  BinairoGrid,
  BinairoSolvedGrid,
} from "@miolos/games/binairo";

export interface BinairoHint {
  readonly index: number;
  readonly value: 0 | 1;
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
 */
export function nextHint(
  solution: BinairoSolvedGrid,
  givens: BinairoGrid,
  entries: readonly BinairoCell[],
): BinairoHint | null {
  let firstEmpty: BinairoHint | null = null;

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
