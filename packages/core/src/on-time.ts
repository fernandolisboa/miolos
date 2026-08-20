import { epochDay } from "./date";

/**
 * The write-time on-time rule (#58, ADR-0066, amending ADR-0026 decision 2
 * and ADR-0008's derivability sentence). Pure: values in, verdict out — the
 * `streak.ts` register (no clock, no timezone, no I/O). The ONE caller is
 * `POST /completions`, which stores the verdict on the row at write time;
 * no read path ever re-derives it (ADR-0009's constraint is exactly that a
 * streak stays derivable from completion rows alone, which storage is what
 * preserves once the seen-fact enters the definition).
 */

/**
 * How many days back a late sync may still be CREDITED as on time, given a
 * server-recorded seen day. Fernando's 2026-08-02 decision on #58:
 * "`ACCEPTED_DAYS_BACK` stays 1. Nothing here widens it." Widening it is an
 * ADR amendment (ADR-0066), never a tweak — and it drags two other edits
 * with it: the seen-days retention predicate in `/cron/publish`, and the
 * multi-past-date guard, which must fold into the insert the moment more
 * than one past date can legitimately carry a credit.
 *
 * ONE OWNER, ONE IDEA — the #31 lesson (`ROLLOVER_SLACK_DAYS`): this is NOT
 * the write window (`isWritableDate`, unbounded below since ADR-0053) and
 * NOT the stats calendar's clamp (`ROLLOVER_SLACK_DAYS`). Three different
 * questions, three owners; never merge them back into one constant. The
 * constant's ONE predicate spelling is `isWithinCreditWindow` below —
 * `onTimeAtWrite`'s credit branch and `POST /completions`' seen-read gate
 * both call it, so the window cannot be re-derived in a second dialect
 * (the step-6 quality M1 finding: a silent disagreement there would read
 * as an unseen user, a missing credit with no error and no failing test).
 */
export const LATE_SYNC_CREDIT_DAYS_BACK = 1;

/**
 * Is `date` inside the credit window relative to `today` — strictly past,
 * at most `LATE_SYNC_CREDIT_DAYS_BACK` days back? THE ONE SPELLING of the
 * window (see the constant's doc block): the route's seen-read gate and
 * `onTimeAtWrite`'s credit branch both call this, never a re-derivation.
 * A future date has a negative delta and answers false; `today` itself
 * answers false (a today-dated write needs no credit — it is on time by
 * construction). Pure `epochDay` arithmetic, no clock, no JS Date.
 */
export function isWithinCreditWindow(date: string, today: string): boolean {
  const daysBack = epochDay(today) - epochDay(date);
  return daysBack >= 1 && daysBack <= LATE_SYNC_CREDIT_DAYS_BACK;
}

/**
 * Decide `on_time` for a completion being written now (T-CORE-S105):
 *
 * - `date === today` → `true`. Identical to the pre-#58 derivation:
 *   `completed_at` is the DB clock at insert, so a row whose puzzle date is
 *   the DB clock's SP today was completed during its own day.
 * - `date` inside the credit window (`isWithinCreditWindow`) ∧ `seenOnDate`
 *   → `true`. THE CREDIT: the server itself recorded the user online on the
 *   puzzle's own day (`user_seen_days`), so the sync's lateness is the
 *   connection's fault, not the player's — "a connection drop mid-puzzle
 *   never costs the day" (#18), made true. The rule is date-and-seen
 *   shaped, deliberately: the server cannot distinguish a queued offline
 *   flush from a deliberate archive solve of yesterday's daily without
 *   trusting the client clock, so a SEEN user's archive solve of
 *   yesterday IS credited too (ADR-0066's archive-credit consequence).
 * - otherwise → `false` (played/late, ADR-0008's existing verbs): unseen
 *   late syncs and every archive write older than the window. The failure
 *   direction of an unrecorded seen day is the status quo — late — never
 *   a false credit.
 *
 * `today` is always `todaySaoPaulo(db)` — the DB clock (ADR-0010); the
 * calendar math here is `epochDay`'s pure arithmetic, no JS Date.
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
