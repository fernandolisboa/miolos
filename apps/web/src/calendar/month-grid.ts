/**
 * The ONE spelling of month-grid geometry (#163, plan 065 D4): leading
 * weekday padding, one cell per month day, trailing fill to whole weeks.
 * Extracted from `src/stats/calendar-month.ts` verbatim so the archive
 * calendar and the stats calendar cannot drift apart — two spellings of
 * "which cell is which day" is how one of them goes wrong silently.
 *
 * Neutral home, deliberately outside both `src/stats` and `src/archive`:
 * either domain importing the other's module would put the shared rule
 * under one domain's roof. Pure, no clock, no `Date` arithmetic on data:
 * weekday arithmetic rides `epochDay`/`dateFromEpochDay` from core. Epoch
 * day 0 (1970-01-01) is a Thursday, so `(epochDay + 4) % 7` is the
 * 0-Sunday weekday index — pure integer arithmetic. Weeks start on
 * Sunday, pt-BR's own first day (domingo).
 */
import { dateFromEpochDay, epochDay } from "@miolos/core";

/** Cells per week row — and the modulus of the weekday arithmetic below. */
export const WEEK_LENGTH = 7;

export interface MonthCells<T> {
  /**
   * The month's first day, 'YYYY-MM-01' — `formatMonth`'s input. Always
   * day 01: the title names the month, not any covered range.
   */
  readonly month: string;
  /**
   * The grid, row-major over whole weeks (length a multiple of 7). `null`
   * is OUT-OF-MONTH PADDING ONLY — leading and trailing weekday fill.
   * Every in-month day is a `T`, whatever the caller's `cellAt` decided
   * for it; a caller whose in-month days can themselves be empty (the
   * stats grid's uncovered days) folds that into its own `T`.
   */
  readonly cells: readonly (T | null)[];
}

/**
 * Builds one month's grid. `cellAt` is TOTAL over the month's days: it is
 * called once per in-month epoch day, in order, and its answer is that
 * cell — the geometry decides only where the cell sits.
 */
export function buildMonthCells<T>(
  monthKey: string,
  cellAt: (day: number) => T,
): MonthCells<T> {
  const firstOfMonth = `${monthKey}-01`;
  const firstDay = epochDay(firstOfMonth);
  const daysInMonth = epochDay(nextMonthFirst(monthKey)) - firstDay;
  // Euclidean remainder, 0 = Sunday: JS `%` follows the dividend's sign,
  // and `firstDay` is negative for every pre-1970 month — unreachable
  // through the shipped range, but the helper is total over its type.
  const leading = (((firstDay + 4) % WEEK_LENGTH) + WEEK_LENGTH) % WEEK_LENGTH;
  const cells: (T | null)[] = [];
  for (let cell = 0; cell < leading; cell += 1) {
    cells.push(null);
  }
  for (let offset = 0; offset < daysInMonth; offset += 1) {
    cells.push(cellAt(firstDay + offset));
  }
  while (cells.length % WEEK_LENGTH !== 0) {
    cells.push(null);
  }
  return { month: firstOfMonth, cells };
}

/** The first day of the month after 'YYYY-MM', via day arithmetic only. */
function nextMonthFirst(monthKey: string): string {
  // The 28th + 7 days always lands in the next month, whose date string
  // then names it — no Date object, no rollover arithmetic of our own.
  const nextMonthDay = dateFromEpochDay(epochDay(`${monthKey}-28`) + 7);
  return `${nextMonthDay.slice(0, 7)}-01`;
}
