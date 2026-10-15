import { dateFromEpochDay, epochDay, type CalendarDay } from "@miolos/core";

import { buildMonthCells, type MonthCells } from "../calendar/month-grid";

export interface CalendarCell {
  readonly date: string;

  readonly day: CalendarDay | undefined;
}

export type CalendarMonth = MonthCells<CalendarCell>;

export function calendarMonths(
  days: readonly CalendarDay[],
): readonly CalendarMonth[] {
  const byDay = new Map<number, CalendarDay>();
  for (const day of days) {
    byDay.set(epochDay(day.date), day);
  }

  const monthKeys: string[] = [];
  for (const day of days) {
    const key = day.date.slice(0, 7);
    if (monthKeys.at(-1) !== key) {
      monthKeys.push(key);
    }
  }
  const months = monthKeys.map((key) => buildMonth(key, byDay));
  return months.reverse();
}

export function neutralMonth(date: string): CalendarMonth {
  return buildMonth(date.slice(0, 7), new Map());
}

function buildMonth(
  monthKey: string,
  byDay: ReadonlyMap<number, CalendarDay>,
): CalendarMonth {
  return buildMonthCells(monthKey, (day) => ({
    date: dateFromEpochDay(day),
    day: byDay.get(day),
  }));
}
