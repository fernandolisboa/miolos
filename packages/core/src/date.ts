/**
 * Calendar-day arithmetic over 'YYYY-MM-DD' strings (plan 033 D9).
 * `epochDay` lived as a private helper in `streak.ts` until #29's calendar
 * needed to enumerate consecutive days AND turn epoch days back into ISO
 * dates — the second consumer plan 027 declined to pre-empt. The hoist
 * moves the function verbatim; `apps/api/src/publishing/dates.ts`
 * (`addDays`, `isoWeekdayOf`, `ROLLOVER_SLACK_DAYS`, `isWritableDate`) is
 * deliberately NOT consolidated here — that would be blast radius without
 * need, and both the write window and the calendar's rollover slack must
 * stay in the route layer (ADR-0026 decision 6 as amended by ADR-0053), so
 * core takes the slack as a parameter (see `computeCalendar`).
 *
 * No clock, no timezone, no I/O in this module (the `streak.ts` register):
 * values in, values out.
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
  // alias to 1926. No producer emits a pre-1000 date — every row is a
  // Postgres `date` — so the guard REFUSES the range rather than escaping
  // it via setUTCFullYear, which would put a Date object into a module
  // whose whole register is no-clock, no-Date arithmetic (T-CORE-S35).
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
 * "0999-…", which `epochDay` rejects (its own floor), breaking the round
 * trip; above 9999 `toISOString` emits expanded-year forms like
 * "+010000-…" whose `slice(0, 10)` is garbage. Exported for the property
 * test's domain (T-CORE-S68).
 */
export const MIN_EPOCH_DAY = epochDay("1000-01-01");
export const MAX_EPOCH_DAY = epochDay("9999-12-31");

/**
 * Whole days since the Unix epoch → 'YYYY-MM-DD' — `epochDay`'s inverse.
 * This is the test-side helper `streak-properties.test.ts` always used,
 * productionised WITH guards: the test copy only ever ran over a bounded
 * arbitrary, while a production caller could hand it anything, and outside
 * `[MIN_EPOCH_DAY, MAX_EPOCH_DAY]` the formula returns garbage rather
 * than throwing on its own.
 */
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
