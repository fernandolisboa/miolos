import { eq, sql, users, type Db } from "@miolos/db";

export async function getAccountState(
  db: Db,
  userId: string,
): Promise<{ email: string | null; reminderConsent: boolean }> {
  const rows = await db
    .select({
      email: users.email,
      reminderConsentAt: users.reminderConsentAt,
    })
    .from(users)
    .where(eq(users.id, userId));
  const row = rows[0];
  return {
    email: row?.email ?? null,
    reminderConsent: row?.reminderConsentAt != null,
  };
}

export async function withdrawReminderConsent(
  db: Db,
  userId: string,
): Promise<void> {
  await db.execute(sql`
    with changed as (
      update users
         set reminder_consent_at = null,
             reminder_consent_withdrawn_at = now(),
             updated_at = now()
       where id = ${userId} and reminder_consent_at is not null
      returning id
    )
    insert into consent_events (user_id, consent, action)
    select id, 'reminder', 'withdrawn' from changed
  `);
}

export async function grantReminderConsent(
  db: Db,
  userId: string,
): Promise<boolean> {
  const result = await db.execute(sql`
    with target as (
      select id, reminder_consent_at
        from users
       where id = ${userId} and email is not null
         for update
    ), changed as (
      update users u
         set reminder_consent_at = now(),
             updated_at = now()
        from target t
       where u.id = t.id and t.reminder_consent_at is null
      returning u.id
    ), logged as (
      insert into consent_events (user_id, consent, action)
      select id, 'reminder', 'granted' from changed
    )
    select count(*)::int as attached from target
  `);
  return result.rows[0]?.["attached"] === 1;
}

export async function detachEmail(db: Db, userId: string): Promise<boolean> {
  const result = await db.execute(sql`
    with target as (
      select id, recovery_consent_at, reminder_consent_at
        from users
       where id = ${userId} and email is not null
         for update
    ), changed as (
      update users u
         set email = null,
             email_verified_at = null,
             recovery_consent_at = null,
             reminder_consent_at = null,
             recovery_consent_withdrawn_at = case
               when t.recovery_consent_at is null
               then u.recovery_consent_withdrawn_at else now() end,
             reminder_consent_withdrawn_at = case
               when t.reminder_consent_at is null
               then u.reminder_consent_withdrawn_at else now() end,
             attach_prompt_dismissed_at =
               coalesce(u.attach_prompt_dismissed_at, now()),
             updated_at = now()
        from target t
       where u.id = t.id
      returning u.id,
                t.recovery_consent_at is not null as had_recovery,
                t.reminder_consent_at is not null as had_reminder
    ), logged as (
      insert into consent_events (user_id, consent, action)
      select id, 'recovery', 'withdrawn' from changed where had_recovery
      union all
      select id, 'reminder', 'withdrawn' from changed where had_reminder
    )
    select count(*)::int as detached from changed
  `);
  return result.rows[0]?.["detached"] === 1;
}
