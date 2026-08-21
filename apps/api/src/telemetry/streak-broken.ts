import {
  computeStreak,
  epochDay,
  type StreakRow,
  type TelemetryEventProperties,
} from "@miolos/core";

/**
 * The `streak_broken` derivation (#33, ADR-0069 decision 3): derived ON
 * RETURN, inside POST /completions, from the same unfiltered rows the
 * streak read uses. The break itself happens at SP rollover, unobserved
 * (ADR-0048: the streak is read-time; nothing stores a previous value), so
 * the event fires when a COUNTED insert starts a new run after a gap.
 *
 * `rows` is `listCompletionsForStreak`'s answer read AFTER the insert, so
 * the inserted row is among them; the caller guarantees the inserted row is
 * counted (`outcome === "won" && onTime`) and `recorded` — conditions the
 * route already holds in scope. This function checks the other three, and
 * ALL must hold (plan 064 D3):
 *
 *  (i)   a counted date `prev` exists with `prev < insertedDate − 1` — an
 *        adjacent yesterday is a continuation, not a break;
 *  (ii)  the inserted row is the ONLY counted row on `insertedDate` — a
 *        second game on an already-counted day re-breaks nothing;
 *  (iii) the inserted row is the MAXIMUM counted date. Load-bearing (the
 *        step-3 B1 finding): the sync queue flushes newest-date-first
 *        (`sync.ts`'s flush comparator, cited by symbol because line
 *        numbers rot) and ADR-0066 can credit the late
 *        completion behind it, so without this guard a queued {D, D−1}
 *        over a D−5 history fires twice. With it, either ordering fires at
 *        most once.
 *
 * The recorded claim is "at most once per break; exactly once in the
 * sequential single-client case" — the retro-close spurious fire (a 1-day
 * gap later credited from a seen day) and the two-device same-day race are
 * accepted residuals, priced in ADR-0069. T-API-S165–S170 pin all six arms.
 *
 * `gap_days` counts FULLY MISSED days: `epochDay(insertedDate) −
 * epochDay(prev) − 1`. `previous_streak` is `computeStreak` anchored on
 * `prev` — the one streak authority, never a re-derivation; the inserted
 * row is inert in that call because its date exceeds the anchor.
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
      // (iii): a counted row past the inserted date means this insert is a
      // late flush behind an already-counted return — that return already
      // made this derivation.
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
  // (ii): exactly the inserted row itself. Zero would mean the caller's
  // guarantee failed (the inserted row is not in `rows`) — silent is the
  // safe answer there too.
  if (countedOnInsertedDate !== 1) {
    return null;
  }
  // No earlier counted day at all: a first-ever counted completion starts
  // the first run — there was never a streak to break.
  if (prev === undefined) {
    return null;
  }
  // (i): yesterday counted — the run continues.
  if (prev.day >= insertedDay - 1) {
    return null;
  }
  return {
    previous_streak: computeStreak(rows, prev.date).streak,
    broken_after_date: prev.date,
    gap_days: insertedDay - prev.day - 1,
  };
}
