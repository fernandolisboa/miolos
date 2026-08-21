/**
 * The archive calendar's cell decision (#163, plan 065 D4) — pure, and
 * deliberately clock-free: a cell is linked exactly when its date is in
 * `publishedDates`, and `publishedDates` comes from `listArchivedDays`,
 * whose SQL past-only wall (`archivedWallPredicate`) is the ONLY authority
 * on which days exist. Today, future days, killed days and the ragged
 * floor's gaps are all the same absence, so they all render inert with no
 * code path of their own — the shipped shape (ADR-0053 decision 3), and
 * the reason no `Date.now()` or `todaySaoPauloDate` appears here: "is
 * this day past" is never this module's question to answer.
 */
import { dateFromEpochDay } from "@miolos/core";

import { buildMonthCells, type MonthCells } from "../calendar/month-grid";

export interface ArchiveCalendarCell {
  /** The cell's own calendar day, 'YYYY-MM-DD'. */
  readonly date: string;
  /** Present in the reader's answer — a link. Absent — an inert numeral. */
  readonly linked: boolean;
}

/**
 * One month's archive grid over the shared geometry: every in-month day
 * is a cell (`buildMonthCells`'s `cellAt` is total), `null` is padding
 * only. `month` is 'YYYY-MM', already validated by the caller
 * (`parseArchiveMonth` on the month page; `monthOf` over the reader's own
 * rows on the index — no raw segment reaches this function).
 */
export function archiveCalendarMonth(
  month: string,
  publishedDates: ReadonlySet<string>,
): MonthCells<ArchiveCalendarCell> {
  return buildMonthCells(month, (day) => {
    const date = dateFromEpochDay(day);
    return { date, linked: publishedDates.has(date) };
  });
}
