import { eq, users, type Db } from "@miolos/db";

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
