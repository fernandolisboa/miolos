/**
 * The month-grid grouping for the stats calendar (#29, plan 033 §6.1) — a
 * PURE presentation helper: `CalendarDay[]` in, month grids out, newest
 * month first. It derives nothing (the client renders, never derives —
 * plan 033 D3): every day's state and marker arrive from the server, and
 * this module only decides which grid cell each one paints.
 *
 * The GEOMETRY lives in `src/calendar/month-grid.ts` as of #163 (plan 065
 * D4) — the archive calendar needed the identical arithmetic, and two
 * spellings of month geometry is the drift this module's own doc always
 * warned about. This module keeps its whole public surface and delegates:
 * `buildMonthCells` decides where each cell sits, and this file only
 * decides what a stats cell paints. Weekday facts (Sunday-first, the
 * 0-Sunday `epochDay` arithmetic, pre-1970 totality) are recorded there.
 */
import { epochDay, type CalendarDay } from "@miolos/core";

import { buildMonthCells } from "../calendar/month-grid";

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
 * The stats cell decision over the shared geometry: `cellAt` answers the
 * enumeration's entry for a covered day and `null` otherwise — so a stats
 * grid's `null` covers BOTH out-of-month padding and the month's days
 * outside the enumeration's range, which render as empty paper (§6.2),
 * never as a fabricated "missed". `buildMonthCells`'s own `null` is the
 * padding half; the in-month half is this caller's `T = CalendarDay | null`.
 */
function buildMonth(
  monthKey: string,
  cellAt: (day: number) => CalendarDay | null,
): CalendarMonth {
  return buildMonthCells(monthKey, cellAt);
}
