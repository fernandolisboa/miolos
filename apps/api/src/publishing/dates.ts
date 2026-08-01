/**
 * Pure, timezone-free date math for the publishing cron (plan 014 §5.3).
 * Weekday-of-a-fixed-date needs no timezone; only "what date is today in
 * São Paulo" does, and that is the DB clock's job (todaySaoPaulo,
 * ADR-0010 single authority). Never hardcode UTC-3 here.
 */

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

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
