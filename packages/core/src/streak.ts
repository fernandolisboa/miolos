/**
 * The streak derivation — THE pure function ADR-0009 mandates ("the streak
 * recomputation routine must exist as a pure function over completion rows
 * … merge is just one caller"). `GET /streak` is its first caller; the
 * account merge, nightly checks and support tooling reuse it unchanged
 * (ADR-0048).
 *
 * No clock, no timezone, no I/O enters this module. `today` is a parameter
 * the caller supplies from the DB clock (`todaySaoPaulo(db)`, ADR-0010's
 * single authority) — a client clock never reaches streak arithmetic
 * (CLAUDE.md invariant).
 */
import type { CompletionOutcome } from "./completion";
import { epochDay } from "./date";

/**
 * One completion row as streak arithmetic sees it (ADR-0009). `onTime` is
 * a FIELD OF THE ROW — produced today by the SQL derivation (ADR-0026
 * decision 2), by a stored column if #58 lands — and is never recomputed
 * here: no timestamp enters this module (#58's decided direction).
 */
export interface StreakRow {
  /** 'YYYY-MM-DD', the puzzle's own SP day. */
  readonly date: string;
  readonly outcome: CompletionOutcome;
  readonly onTime: boolean;
}

export interface StreakStatus {
  readonly streak: number;
  /**
   * Whether `today` itself is a counted day — drives the conclusion card's
   * "mantida por hoje." tail (ADR-0048 decision 2): the streak may be alive
   * through yesterday while today did not maintain it.
   */
  readonly todayCounts: boolean;
}

/**
 * The streak as of `today` (ADR-0048): a day COUNTS iff it has at least one
 * row with `outcome === "won"` and `onTime === true` (CONTEXT.md "Streak /
 * Sequência"; ADR-0008 rules 1–3 — a `lost` row is played, not completed,
 * and never counts, on time or not; a late win never counts). The streak is
 * the maximal run of consecutive counted days ending at `today` or at
 * `today − 1`: a run ending yesterday reads alive at full length until
 * today's rollover passes unplayed (ADR-0048 decision 2).
 */
export function computeStreak(
  rows: readonly StreakRow[],
  today: string,
): StreakStatus {
  const todayDay = epochDay(today);
  const countedDays = new Set<number>();
  for (const row of rows) {
    // Conjunctive on purpose: there is no path where a lost row's `onTime`
    // is consulted for counting (ADR-0008 rule 3). The `<= today` bound
    // makes future-dated rows — which ADR-0026 decision 6 should render
    // impossible — inert rather than load-bearing.
    if (row.outcome === "won" && row.onTime) {
      const day = epochDay(row.date);
      if (day <= todayDay) {
        countedDays.add(day);
      }
    }
  }
  const todayCounts = countedDays.has(todayDay);
  let cursor = todayCounts ? todayDay : todayDay - 1;
  let streak = 0;
  while (countedDays.has(cursor)) {
    streak += 1;
    cursor -= 1;
  }
  return { streak, todayCounts };
}
