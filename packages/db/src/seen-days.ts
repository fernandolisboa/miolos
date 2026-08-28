import { and, eq, sql } from "drizzle-orm";

import type { Db } from "./client";
import { SAO_PAULO_TIME_ZONE } from "./published";
import { userSeenDays } from "./schema";

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

export async function pruneSeenDays(db: Db): Promise<void> {
  await db.execute(
    sql`delete from ${userSeenDays}
        where ${userSeenDays.date} < (now() at time zone ${SAO_PAULO_TIME_ZONE})::date - 1`,
  );
}
