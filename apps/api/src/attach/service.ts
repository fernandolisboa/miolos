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
  { userId: string; email: string; reminderConsent: boolean } | undefined
> {
  const rows = await db
    .delete(attachTokens)
    .where(
      sql`${attachTokens.tokenHash} = ${tokenHash} and ${attachTokens.createdAt} > now() - interval '30 minutes'`,
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
  init: { userId: string; email: string; reminderConsent: boolean },
): Promise<void> {
  await db
    .update(users)
    .set({
      email: init.email,
      emailVerifiedAt: sql`now()`,
      recoveryConsentAt: sql`now()`,
      ...(init.reminderConsent ? { reminderConsentAt: sql`now()` } : {}),
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, init.userId));
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
