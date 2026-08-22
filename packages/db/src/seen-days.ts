import { and, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { userSeenDays } from "./schema";

/**
 * No JS `Date` appears in any statement in this file — the DB clock names
 * the day (ADR-0010).
 *
 * The seen-days table is consulted exactly once per completion, at write
 * time (`wasSeenOn` below) — no streak, statistics or medal computation
 * reads it, so a streak stays derivable from completion rows alone
 * (ADR-0009).
 */

/**
 * Record that `userId` was seen online on the DB clock's São Paulo today.
 * Idempotent, one round trip.
 *
 * Shaped `INSERT … SELECT … WHERE NOT EXISTS` rather than bare
 * `ON CONFLICT DO NOTHING`: this runs on every authenticated request, and
 * after the day's first request the common case is the conflict — the
 * `WHERE NOT EXISTS` prefilter makes that case a pure index probe that
 * writes nothing, where speculative insertion would still write a dead
 * tuple. `ON CONFLICT DO NOTHING` stays for the one race it still covers:
 * two concurrent first-requests of the day.
 *
 * Called from the session service's three write points, always awaited —
 * an error here becomes the request's 500 rather than a silently
 * unrecorded day.
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
 * Deletes rows older than `today − 1`, mirroring
 * `LATE_SYNC_CREDIT_DAYS_BACK` (packages/core) — only that range is ever
 * read by `wasSeenOn`. Widening that constant means widening this
 * predicate too. Run by the existing daily `/cron/publish` route.
 */
export async function pruneSeenDays(db: Db): Promise<void> {
  await db.execute(
    sql`delete from ${userSeenDays}
        where ${userSeenDays.date} < (now() at time zone ${SAO_PAULO_TIME_ZONE})::date - 1`,
  );
}
