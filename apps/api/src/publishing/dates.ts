/**
 * Pure, timezone-free date math for the publishing cron. Weekday of a fixed
 * date needs no timezone; only "what date is today in São Paulo" does, and
 * that is the DB clock's job (`todaySaoPaulo`). Never hardcode UTC-3 here.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * The rollover slack: the only days a write INTENDED AS ON TIME may
 * legitimately predate the account's birth day (a 00:30 account flushing
 * yesterday's completion). Its ONE consumer is the stats calendar's range
 * clamp — `computeCalendar(rows, since, today, rolloverSlackDays)`.
 *
 * It is NOT the write bound and must never become one again: the write
 * window is unbounded below (the archive is every published past day), and
 * a clamp that followed it would drag the calendar's range back arbitrarily
 * and paint "missed" over days the account did not exist for.
 */
export const ROLLOVER_SLACK_DAYS = 1;

/**
 * The write window: a completion or guess may target any day up to and
 * including the DB clock's São Paulo today — upper bound only. The lower
 * bound is gone (ADR-0053 decision 5): the archive is every published past
 * day. One predicate, shared by both write routes, so it can't drift
 * between them. String comparison is exact for 'YYYY-MM-DD'.
 */
export function isWritableDate(date: string, today: string): boolean {
  return date <= today;
}

/**
 * Inside the write window, is this a LATE write — a day strictly before
 * the DB clock's São Paulo today?
 *
 * "Late" is spelled in three layers and they must converge. This is the
 * route layer's spelling, in JS over two date strings. The database's
 * spelling is the stored `on_time` negated, which is what the late-write
 * ceiling's guard counts and what every reader projects. The archive read
 * layer's is `archiveDateClass` in `packages/db`, which takes this
 * predicate's meaning rather than a fourth one.
 *
 * The two spellings agree because the verdict is decided from the same
 * `today` this predicate reads: a row this predicate calls late stores
 * `on_time = false` unless the seen-day credit applies. THE ONE
 * DISAGREEMENT IS THE ROLLOVER ITSELF, bounded at ≤4 rows per user per
 * rollover by the composite PK: a `today` read at 23:59:59.9 lets a
 * same-day write past the ceiling branch, and the row's INSERT lands at
 * 00:00:00.1 on the next SP day.
 *
 * That straddle row escapes BOTH the check and the count, and that is
 * accepted with its reason: its verdict was decided with `today = date`,
 * so it stores `on_time = true` and escapes the late-write check (the
 * branch was not taken) as well as the count (`not on_time` excludes it).
 * This favours the player and matches what they did — the completion WAS
 * made on its own day by the only clock read the request took — and the
 * exposure is ≤4 rows per user per rollover, a sub-second window. Do not
 * "fix" it: the correct trade costs that against reading the clock twice
 * inside one write.
 */
export function isLateDate(date: string, today: string): boolean {
  return date < today;
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
