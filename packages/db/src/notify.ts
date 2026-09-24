import { sql, type SQL } from "drizzle-orm";

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

type TickArgs = { today: string; hour: number };

function habitualHours(today: string): SQL {
  return sql`
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
    )`;
}

function atRiskNow(
  args: TickArgs,
  userId: SQL,
  channel: "push" | "email",
): SQL {
  const { today, hour } = args;
  return sql`h.habitual_hour = ${hour}::int
      and exists (select 1 from completions y
                  where y.user_id = ${userId} and y.date = ${today}::date - 1
                    and y.outcome = 'won' and y.on_time)
      and not exists (select 1 from completions t
                  where t.user_id = ${userId} and t.date = ${today}::date
                    and t.outcome = 'won' and t.on_time)
      and not exists (select 1 from notification_sends n
                  where n.user_id = ${userId} and n.date = ${today}::date
                    and n.channel = ${channel})`;
}

export async function listPushNudgeCandidates(
  db: Db,
  args: TickArgs,
): Promise<string[]> {
  const result = await db.execute(sql`
    ${habitualHours(args.today)}
    select distinct p.user_id
    from push_subscriptions p
    join habitual h on h.user_id = p.user_id
    where ${atRiskNow(args, sql`p.user_id`, "push")}
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

export async function listEmailNudgeCandidates(
  db: Db,
  args: TickArgs,
): Promise<{ userId: string; email: string }[]> {
  const result = await db.execute(sql`
    ${habitualHours(args.today)}
    select u.id as user_id, u.email
    from users u
    join habitual h on h.user_id = u.id
    where u.reminder_consent_at is not null
      and u.email is not null and u.email_verified_at is not null
      and not exists (select 1 from push_subscriptions p where p.user_id = u.id)
      and ${atRiskNow(args, sql`u.id`, "email")}
  `);
  return result.rows.map((row) => {
    const userId: unknown = row["user_id"];
    const email: unknown = row["email"];
    if (typeof userId !== "string" || typeof email !== "string") {
      throw new Error(
        "listEmailNudgeCandidates: unexpected row shape from the database",
      );
    }
    return { userId, email };
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
