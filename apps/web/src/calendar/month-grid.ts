import { dateFromEpochDay, epochDay } from "@miolos/core";

export const WEEK_LENGTH = 7;

export interface MonthCells<T> {
  readonly month: string;

  readonly cells: readonly (T | null)[];
}

export function buildMonthCells<T>(
  monthKey: string,
  cellAt: (day: number) => T,
): MonthCells<T> {
  const firstOfMonth = `${monthKey}-01`;
  const firstDay = epochDay(firstOfMonth);
  const daysInMonth = epochDay(nextMonthFirst(monthKey)) - firstDay;

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

function nextMonthFirst(monthKey: string): string {
  const nextMonthDay = dateFromEpochDay(epochDay(`${monthKey}-28`) + 7);
  return `${nextMonthDay.slice(0, 7)}-01`;
}
