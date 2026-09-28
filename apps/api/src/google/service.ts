import type { AccountGoogleResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { holdsIdentityHandle, mergeAccounts } from "@miolos/db/user";

import { deleteSession } from "../session/service";

export type GoogleSignIn =
  { outcome: "ok" | "switched"; userId: string } | { outcome: "conflict" };

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

async function listSessionHashes(db: Db, userId: string): Promise<string[]> {
  const rows = await db
    .select({ tokenHash: sessions.tokenHash })
    .from(sessions)
    .where(eq(sessions.userId, userId));
  return rows.map((row) => row.tokenHash);
}

export async function resolveGoogleSignIn(
  db: Db,
  requesterId: string | undefined,
  sub: string,
): Promise<GoogleSignIn> {
  const holder = await findGoogleHolder(db, sub);

  if (requesterId === undefined) {
    if (holder !== undefined) {
      return { outcome: "ok", userId: holder };
    }
    const created = await db
      .insert(users)
      .values({ googleId: sub })
      .returning();
    const fresh = created[0];
    if (!fresh) {
      throw new Error("google sign-in: users insert returned no row");
    }
    return { outcome: "ok", userId: fresh.id };
  }

  if (holder === requesterId) {
    return { outcome: "ok", userId: holder };
  }

  const requester = await readIdentity(db, requesterId);
  if (!requester) {
    throw new Error(
      `google sign-in: requester ${requesterId} has no users row`,
    );
  }
  if (holder !== undefined && requester.identified) {
    return { outcome: "switched", userId: holder };
  }
  if (holder === undefined && requester.googleId !== null) {
    return { outcome: "conflict" };
  }

  // An anonymous requester's sessions were never proven by this Google
  // account, so none of them may end up on it (ADR-0089).
  const unproven = requester.identified
    ? []
    : await listSessionHashes(db, requesterId);
  let userId: string;
  if (holder === undefined) {
    if (!(await linkGoogle(db, requesterId, sub))) {
      return { outcome: "conflict" };
    }
    userId = requesterId;
  } else {
    userId = (await mergeAccounts(db, requesterId, holder)).winnerId;
    if (userId !== holder) {
      throw new Error(
        "google sign-in: the holder lost its Google id mid-merge",
      );
    }
  }
  for (const tokenHash of unproven) {
    await deleteSession(db, tokenHash);
  }
  return { outcome: "ok", userId };
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
