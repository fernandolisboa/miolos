import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { notificationSends } from "./schema";

/**
 * The streak-at-risk dispatcher's statements (#146, ADR-0064, ADR-0067) —
 * cross-table (completions × push_subscriptions × notification_sends), so
 * they live in `packages/db` (merge.ts's recorded rule: this package owns
 * cross-table operations, apps/api owns route-shaped workflows).
 * User-scoped: reachable only through `@miolos/db/user` (ADR-0026
 * decision 5), never the root entry — apps/web cannot name any of this.
 *
 * NO JS `Date` appears in any statement in this file (the schema.ts law):
 * `today` and `hour` arrive as values a single Postgres read produced
 * (`readTickInstant` below), and every cast and comparison runs in SQL.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * The one-snapshot tick instant (ADR-0067 decision 3): the SP calendar day
 * and the SP hour, read in ONE statement so the pair can never straddle
 * midnight against each other. The route reads it once and passes it down —
 * everything below takes `{today, hour}` as parameters, which is what makes
 * every behavioral test real-clock-free while "DB clock only" stays
 * literally true: the values originate in one Postgres read and JS never
 * computes a date or an hour.
 *
 * The `todaySaoPaulo` shape-check register (buffer.ts): parse the row,
 * throw on surprise.
 */
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
 * The candidate read: every subscribed user whose streak is at risk today
 * AND whose habitual hour is `hour` AND whose nudge for `today` is not
 * already claimed. Returns user ids only — `completed_at` never leaves SQL,
 * and `CompletionRecord` is untouched.
 *
 * ADR-0064 decision 1's spelling, implemented: "median SP minute-of-day …
 * rounded to the hour" is `percentile_disc(0.5)` over the per-counted-day
 * EARLIEST instant's EXTRACTED hour. Extraction is the floor of
 * minute-of-day to the hour — equivalent to flooring the median sample's
 * minute-of-day — and floor rather than round-half-up is deliberate:
 * half-up rounds a 23:40 habit to hour 0, and that nudge still fires, at
 * the worst possible moment — the 00:xx tick of the at-risk day itself
 * (yesterday counted, today not), ~24 h before the deadline and minutes
 * after the user habitually finished playing. Floor lands it at the 23:xx
 * tick: just before the habitual minute and ~1 h before the rollover.
 *
 * The sample deliberately NARROWS d1's "earliest on-time completion" to
 * won ∧ on-time rows — one predicate does both the counted-day job and the
 * sample job; a lost-but-on-time earlier play is excluded (recorded in
 * ADR-0067's prefilter note). An ADR-0066 credited yesterday satisfies the
 * conjuncts by design, and its `completed_at` — the sync instant, not a
 * play instant — feeds the median as a sample (accepted imperfection).
 *
 * - The 21-day window is `[today − 21, today)`. Cold start is structurally
 *   absent: a candidate counted yesterday has ≥ 1 sample by construction.
 * - The counted-day conjuncts (won ∧ on-time) are ADR-0048's PREFILTER,
 *   not a second streak definition: `computeStreak` stays the only streak
 *   authority — the copy's number comes from it, and T-API-S144 pins the
 *   sent number to it. Running `computeStreak` over every user per tick is
 *   the rejected alternative (cost without a correctness gain; ADR-0067).
 * - The ledger `not exists` is a PREFILTER ONLY — `claimNudgeSend` below
 *   is the race authority. It matches the 'push' channel alone, so slice
 *   C's email arm claims independently on the same ledger.
 * - The habitual CTE aggregates over EVERY user with in-window completions
 *   before the push_subscriptions join (the planner will not reliably push
 *   the join through the GROUP BY). Harmless at v1 scale; the recorded
 *   restructure, if tick timings ever show it, is a subscriber prefilter
 *   inside the CTE.
 * - Rides `completions_user_date_idx`. No new index (schema.ts).
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
 * The claim — the RACE AUTHORITY of the ledger (ADR-0064 decision 7):
 * `INSERT … ON CONFLICT DO NOTHING RETURNING`, the write-once idiom,
 * race-safe without transactions (neon-http is non-interactive-only —
 * merge.ts's recorded constraint). `true` = this call owns the send; a
 * loser of a concurrent double tick sees zero returned rows and sends
 * nothing. `sent_at` is the DB-side default — no JS Date.
 *
 * The claim runs BEFORE any send (claim-first): a crash between claim and
 * send loses that user's nudge for that day — decision 7's priced
 * residual, preferred over a double send. `channel` admits 'email' so
 * slice C rides the same ledger; nothing passes it today.
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
