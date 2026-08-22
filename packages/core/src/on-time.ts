import { epochDay } from "./date";

/**
 * How many days back a late sync can still be credited as on time, given a
 * server-recorded seen day. Distinct from the write window (`isWritableDate`)
 * and the stats calendar clamp (`ROLLOVER_SLACK_DAYS`) — three different
 * questions, three owners; do not merge them.
 */
export const LATE_SYNC_CREDIT_DAYS_BACK = 1;

/**
 * Whether `date` is strictly in the past, at most `LATE_SYNC_CREDIT_DAYS_BACK`
 * days behind `today`. The single spelling of the credit window — callers
 * must use this rather than re-deriving it.
 */
export function isWithinCreditWindow(date: string, today: string): boolean {
  const daysBack = epochDay(today) - epochDay(date);
  return daysBack >= 1 && daysBack <= LATE_SYNC_CREDIT_DAYS_BACK;
}

/**
 * Decides `on_time` for a completion written now: true if `date` is today,
 * or if `date` is within the credit window and the user was seen that day.
 */
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
