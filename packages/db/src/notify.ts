import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { notificationSends } from "./schema";

/**
 * No JS `Date` appears in any statement in this file: `today` and `hour`
 * come from one Postgres read (`readTickInstant` below), and every
 * comparison runs in SQL.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The SP calendar day and hour, read in one statement so the pair can never straddle midnight against each other. */
export async function readTickInstant(
  db: Db,
): Promise<{ today: string; hour: number }> {
  const result = await db.execute(
    sql`select ((now() at time zone ${SAO_PAULO_TIME_ZONE})::date)::text as today,
               extract(hour from now() at time zone ${SAO_PAULO_TIME_ZONE})::int as hour`,
  );
  const today: unknown = result.rows[0]?.["today"];
  const hour: unknown = result.rows[0]?.["hour"];
  if (typeof today !== "string" || !ISO_DATE.test(today)) {
    throw new Error(
      "readTickInstant: unexpected `today` shape from the database",
    );
  }
  if (
    typeof hour !== "number" ||
    !Number.isInteger(hour) ||
    hour < 0 ||
    hour > 23
  ) {
    throw new Error(
      "readTickInstant: unexpected `hour` shape from the database",
    );
  }
  return { today, hour };
}

/**
 * Every subscribed user whose streak is at risk today, whose habitual hour
 * is `hour`, and whose push nudge for `today` isn't already claimed.
 *
 * The habitual hour is `percentile_disc(0.5)` over each counted day's
 * earliest on-time completion, floored to the hour rather than
 * round-half-up: half-up would round a 23:40 habit to hour 0 and fire the
 * nudge at the 00:xx tick of the at-risk day itself — minutes after the
 * user finished playing and ~24h before the deadline. Floor lands it at
 * 23:xx instead, just before the habitual minute.
 *
 * A credited (synced-late) row's `completed_at` is the sync instant, not
 * the play instant, and still feeds the median as a sample — an accepted
 * imperfection.
 *
 * The ledger's `not exists` is a prefilter only; `claimNudgeSend` below is
 * the actual race authority.
 */
export async function listPushNudgeCandidates(
  db: Db,
  args: { today: string; hour: number },
): Promise<string[]> {
  const { today, hour } = args;
  const result = await db.execute(sql`
    with counted_day_starts as (
      select c.user_id, c.date, min(c.completed_at) as first_on_time
      from completions c
      where c.outcome = 'won' and c.on_time
        and c.date >= ${today}::date - 21 and c.date < ${today}::date
      group by c.user_id, c.date
    ),
    habitual as (
      select user_id,
             (percentile_disc(0.5) within group (
                order by extract(hour from first_on_time at time zone ${SAO_PAULO_TIME_ZONE})
              ))::int as habitual_hour
      from counted_day_starts
      group by user_id
    )
    select distinct p.user_id
    from push_subscriptions p
    join habitual h on h.user_id = p.user_id
    where h.habitual_hour = ${hour}::int
      and exists (select 1 from completions y
                  where y.user_id = p.user_id and y.date = ${today}::date - 1
                    and y.outcome = 'won' and y.on_time)
      and not exists (select 1 from completions t
                  where t.user_id = p.user_id and t.date = ${today}::date
                    and t.outcome = 'won' and t.on_time)
      and not exists (select 1 from notification_sends n
                  where n.user_id = p.user_id and n.date = ${today}::date
                    and n.channel = 'push')
  `);
  return result.rows.map((row) => {
    const userId: unknown = row["user_id"];
    if (typeof userId !== "string") {
      throw new Error(
        "listPushNudgeCandidates: unexpected row shape from the database",
      );
    }
    return userId;
  });
}

/**
 * `INSERT … ON CONFLICT DO NOTHING RETURNING` — race-safe without a
 * transaction, since neon-http supports only single-statement queries.
 * `true` means this call owns the send.
 *
 * Runs BEFORE any send (claim-first): a crash between claim and send
 * drops that user's nudge for the day, chosen over risking a double send.
 */
export async function claimNudgeSend(
  db: Db,
  args: { userId: string; date: string; channel: "push" | "email" },
): Promise<boolean> {
  const inserted = await db
    .insert(notificationSends)
    .values({ userId: args.userId, date: args.date, channel: args.channel })
    .onConflictDoNothing({
      target: [
        notificationSends.userId,
        notificationSends.date,
        notificationSends.channel,
      ],
    })
    .returning();
  return inserted.length > 0;
}
