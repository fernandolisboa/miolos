/**
 * Calendar-day arithmetic over 'YYYY-MM-DD' strings.
 *
 * `apps/api/src/publishing/dates.ts` (`addDays`, `isoWeekdayOf`,
 * `ROLLOVER_SLACK_DAYS`, `isWritableDate`) is deliberately NOT consolidated
 * here: the write window and the rollover slack are route-layer policy with
 * their own owners (ADR-0026, ADR-0053), not calendar arithmetic. Core takes
 * the slack as a parameter instead (see `computeCalendar`).
 *
 * No clock, no timezone, no I/O in this module: values in, values out.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * 'YYYY-MM-DD' → whole days since the Unix epoch, via the Date.UTC triple —
 * timezone-free calendar arithmetic, the same trick as
 * `apps/api/src/publishing/dates.ts`.
 */
export function epochDay(date: string): number {
  const match = ISO_DATE.exec(date);
  if (!match) {
    throw new RangeError(`expected 'YYYY-MM-DD', got ${JSON.stringify(date)}`);
  }
  const year = Number(match[1]);
  // Date.UTC backfills years 0–99 to 1900–1999, so "0026-…" would silently
  // alias to 1926. No producer emits a pre-1000 date, so this guard
  // REFUSES the range rather than escaping it via setUTCFullYear, which
  // would put a Date object into a module whose whole register is
  // no-clock, no-Date arithmetic.
  if (year < 1000) {
    throw new RangeError(
      `expected a year >= 1000, got ${JSON.stringify(date)}`,
    );
  }
  return Date.UTC(year, Number(match[2]) - 1, Number(match[3])) / 86_400_000;
}

/**
 * The exact domain over which `dateFromEpochDay` round-trips with
 * `epochDay` — derived from the guards, never spelled as literals, so the
 * mirror can never drift. Below year 1000 the naive formula emits
 * "0999-…", which `epochDay` rejects; above 9999 `toISOString` emits
 * expanded-year forms like "+010000-…" whose `slice(0, 10)` is garbage.
 */
export const MIN_EPOCH_DAY = epochDay("1000-01-01");
export const MAX_EPOCH_DAY = epochDay("9999-12-31");

/** Whole days since the Unix epoch → 'YYYY-MM-DD' — `epochDay`'s inverse. */
export function dateFromEpochDay(day: number): string {
  if (!Number.isInteger(day) || day < MIN_EPOCH_DAY || day > MAX_EPOCH_DAY) {
    throw new RangeError(
      `expected an integer epoch day in [${String(MIN_EPOCH_DAY)}, ${String(
        MAX_EPOCH_DAY,
      )}], got ${String(day)}`,
    );
  }
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
