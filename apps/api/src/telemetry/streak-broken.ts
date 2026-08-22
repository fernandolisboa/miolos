import {
  computeStreak,
  epochDay,
  type StreakRow,
  type TelemetryEventProperties,
} from "@miolos/core";

/**
 * Derives `streak_broken` on return from `POST /completions`, from the same
 * unfiltered rows the streak read uses. The break itself happens at SP
 * rollover, unobserved (the streak is read-time; nothing stores a previous
 * value), so the event fires when a counted insert starts a new run after a
 * gap. `rows` is read AFTER the insert, so the inserted row is among them;
 * the caller guarantees it is counted and `recorded`.
 *
 * See ADR-0069 decision 3 for why all three conditions below are required
 * (in particular why the inserted row must be the MAXIMUM counted date —
 * the sync queue flushes newest-date-first, so without that guard a queued
 * {D, D−1} over a D−5 history fires twice) and for the accepted residuals
 * (retro-close, partial retro-close, two-device race) that make the claim
 * "at most once per break", not "exactly once" unqualified.
 */
export function deriveStreakBroken(
  rows: readonly StreakRow[],
  insertedDate: string,
): TelemetryEventProperties["streak_broken"] | null {
  const insertedDay = epochDay(insertedDate);
  let prev: { date: string; day: number } | undefined;
  let countedOnInsertedDate = 0;
  for (const row of rows) {
    // The counting predicate is computeStreak's own conjunction — one
    // definition of "counted", read here only to find the run boundary.
    if (row.outcome !== "won" || !row.onTime) {
      continue;
    }
    const day = epochDay(row.date);
    if (day > insertedDay) {
      // A counted row past the inserted date: this insert is a late flush
      // behind an already-counted return, which already fired.
      return null;
    }
    if (day === insertedDay) {
      countedOnInsertedDate += 1;
      continue;
    }
    if (prev === undefined || day > prev.day) {
      prev = { date: row.date, day };
    }
  }
  // Not exactly the inserted row alone: a second counted game on the same
  // day, or the caller's counted/recorded guarantee failed.
  if (countedOnInsertedDate !== 1) {
    return null;
  }
  // No earlier counted day: a first-ever completion starts the first run.
  if (prev === undefined) {
    return null;
  }
  // Yesterday counted — the run continues.
  if (prev.day >= insertedDay - 1) {
    return null;
  }
  return {
    previous_streak: computeStreak(rows, prev.date).streak,
    broken_after_date: prev.date,
    gap_days: insertedDay - prev.day - 1,
  };
}
