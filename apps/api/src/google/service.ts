import type { AccountGoogleResponse } from "@miolos/core";
import { eq, sql, users, type Db } from "@miolos/db";
import { holdsIdentityHandle, mergeAccounts } from "@miolos/db/user";

import {
  createSessionForUser,
  deleteSession,
  sessionExists,
} from "../session/service";

async function findGoogleHolder(
  db: Db,
  sub: string,
): Promise<string | undefined> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleId, sub));
  return rows[0]?.id;
}

async function readIdentity(
  db: Db,
  userId: string,
): Promise<{ googleId: string | null; identified: boolean } | undefined> {
  const rows = await db
    .select({
      googleId: users.googleId,
      identified: sql<boolean>`${holdsIdentityHandle()}`,
    })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}

async function linkGoogle(
  db: Db,
  userId: string,
  sub: string,
): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ googleId: sub, updatedAt: sql`now()` })
    .where(sql`${users.id} = ${userId} and ${users.googleId} is null`)
    .returning();
  return rows.length === 1;
}

export async function unlinkGoogle(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .update(users)
    .set({ googleId: null, updatedAt: sql`now()` })
    .where(sql`${users.id} = ${userId} and ${users.googleId} is not null`)
    .returning();
  return rows.length === 1;
}

type GoogleSessions = {
  requesterId: string | undefined;
  presentedHash: string | undefined;
  freshHash: string;
};

async function createGoogleUser(db: Db, sub: string): Promise<string> {
  const created = await db.insert(users).values({ googleId: sub }).returning();
  const fresh = created[0];
  if (!fresh) {
    throw new Error("google sign-in: users insert returned no row");
  }
  return fresh.id;
}

async function assertHolder(db: Db, sub: string, userId: string) {
  if ((await findGoogleHolder(db, sub)) !== userId) {
    throw new Error("google sign-in: the account lost its Google id mid-flow");
  }
}

async function rotateInto(
  db: Db,
  sub: string,
  userId: string,
  session: GoogleSessions,
): Promise<void> {
  await createSessionForUser(db, session.freshHash, userId);
  try {
    await assertHolder(db, sub, userId);
  } catch (error) {
    await deleteSession(db, session.freshHash);
    throw error;
  }
  if (session.presentedHash !== undefined) {
    await deleteSession(db, session.presentedHash);
  }
}

export async function resolveGoogleSignIn(
  db: Db,
  sub: string,
  session: GoogleSessions,
): Promise<"ok" | "switched" | "conflict"> {
  const holder = await findGoogleHolder(db, sub);
  const { requesterId } = session;

  if (requesterId === undefined || requesterId === holder) {
    await rotateInto(
      db,
      sub,
      holder ?? (await createGoogleUser(db, sub)),
      session,
    );
    return "ok";
  }

  const requester = await readIdentity(db, requesterId);
  if (!requester) {
    throw new Error(
      `google sign-in: requester ${requesterId} has no users row`,
    );
  }
  if (requester.identified) {
    if (holder !== undefined) {
      await rotateInto(db, sub, holder, session);
      return "switched";
    }
    if (!(await linkGoogle(db, requesterId, sub))) {
      return "conflict";
    }
    await rotateInto(db, sub, requesterId, session);
    return "ok";
  }

  const googleUserId = holder ?? (await createGoogleUser(db, sub));
  await createSessionForUser(db, session.freshHash, googleUserId);
  try {
    await mergeAccounts(db, requesterId, googleUserId, requesterId);
  } catch (error) {
    if (
      session.presentedHash !== undefined &&
      (await sessionExists(db, session.presentedHash))
    ) {
      await deleteSession(db, session.freshHash);
    }
    throw error;
  }
  await assertHolder(db, sub, googleUserId);
  return "ok";
}

export async function readGoogleState(
  db: Db,
  userId: string,
  configured: boolean,
): Promise<AccountGoogleResponse["google"]> {
  if ((await readIdentity(db, userId))?.googleId != null) {
    return "linked";
  }
  return configured ? "unlinked" : "unavailable";
}
