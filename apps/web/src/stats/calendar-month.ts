/**
 * The month-grid grouping for the stats calendar (#29, plan 033 §6.1) — a
 * PURE presentation helper: `CalendarDay[]` in, month grids out, newest
 * month first. It derives nothing (the client renders, never derives —
 * plan 033 D3): every day's state and marker arrive from the server, and
 * this module only decides which grid cell each one paints.
 *
 * Weekday arithmetic rides `epochDay`/`dateFromEpochDay` from core — no
 * `new Date()` timezone arithmetic on data. Epoch day 0 (1970-01-01) is a
 * Thursday, so `(epochDay + 4) % 7` is the 0-Sunday weekday index — pure
 * integer arithmetic, no `Date` at all. Weeks start on Sunday, pt-BR's own
 * first day (domingo).
 */
import { dateFromEpochDay, epochDay, type CalendarDay } from "@miolos/core";

/** Cells per week row — and the modulus of the weekday arithmetic below. */
const WEEK_LENGTH = 7;

export interface CalendarMonth {
  /**
   * The month's first day, 'YYYY-MM-01' — `formatMonth`'s input. Always
   * day 01 even when the covered range starts later: the title names the
   * month, not the range.
   */
  readonly month: string;
  /**
   * The grid, row-major over whole weeks (length a multiple of 7): a
   * `CalendarDay` where the enumeration covers the date, `null` for every
   * other cell — leading/trailing weekday padding AND the month's days
   * outside `[days[0].date, days.at(-1).date]`, which render as empty
   * paper (§6.2), never as a fabricated "missed".
   */
  readonly cells: readonly (CalendarDay | null)[];
}

/**
 * Groups the server's enumeration into month grids, NEWEST FIRST (§6.2:
 * the current month is the one a player opens the screen for). The
 * enumeration arrives oldest-first and gap-free from the contract
 * (`days[0].date` is the range start, `days.at(-1)!.date` the range end);
 * an empty input answers no months — the settled-`null` neutral month is
 * the view's own rendering decision, not this helper's.
 */
export function calendarMonths(
  days: readonly CalendarDay[],
): readonly CalendarMonth[] {
  const byDay = new Map<number, CalendarDay>();
  for (const day of days) {
    byDay.set(epochDay(day.date), day);
  }
  // 'YYYY-MM' keys, in first-seen (oldest-first) order.
  const monthKeys: string[] = [];
  for (const day of days) {
    const key = day.date.slice(0, 7);
    if (monthKeys.at(-1) !== key) {
      monthKeys.push(key);
    }
  }
  const months = monthKeys.map((key) =>
    buildMonth(key, (day) => byDay.get(day) ?? null),
  );
  return months.reverse();
}

/**
 * The month grid of `date`'s own month with EVERY cell `null` — the
 * settled-null cold rendering (§6.2's honest zero): only the month's
 * geometry is drawn, and no state is claimed for any day. The view pairs
 * it with no legend, for the same reason.
 */
export function neutralMonth(date: string): CalendarMonth {
  return buildMonth(date.slice(0, 7), () => null);
}

/**
 * The one spelling of the month geometry (leading weekday padding, one
 * cell per month day, trailing fill to whole weeks): `cellAt` decides
 * what each in-month epoch day paints — the enumeration's entry, or
 * `null` for `neutralMonth`'s all-empty grid.
 */
function buildMonth(
  monthKey: string,
  cellAt: (day: number) => CalendarDay | null,
): CalendarMonth {
  const firstOfMonth = `${monthKey}-01`;
  const firstDay = epochDay(firstOfMonth);
  const daysInMonth = epochDay(nextMonthFirst(monthKey)) - firstDay;
  // Euclidean remainder, 0 = Sunday: JS `%` follows the dividend's sign,
  // and `firstDay` is negative for every pre-1970 month — unreachable
  // through the shipped range, but the helper is total over its type.
  const leading = (((firstDay + 4) % WEEK_LENGTH) + WEEK_LENGTH) % WEEK_LENGTH;
  const cells: (CalendarDay | null)[] = [];
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
