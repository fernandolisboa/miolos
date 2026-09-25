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
  await db
    .update(users)
    .set({
      reminderConsentAt: null,
      reminderConsentWithdrawnAt: sql`case when ${users.reminderConsentAt} is null then ${users.reminderConsentWithdrawnAt} else now() end`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}

export async function grantReminderConsent(
  db: Db,
  userId: string,
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({
      reminderConsentAt: sql`coalesce(${users.reminderConsentAt}, now())`,
      reminderConsentWithdrawnAt: null,
      updatedAt: sql`now()`,
    })
    .where(sql`${users.id} = ${userId} and ${users.email} is not null`)
    .returning();
  return rows.length > 0;
}

export async function detachEmail(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({
      email: null,
      emailVerifiedAt: null,
      recoveryConsentAt: null,
      reminderConsentAt: null,
      recoveryConsentWithdrawnAt: sql`case when ${users.recoveryConsentAt} is null then ${users.recoveryConsentWithdrawnAt} else now() end`,
      reminderConsentWithdrawnAt: sql`case when ${users.reminderConsentAt} is null then ${users.reminderConsentWithdrawnAt} else now() end`,
      attachPromptDismissedAt: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(sql`${users.id} = ${userId} and ${users.email} is not null`)
    .returning();
  return rows.length > 0;
}
