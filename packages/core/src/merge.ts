/**
 * The account-merge union (ADR-0009, ADR-0049): union both accounts'
 * completion rows, dedupe per (game, date) keeping the earliest, return the
 * merged history. `packages/db`'s `mergeAccounts` consumes it for the write
 * path; nightly consistency checks and support previews consume it directly
 * for a read-only preview.
 *
 * No clock, no timezone, no I/O, no Zod enters this module: rows in, rows
 * out. Nothing is filtered — lost and late rows are history, needed by the
 * fail row and the calendar.
 */
import type { CompletionOutcome } from "./completion";
import type { Game } from "./game";

/** One completion row as merge arithmetic sees it — structurally a
 *  `StreakRow` plus the dedupe key's `game` and an ordering key, so
 *  `computeStreak(mergeCompletions(a, b), today)` typechecks directly. */
export interface MergeableCompletion {
  readonly game: Game;
  /** 'YYYY-MM-DD', the puzzle's own SP day. */
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
  /**
   * Opaque, totally ordered, fixed-width key supplied by the row's producer.
   * Compared lexicographically and never parsed — no timestamp arithmetic,
   * no timezone, no Date enters this module.
   */
  readonly completedAtOrder: string;
}

/** The dedupe key — ADR-0009's "(canonical user, puzzle id)" with the user dimension already fixed by the caller. */
function keyOf(completion: MergeableCompletion): string {
  return `${completion.game}:${completion.date}`;
}

/**
 * Union-earliest-dedupe (ADR-0009: the earliest completion wins, the other
 * row is dropped). At an exact ordering-key tie the `canonical` side's row
 * survives, mirroring the DB operation's strict inequality — callers pass
 * the winner's rows first. Winner selection is not this function's job:
 * `mergeAccounts` (DB-side) owns it, keeping identity data out of this
 * row-arithmetic module.
 *
 * Survivors are returned by reference, sorted by (date asc, game asc), so
 * deep equality is the whole idempotence assertion.
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
