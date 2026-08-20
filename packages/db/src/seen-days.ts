import { and, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { userSeenDays } from "./schema";

/**
 * Seen days (#58, ADR-0066) — user-scoped accessors reachable only through
 * `@miolos/db/user` (ADR-0026 decision 5), never the root entry.
 *
 * NO JS `Date` appears in any statement in this file (the completions.ts
 * header law): the DB clock names the day (ADR-0010 single authority).
 *
 * THE INVARIANT SENTENCE (ADR-0066): the seen-days table is consulted
 * exactly once per completion, at write time, inside `POST /completions`
 * (`wasSeenOn` below); no streak, statistics, medal or day-state
 * computation reads it, and the pure merge recompute (`mergeCompletions`)
 * never consults it — `mergeAccounts` only UNIONS its rows, computing
 * nothing — so a streak remains derivable from completion rows alone
 * (ADR-0009, untouched). The full reference set: this module, the session
 * service's three hooks, `POST /completions`, `mergeAccounts` and the
 * `/cron/publish` retention delete. Nothing else may name the table.
 */

/**
 * Record that `userId` was seen online on the DB clock's São Paulo today
 * (T-DB-S71). Idempotent, and still one statement / one round trip — but
 * shaped `INSERT … SELECT … WHERE NOT EXISTS` rather than bare
 * `VALUES … ON CONFLICT` (step-6 security M2): this runs on EVERY
 * authenticated request, and after the day's first request the row exists,
 * so the common case is the conflict. A bare `ON CONFLICT DO NOTHING`
 * resolves that via speculative insertion — heap tuple written, then
 * super-deleted, plus WAL — N requests, N dead tuples. The `WHERE NOT
 * EXISTS` pre-filter makes the common case a pure index probe that writes
 * nothing; the `ON CONFLICT DO NOTHING` stays for the one race it still
 * covers, two concurrent first-requests of the day. The DB clock names the
 * day both places: no date crosses this seam at all.
 *
 * Called from the session service's three write points (`resolveSession`,
 * `mintSession`, `createSessionForUser`) — awaited, not fire-and-forget:
 * an error here is the request's 500, never a silently unrecorded day.
 *
 * Rejected shapes, recorded in ADR-0066 rather than re-litigated here: a
 * `last_seen_at`-staleness send-gate (under-records the 23:58→00:05
 * persona), and the data-modifying-CTE fold / per-instance memo (unmeasured
 * wins; the ADR names this call as the seam if the +1 round trip shows up).
 */
export async function recordSeenDay(db: Db, userId: string): Promise<void> {
  await db.execute(
    sql`insert into ${userSeenDays} (user_id, date)
        select ${userId}::uuid, (now() at time zone ${SAO_PAULO_TIME_ZONE})::date
        where not exists (
          select 1 from ${userSeenDays}
          where ${userSeenDays.userId} = ${userId}::uuid
            and ${userSeenDays.date} = (now() at time zone ${SAO_PAULO_TIME_ZONE})::date
        )
        on conflict do nothing`,
  );
}

/**
 * Was `userId` seen online on São Paulo day `date`? A PK-point read; the
 * ONE consumer is `POST /completions`, deciding a late sync's credit (the
 * invariant sentence above — a second consumer is an ADR-0066 amendment).
 */
export async function wasSeenOn(
  db: Db,
  userId: string,
  date: string,
): Promise<boolean> {
  const rows = await db
    .select({ date: userSeenDays.date })
    .from(userSeenDays)
    .where(and(eq(userSeenDays.userId, userId), eq(userSeenDays.date, date)))
    .limit(1);
  return rows.length > 0;
}

/**
 * Bounded retention (ADR-0066): only `today − LATE_SYNC_CREDIT_DAYS_BACK`
 * is ever read, so older rows are dead weight (~365/user/year, unioned
 * forever by the merge). One idempotent delete, run by the existing daily
 * `/cron/publish` route — wrapped THERE so its failure logs without masking
 * the publish result. Widening the credit window widens this predicate too
 * (the constant's comment in packages/core names this edit). Unbounded by
 * design and trivially cheap in steady state (≤2 days of rows survive) —
 * but after a multi-day cron outage the recovery is one arbitrarily large
 * DELETE on the publish route's critical path; a `LIMIT`ed loop is the
 * shape to reach for if the window widens or cron reliability changes.
 */
export async function pruneSeenDays(db: Db): Promise<void> {
  await db.execute(
    sql`delete from ${userSeenDays}
        where ${userSeenDays.date} < (now() at time zone ${SAO_PAULO_TIME_ZONE})::date - 1`,
  );
}
