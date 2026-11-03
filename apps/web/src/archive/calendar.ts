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

export function adjacentPeriods(
  newestFirst: readonly string[],
  period: string,
): {
  readonly previous: string | undefined;
  readonly next: string | undefined;
} {
  const index = newestFirst.indexOf(period);
  return {
    previous: index === -1 ? undefined : newestFirst[index + 1],
    next: index <= 0 ? undefined : newestFirst[index - 1],
  };
}

export interface ArchivePeriodCell {
  readonly period: string;
  readonly linked: boolean;
}

export function publishedYears(months: readonly string[]): readonly string[] {
  return [...new Set(months.map((month) => month.slice(0, 4)))];
}

export function archiveYears(
  months: readonly string[],
): readonly ArchivePeriodCell[] {
  const published = publishedYears(months);
  if (published.length === 0) {
    return [];
  }
  const newest = Number(published[0]);
  const oldest = Number(published.at(-1));
  return Array.from({ length: newest - oldest + 1 }, (_, index) => {
    const period = String(oldest + index);
    return { period, linked: published.includes(period) };
  });
}

export function yearMonths(
  year: string,
  months: readonly string[],
): readonly ArchivePeriodCell[] {
  return Array.from({ length: 12 }, (_, index) => {
    const period = `${year}-${String(index + 1).padStart(2, "0")}`;
    return { period, linked: months.includes(period) };
  });
}
