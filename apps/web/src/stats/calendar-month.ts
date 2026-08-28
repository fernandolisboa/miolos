import { epochDay, type CalendarDay } from "@miolos/core";

import { buildMonthCells } from "../calendar/month-grid";

export interface CalendarMonth {
  readonly month: string;

  readonly cells: readonly (CalendarDay | null)[];
}

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
  const months = monthKeys.map((key) =>
    buildMonth(key, (day) => byDay.get(day) ?? null),
  );
  return months.reverse();
}

export function neutralMonth(date: string): CalendarMonth {
  return buildMonth(date.slice(0, 7), () => null);
}

function buildMonth(
  monthKey: string,
  cellAt: (day: number) => CalendarDay | null,
): CalendarMonth {
  return buildMonthCells(monthKey, cellAt);
}
