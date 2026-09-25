import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { attachTokens } from "@miolos/db/user";

export async function cleanupStaleTokens(db: Db): Promise<void> {
  await db
    .delete(attachTokens)
    .where(sql`${attachTokens.createdAt} <= now() - interval '1 hour'`);
}

export async function countRecentTokens(
  db: Db,
  userId: string,
): Promise<number> {
  const rows = await db
    .select({ tokenHash: attachTokens.tokenHash })
    .from(attachTokens)
    .where(
      sql`${attachTokens.userId} = ${userId} and ${attachTokens.createdAt} > now() - interval '1 hour'`,
    );
  return rows.length;
}

export async function countRecentTokensForEmail(
  db: Db,
  email: string,
): Promise<number> {
  const rows = await db
    .select({ tokenHash: attachTokens.tokenHash })
    .from(attachTokens)
    .where(
      sql`${attachTokens.email} = ${email} and ${attachTokens.createdAt} > now() - interval '1 hour'`,
    );
  return rows.length;
}

export async function mintAttachToken(
  db: Db,
  init: {
    userId: string;
    email: string;
    reminderConsent: boolean;
    tokenHash: string;
  },
): Promise<void> {
  await db.insert(attachTokens).values({
    tokenHash: init.tokenHash,
    userId: init.userId,
    email: init.email,
    reminderConsent: init.reminderConsent,
  });
}

export async function claimAttachToken(
  db: Db,
  tokenHash: string,
): Promise<
  | { userId: string; email: string; reminderConsent: boolean; createdAt: Date }
  | undefined
> {
  const rows = await db
    .delete(attachTokens)
    .where(
      sql`${attachTokens.tokenHash} = ${tokenHash} and ${attachTokens.createdAt} > now() - interval '30 minutes'
        and not exists (
          select 1 from users w
           where w.id = ${attachTokens.userId}
             and ${attachTokens.createdAt} <= w.recovery_consent_withdrawn_at
        )`,
    )
    .returning();
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  return {
    userId: row.userId,
    email: row.email,
    reminderConsent: row.reminderConsent,
    createdAt: row.createdAt,
  };
}

export async function findVerifiedHolder(
  db: Db,
  email: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(
      sql`${users.email} = ${email} and ${users.emailVerifiedAt} is not null`,
    );
  return rows[0]?.id;
}

export async function userOwnsSession(
  db: Db,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .limit(1);
  return rows.length > 0;
}

export async function revokeSessionsForUser(
  db: Db,
  userId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

export async function attachEmailToUser(
  db: Db,
  init: {
    userId: string;
    email: string;
    reminderConsent: boolean;
    tokenCreatedAt: Date;
  },
): Promise<void> {
  await db.execute(sql`
    with target as (
      select id, recovery_consent_at, reminder_consent_at,
             ${init.reminderConsent}::boolean and (
               reminder_consent_withdrawn_at is null
               or ${init.tokenCreatedAt}::timestamptz > reminder_consent_withdrawn_at
             ) as reminder
        from users
       where id = ${init.userId}
         for update
    ), changed as (
      update users u
         set email = ${init.email},
             email_verified_at = now(),
             recovery_consent_at = coalesce(t.recovery_consent_at, now()),
             reminder_consent_at = case
               when t.reminder then coalesce(t.reminder_consent_at, now())
               else u.reminder_consent_at end,
             updated_at = now()
        from target t
       where u.id = t.id
      returning u.id,
                t.recovery_consent_at is null as new_recovery,
                t.reminder and t.reminder_consent_at is null as new_reminder
    )
    insert into consent_events (user_id, consent, action)
    select id, 'recovery', 'granted' from changed where new_recovery
    union all
    select id, 'reminder', 'granted' from changed where new_reminder
  `);
}

export async function dismissAttachPrompt(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ attachPromptDismissedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      sql`${users.id} = ${userId} and ${users.attachPromptDismissedAt} is null`,
    );
}

export async function getAttachAccountState(
  db: Db,
  userId: string,
): Promise<
  { email: string | null; attachPromptDismissedAt: Date | null } | undefined
> {
  const rows = await db
    .select({
      email: users.email,
      attachPromptDismissedAt: users.attachPromptDismissedAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}
