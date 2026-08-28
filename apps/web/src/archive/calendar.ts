import { dateFromEpochDay, GAMES } from "@miolos/core";
import type { ArchivedDay } from "@miolos/db";

import { buildMonthCells, type MonthCells } from "../calendar/month-grid";
import { monthOf } from "./parse-params";

export const NEWEST_MONTH_ROW_WINDOW = 31 * GAMES.length;

export interface ArchiveCalendarCell {
  readonly date: string;

  readonly linked: boolean;
}

export interface ArchiveIndexCalendar {
  readonly month: string;

  readonly dates: ReadonlySet<string>;
}

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

export function archiveCalendarMonth(
  month: string,
  publishedDates: ReadonlySet<string>,
): MonthCells<ArchiveCalendarCell> {
  return buildMonthCells(month, (day) => {
    const date = dateFromEpochDay(day);
    return { date, linked: publishedDates.has(date) };
  });
}
