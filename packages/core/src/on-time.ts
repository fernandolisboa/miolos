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
 * questions, three owners; never merge them back into one constant.
 */
export const LATE_SYNC_CREDIT_DAYS_BACK = 1;

/**
 * Decide `on_time` for a completion being written now (T-CORE-S105):
 *
 * - `date === today` → `true`. Identical to the pre-#58 derivation:
 *   `completed_at` is the DB clock at insert, so a row whose puzzle date is
 *   the DB clock's SP today was completed during its own day.
 * - `date` exactly `LATE_SYNC_CREDIT_DAYS_BACK` back ∧ `seenOnDate` →
 *   `true`. THE CREDIT: the server itself recorded the user online on the
 *   puzzle's own day (`user_seen_days`), so the sync's lateness is the
 *   connection's fault, not the player's — "a connection drop mid-puzzle
 *   never costs the day" (#18), made true.
 * - otherwise → `false` (played/late, ADR-0008's existing verbs): archive
 *   writes and unseen late syncs alike. The failure direction of an
 *   unrecorded seen day is the status quo — late — never a false credit.
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
  return (
    seenOnDate &&
    epochDay(today) - epochDay(date) === LATE_SYNC_CREDIT_DAYS_BACK
  );
}
