/**
 * The account-merge union — the pure half of ADR-0009's merge rule, made
 * concrete by ADR-0049: union both accounts' completion rows, dedupe per
 * (game, date) keeping the earliest, return the merged history. One
 * semantics, no mode parameter, no flow variants: the attach flow (#21)
 * consumes it through `mergeAccounts` (@miolos/db), whose SQL the
 * agreement test pins to this function; read-only callers — nightly
 * consistency checks, support previews — consume this function directly
 * and get "what WOULD the merged history be" without a write path.
 *
 * No clock, no timezone, no I/O, no Zod enters this module: rows in, rows
 * out, the `computeStreak` shape. Derived state is never merged here —
 * streak, stats and medals are the pure derivations' job over this
 * function's output (ADR-0049 decision 6); nothing is filtered, because
 * lost and late rows are history (#29's fail row and calendar need them).
 */
import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

/**
 * One completion row as merge arithmetic sees it. Structurally a
 * `StreakRow` plus the dedupe key's `game` and an ordering key, so
 * `computeStreak(mergeCompletions(a, b), today)` typechecks directly —
 * one row fetch serves both the merge and the recompute. `onTime` is row
 * data carried through the union UNCHANGED — never recomputed, no
 * timestamp consulted (#58's decided direction, ADR-0026 decision 2).
 */
export interface MergeableCompletion {
  readonly game: Game;
  /** 'YYYY-MM-DD', the puzzle's own SP day. */
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  /**
   * Opaque, totally ordered, fixed-width key supplied by the row's producer
   * — today the DB projects a fixed-width UTC instant string
   * (`listCompletionsForMerge`, plan 029 §6). Compared lexicographically
   * and NEVER parsed: no timestamp arithmetic, no timezone, no Date enters
   * this module (the #18 discipline, kept).
   */
  readonly completedAtOrder: string;
}

/** The dedupe key — ADR-0009's "(canonical user, puzzle id)" with the user dimension already fixed by the caller. */
function keyOf(completion: MergeableCompletion): string {
  return `${completion.game}:${completion.date}`;
}

/**
 * Union-earliest-dedupe (ADR-0009: "the earliest completion wins and the
 * other row is dropped"). Roles matter only at an exact ordering-key tie,
 * where the `canonical` side's row survives — mirroring the db operation's
 * strict inequality (ADR-0049 decision 2), so callers pass the winner's
 * rows first. Winner SELECTION is not this function's job (`mergeAccounts`
 * owns it, DB-side): choosing winners here would drag identity data into a
 * row-arithmetic module.
 *
 * Survivors are returned BY REFERENCE — the output row for a key IS one of
 * the input rows — sorted by (date asc, game asc) so deep equality is the
 * whole idempotence assertion. Same-input duplicate keys cannot exist via
 * the PK; their behavior (earliest wins, first occurrence on a tie) is
 * defined and pinned rather than left undefined (T-CORE-S41).
 */
export function mergeCompletions(
  canonical: readonly MergeableCompletion[],
  other: readonly MergeableCompletion[],
): MergeableCompletion[] {
  const kept = new Map<string, MergeableCompletion>();
  // Canonical scanned first: on any exact tie the earlier-scanned row is
  // kept, which encodes both tie rules at once (canonical over other;
  // first occurrence within a side). Only strict `<` replaces.
  for (const row of [...canonical, ...other]) {
    const key = keyOf(row);
    const current = kept.get(key);
    if (
      current === undefined ||
      row.completedAtOrder < current.completedAtOrder
    ) {
      kept.set(key, row);
    }
  }
  return [...kept.values()].sort((a, b) => {
    if (a.date !== b.date) {
      return a.date < b.date ? -1 : 1;
    }
    return a.game < b.game ? -1 : a.game > b.game ? 1 : 0;
  });
}
