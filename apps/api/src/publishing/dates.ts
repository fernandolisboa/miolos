/**
 * Pure, timezone-free date math for the publishing cron (plan 014 §5.3).
 * Weekday-of-a-fixed-date needs no timezone; only "what date is today in
 * São Paulo" does, and that is the DB clock's job (todaySaoPaulo,
 * ADR-0010 single authority). Never hardcode UTC-3 here.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * How far back a completion or a guess may be claimed: SP-today or
 * SP-yesterday (plan 017 D29). `getPublishedDailyWithSolution` has no lower
 * bound, so without this any caller could write a `won` row for every past
 * daily — permanently, since a completion is never reopened (ADR-0026) — and
 * a stale localStorage record would flush as a day the player never played.
 * One day of slack is what keeps a post-rollover flush working (D19).
 *
 * ONE COPY, SHARED BY BOTH ROUTES (#27, ADR-0038 decision 8). It lived in
 * `app/completions/route.ts` until Termo needed the same window: a player
 * mid-game at the São Paulo rollover must be able to submit guess five for
 * yesterday's date, or Termo becomes unfinishable at midnight — while the
 * completion route already accepts that same day. Two copies of the bound is
 * exactly the drift ADR-0026 warns about: *"Widening it accidentally — by
 * removing the bound while 'fixing' a date test — reopens the whole past
 * calendar to forged completions."*
 *
 * This does NOT move the bound out of the route layer, which is what ADR-0026
 * decision 6 actually requires ("in the route and not in SQL"). A module
 * inside `apps/api/src` is still the route layer; nothing here reaches SQL.
 *
 * EXTENSION POINT: #31 (archive) widens this deliberately, with its own tests
 * and its own `late` semantics (ADR-0008).
 */
export const ACCEPTED_DAYS_BACK = 1;

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
