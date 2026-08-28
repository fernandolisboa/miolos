import { sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { notificationSends } from "./schema";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

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
