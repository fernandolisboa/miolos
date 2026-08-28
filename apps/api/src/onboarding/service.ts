import { eq, sql, users, type Db } from "@miolos/db";

export async function getOnboardingState(
  db: Db,
  userId: string,
): Promise<{ onboardingSeenAt: Date | null } | undefined> {
  const rows = await db
    .select({ onboardingSeenAt: users.onboardingSeenAt })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}

export async function markOnboardingSeen(
  db: Db,
  userId: string,
): Promise<void> {
  await db
    .update(users)
    .set({ onboardingSeenAt: sql`now()`, updatedAt: sql`now()` })
    .where(sql`${users.id} = ${userId} and ${users.onboardingSeenAt} is null`);
}
