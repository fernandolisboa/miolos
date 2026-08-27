import type { SessionResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { recordSeenDay } from "@miolos/db/user";

import { hashSessionToken } from "./token";

const STALE_AFTER_MS = 60 * 60 * 1000;

export async function resolveSession(
  db: Db,
  tokenHash: string,
): Promise<SessionResponse | undefined> {
  const rows = await db
    .select({ userId: sessions.userId, lastSeenAt: sessions.lastSeenAt })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash));
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  if (Date.now() - row.lastSeenAt.getTime() >= STALE_AFTER_MS) {
    await db
      .update(sessions)
      .set({ lastSeenAt: sql`now()` })
      .where(
        sql`${sessions.tokenHash} = ${tokenHash} and ${sessions.lastSeenAt} < now() - interval '1 hour'`,
      );
  }

  await recordSeenDay(db, row.userId);
  return { userId: row.userId, created: false };
}

export async function mintSession(
  db: Db,
  tokenHash: string,
): Promise<SessionResponse> {
  const inserted = await db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  await db.insert(sessions).values({ tokenHash, userId: user.id });

  await recordSeenDay(db, user.id);
  return { userId: user.id, created: true };
}

export async function createSessionForUser(
  db: Db,
  tokenHash: string,
  userId: string,
): Promise<void> {
  await db.insert(sessions).values({ tokenHash, userId });

  await recordSeenDay(db, userId);
}

export async function requireUserId(
  db: Db,
  token: string | undefined,
): Promise<string | undefined> {
  if (!token) {
    return undefined;
  }
  const resolved = await resolveSession(db, await hashSessionToken(token));
  return resolved?.userId;
}
