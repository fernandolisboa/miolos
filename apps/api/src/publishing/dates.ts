/**
 * Pure, timezone-free date math for the publishing cron (plan 014 §5.3).
 * Weekday-of-a-fixed-date needs no timezone; only "what date is today in
 * São Paulo" does, and that is the DB clock's job (todaySaoPaulo,
 * ADR-0010 single authority). Never hardcode UTC-3 here.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The rollover slack: the only days a write INTENDED AS ON TIME may
 * legitimately predate the account's birth day (a 00:30 account flushing
 * yesterday's completion). Its ONE consumer is the stats calendar's range
 * clamp — `computeCalendar(rows, since, today, rolloverSlackDays)`.
 *
 * It is NOT the write bound, it never was the same idea, and it must never
 * be used as one again: #31 widened the write window to the whole archive
 * (ADR-0053), and a clamp that followed it would drag the calendar's range
 * back arbitrarily and paint "missed" over days the account did not exist
 * for — the exact failure ADR-0051's Rejected list names at :175-178.
 *
 * One constant, one owner. Until #31 this value and the write window were a
 * SINGLE constant holding two ideas; splitting the name is what makes
 * `isWritableDate`'s widening safe (ADR-0053 decision 6).
 */
export const ROLLOVER_SLACK_DAYS = 1;

/**
 * The write window (ADR-0026 decision 6 as amended by ADR-0053).
 *
 * UPPER bound only: a completion or a guess may target any day up to and
 * including the DB clock's São Paulo today. The LOWER bound is GONE — the
 * archive is every published past day, and the WALL is the only authority
 * on which those are. Bounded in the ROUTE, never in SQL: decision 6's
 * layer rule is unchanged, and `wallPredicate` is untouched.
 *
 * The upper bound is a TIGHTENING, not a preservation: before #31 neither
 * write route refused a future date in the route at all — the wall refused
 * it one statement later. Now the route refuses it first.
 *
 * ONE PREDICATE, SHARED BY BOTH ROUTES (#27, ADR-0038 decision 8, whose
 * substance survives whole even though its title names the deleted
 * constant). Two copies of the window is exactly the drift ADR-0026 warns
 * about, and an archived Termo needs both windows to agree or it is
 * unfinishable.
 *
 * The volume ceiling this removal owes lives in the completion route
 * (`ARCHIVE_WRITES_PER_DAY`, ADR-0053 decision 13), not here: it is a rate
 * rule, not a date rule. String comparison is exact for 'YYYY-MM-DD'.
 */
export function isWritableDate(date: string, today: string): boolean {
  return date <= today;
}

function partsOf(date: string): [number, number, number] {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/** 'YYYY-MM-DD' + days, via the Date.UTC triple (month/year ends handled by the platform). */
export function addDays(date: string, days: number): string {
  const [year, month, day] = partsOf(date);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

/** ISO 8601 weekday of a calendar date: Monday = 1 … Sunday = 7. */
export function isoWeekdayOf(date: string): number {
  const [year, month, day] = partsOf(date);
  return ((new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7) + 1;
}
