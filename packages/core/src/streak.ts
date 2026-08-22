/**
 * The streak derivation (ADR-0009): a pure function over completion rows,
 * reused unchanged by GET /streak, account merge, nightly checks and
 * support tooling.
 *
 * No clock, no timezone, no I/O enters this module. `today` is always
 * supplied by the caller from the DB clock (`todaySaoPaulo(db)`) — a client
 * clock never reaches streak arithmetic.
 */
import type { CompletionOutcome } from "./completion";
import { epochDay } from "./date";

/** One completion row as streak arithmetic sees it. `onTime` is a field of
 *  the row, never recomputed here — no timestamp enters this module. */
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
   * "mantida por hoje." tail: the streak may be alive through yesterday
   * while today did not maintain it.
   */
  readonly todayCounts: boolean;
}

/**
 * The streak as of `today`: a day counts iff it has at least one row with
 * `outcome === "won"` and `onTime === true` (ADR-0008 rules 1–3). The streak
 * is the maximal run of consecutive counted days ending at `today` or at
 * `today − 1`, so a run ending yesterday reads alive at full length until
 * today's rollover passes unplayed.
 */
export function computeStreak(
  rows: readonly StreakRow[],
  today: string,
): StreakStatus {
  const todayDay = epochDay(today);
  const countedDays = new Set<number>();
  for (const row of rows) {
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
