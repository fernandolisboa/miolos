import type { MergeableCompletion } from "@miolos/core";
import { and, asc, eq, inArray, isNotNull, or, sql } from "drizzle-orm";

import type { Db } from "./client";
import {
  completions,
  hintGrants,
  medalGrants,
  pushSubscriptions,
  sessions,
  users,
} from "./schema";

const WINNER_LIVENESS_SIGNATURE = "owns no session or identity handle";

export function isWinnerLivenessError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes(WINNER_LIVENESS_SIGNATURE)
  );
}

function holdsIdentityHandle() {
  return or(
    isNotNull(users.email),
    isNotNull(users.emailVerifiedAt),
    isNotNull(users.appleId),
    isNotNull(users.googleId),
  );
}

function completedAtOrderSql() {
  return sql<string>`to_char(${completions.completedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`;
}

export async function listCompletionsForMerge(
  db: Db,
  userId: string,
): Promise<MergeableCompletion[]> {
  return db
    .select({
      game: completions.game,
      date: completions.date,
      outcome: completions.outcome,
      onTime: completions.onTime,
      completedAtOrder: completedAtOrderSql(),
    })
    .from(completions)
    .where(eq(completions.userId, userId))
    .orderBy(asc(completions.completedAt));
}

export async function mergeAccounts(
  db: Db,
  a: string,
  b: string,
): Promise<{ winnerId: string; loserId: string }> {
  const candidates = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [a, b]))
    .orderBy(
      sql`${holdsIdentityHandle()} desc`,
      asc(users.createdAt),
      asc(users.id),
    );
  const found = new Set(candidates.map((row) => row.id));
  for (const id of [a, b]) {
    if (!found.has(id)) {
      throw new Error(`mergeAccounts: unknown user id ${id}`);
    }
  }
  if (a === b) {
    return { winnerId: a, loserId: a };
  }
  const winnerId = candidates[0]?.id;
  const loserId = candidates[1]?.id;
  if (winnerId === undefined || loserId === undefined) {
    throw new Error("mergeAccounts: winner selection returned too few rows");
  }

  const winnerSessions = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.userId, winnerId))
    .limit(1);
  if (winnerSessions.length === 0) {
    const winnerHandles = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, winnerId), holdsIdentityHandle()))
      .limit(1);
    if (winnerHandles.length === 0) {
      throw new Error(
        `mergeAccounts: winner ${winnerId} ${WINNER_LIVENESS_SIGNATURE} (concurrent merge?)`,
      );
    }
  }

  await db
    .update(sessions)
    .set({ userId: winnerId })
    .where(eq(sessions.userId, loserId));

  await db
    .update(pushSubscriptions)
    .set({ userId: winnerId })
    .where(eq(pushSubscriptions.userId, loserId));

  await db.execute(sql`
    delete from completions w
      using completions l
      where w.user_id = ${winnerId} and l.user_id = ${loserId}
        and w.game = l.game and w.date = l.date
        and l.completed_at < w.completed_at
  `);

  await db.execute(sql`
    insert into completions
      (user_id, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time)
    select ${winnerId}::uuid, game, date, completed_at, outcome, elapsed_ms, hints_used, guesses, on_time
      from completions where user_id = ${loserId}
      order by completed_at asc
    on conflict (user_id, game, date) do nothing
  `);

  await db.delete(completions).where(eq(completions.userId, loserId));

  await db.execute(sql`
    insert into user_seen_days (user_id, date)
    select ${winnerId}::uuid, date
      from user_seen_days where user_id = ${loserId}
    on conflict (user_id, date) do nothing
  `);

  await db.execute(sql`delete from user_seen_days where user_id = ${loserId}`);

  await db.delete(hintGrants).where(eq(hintGrants.userId, loserId));

  await db.execute(sql`
    insert into medal_grants (user_id, medal_id, granted_at)
    select ${winnerId}::uuid, medal_id, granted_at
      from medal_grants where user_id = ${loserId}
    on conflict (user_id, medal_id)
    do update set granted_at = least(medal_grants.granted_at, excluded.granted_at)
  `);

  await db.delete(medalGrants).where(eq(medalGrants.userId, loserId));

  await db.execute(sql`
    update users w
       set onboarding_seen_at =
             least(w.onboarding_seen_at, l.onboarding_seen_at),
           attach_prompt_dismissed_at =
             least(w.attach_prompt_dismissed_at, l.attach_prompt_dismissed_at),
           push_prompt_dismissed_at =
             least(w.push_prompt_dismissed_at, l.push_prompt_dismissed_at),
           updated_at = now()
      from users l
     where w.id = ${winnerId}::uuid
       and l.id = ${loserId}::uuid
       and (
             (l.onboarding_seen_at is not null
              and (w.onboarding_seen_at is null
                   or l.onboarding_seen_at < w.onboarding_seen_at))
          or (l.attach_prompt_dismissed_at is not null
              and (w.attach_prompt_dismissed_at is null
                   or l.attach_prompt_dismissed_at < w.attach_prompt_dismissed_at))
          or (l.push_prompt_dismissed_at is not null
              and (w.push_prompt_dismissed_at is null
                   or l.push_prompt_dismissed_at < w.push_prompt_dismissed_at))
           )
  `);

  await db.execute(sql`
    insert into notification_sends (user_id, date, channel, sent_at)
    select ${winnerId}::uuid, date, channel, sent_at
      from notification_sends where user_id = ${loserId}
    on conflict (user_id, date, channel) do nothing
  `);

  await db.execute(
    sql`delete from notification_sends where user_id = ${loserId}`,
  );

  // One statement, the winner reading the emptied CTE, so the Google id is
  // never on both rows when the unique index is checked (ADR-0089).
  await db.execute(sql`
    with loser as (
      select id, google_id
        from users
       where id = ${loserId}::uuid
         and (email is not null or email_verified_at is not null
              or apple_id is not null or google_id is not null)
         for update
    ), emptied as (
      update users u
         set email = null,
             email_verified_at = null,
             apple_id = null,
             google_id = null,
             updated_at = now()
        from loser l
       where u.id = l.id
      returning u.id
    )
    update users w
       set google_id = l.google_id,
           updated_at = now()
      from loser l, emptied
     where w.id = ${winnerId}::uuid
       and w.google_id is null
       and l.google_id is not null
  `);

  return { winnerId, loserId };
}
