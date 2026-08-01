/** ISO 8601 day-of-week numbering: Monday = 1 … Sunday = 7. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

/**
 * Runtime weekday guard for values arriving from untyped boundaries (JSON
 * config, plain-JS callers). The `Weekday` type covers typed callers only;
 * engine entry points use this to fail with a typed error instead of an
 * incidental TypeError deep inside a criteria lookup.
 */
export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}
