export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

export function isWeekday(value: number): value is Weekday {
  return Number.isInteger(value) && value >= 1 && value <= 7;
}
