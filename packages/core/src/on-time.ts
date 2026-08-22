import { epochDay } from "./date";

/**
 * How many days back a late sync can still be credited as on time, given a
 * server-recorded seen day. Distinct from the write window (`isWritableDate`)
 * and the stats calendar clamp (`ROLLOVER_SLACK_DAYS`) — three different
 * questions, three owners; do not merge them.
 *
 * **1 is Fernando's product call, and widening it is an ADR-0066 amendment,
 * not a tweak.** It drags two coupled edits with it: the seen-days retention
 * predicate in `packages/db/src/seen-days.ts` (`pruneSeenDays`), and the
 * multi-past-date guard, which ADR-0066 decision 6 requires be folded into
 * the insert at that point rather than left read-then-act.
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
 * or if `date` is within the credit window and the user was seen that day
 * (ADR-0066).
 *
 * The surprising consequence, stated because it is a streak semantic and not
 * an implementation detail: a user who was SEEN yesterday and solves
 * yesterday from the archive today is credited on time.
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
