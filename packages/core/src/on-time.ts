import { epochDay } from "./date";

export const LATE_SYNC_CREDIT_DAYS_BACK = 1;

export function isWithinCreditWindow(date: string, today: string): boolean {
  const daysBack = epochDay(today) - epochDay(date);
  return daysBack >= 1 && daysBack <= LATE_SYNC_CREDIT_DAYS_BACK;
}

export function onTimeAtWrite(
  date: string,
  today: string,
  seenOnDate: boolean,
): boolean {
  if (date === today) {
    return true;
  }
  return seenOnDate && isWithinCreditWindow(date, today);
}
