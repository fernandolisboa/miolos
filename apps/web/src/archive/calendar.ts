/**
 * The archive calendar's MODEL (#163, plan 065 D4) — pure, and deliberately
 * clock-free: a cell is linked exactly when its date is in `publishedDates`,
 * and `publishedDates` comes from `listArchivedDays`, whose SQL past-only
 * wall (`archivedWallPredicate`) is the ONLY authority on which days exist.
 * Today, future days, killed days and the ragged floor's gaps are all the
 * same absence, so they all render inert with no code path of their own —
 * the shipped shape (ADR-0053 decision 3), and the reason no `Date.now()` or
 * `todaySaoPauloDate` appears here: "is this day past" is never this
 * module's question to answer.
 *
 * Both surfaces' reader-rows → grid derivations live here too, so there is
 * ONE spelling of "which days does the reader say exist" and one home for
 * the index's row window (step-6 quality B3/N4, correctness B1/N5). The
 * `ArchivedDay` import is TYPE-ONLY — this module runs no query and holds
 * no database edge, exactly as `group-days.ts` beside it.
 */
import { dateFromEpochDay, GAMES } from "@miolos/core";
import type { ArchivedDay } from "@miolos/db";

import { buildMonthCells, type MonthCells } from "../calendar/month-grid";
import { monthOf } from "./parse-params";

/**
 * How many ROWS the index over-fetches for the newest month's calendar:
 * 31 days × every game the product ships — the maximum rows one month can
 * hold — so the window always covers the whole newest month and stays a
 * constant, bounded by construction (ADR-0053 decision 4; #163 widened it
 * from 32).
 *
 * DERIVED from `GAMES`, never written out. A hand-written 124 would go
 * silently WRONG the day a fifth game lands: the reader answers
 * `date DESC`, so the rows the short window dropped would be the newest
 * month's OLDEST days, and a published day would render as an inert
 * numeral — on the index only, indistinguishable from a killed day by the
 * very property that makes the kill switch honest, so no test, type or
 * gate could see it (step-6 correctness B1, issue F2, quality B2,
 * performance 1).
 */
export const NEWEST_MONTH_ROW_WINDOW = 31 * GAMES.length;

export interface ArchiveCalendarCell {
  /** The cell's own calendar day, 'YYYY-MM-DD'. */
  readonly date: string;
  /** Present in the reader's answer — a link. Absent — an inert numeral. */
  readonly linked: boolean;
}

/** The index's calendar section: one month, and the days it published. */
export interface ArchiveIndexCalendar {
  /** 'YYYY-MM' — the newest month the reader's window holds. */
  readonly month: string;
  /** That month's published days, ready for `ArchiveCalendar`. */
  readonly dates: ReadonlySet<string>;
}

/**
 * The days a reader window says exist. The reader answers `(date, game)`
 * pairs and a calendar wants DAYS, so the dates are deduplicated here —
 * keyed by the reader's own strings, never a re-derivation of what exists.
 * `month` narrows to one month for the index, which cuts its grid out of a
 * window that may reach into older months; the month page's read is
 * already bounded to its month and passes nothing.
 */
export function archivedDates(
  days: readonly ArchivedDay[],
  month?: string,
): ReadonlySet<string> {
  const dates = new Set<string>();
  for (const day of days) {
    if (month === undefined || monthOf(day.date) === month) {
      dates.add(day.date);
    }
  }
  return dates;
}

/**
 * The newest archived month and its published days, from the window
 * ITSELF: the month is `monthOf` the newest row, and the day set is the
 * window's matching rows — never a second read and never a clock, so the
 * grid and its data cannot straddle midnight disagreeing with each other.
 * An empty window is an empty archive: no grid at all, never a skeleton.
 */
export function newestMonthCalendar(
  days: readonly ArchivedDay[],
): ArchiveIndexCalendar | undefined {
  const first = days[0];
  if (first === undefined) {
    return undefined;
  }
  const month = monthOf(first.date);
  return { month, dates: archivedDates(days, month) };
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
