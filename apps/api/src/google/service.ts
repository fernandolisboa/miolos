import { eq, sql, users, type Db } from "@miolos/db";
import { mergeAccounts } from "@miolos/db/user";

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
): Promise<{ googleId: string | null; identified: boolean }> {
  const rows = await db
    .select({
      email: users.email,
      emailVerifiedAt: users.emailVerifiedAt,
      appleId: users.appleId,
      googleId: users.googleId,
    })
    .from(users)
    .where(eq(users.id, userId));
  const row = rows[0];
  if (!row) {
    throw new Error(`google sign-in: requester ${userId} has no users row`);
  }
  return {
    googleId: row.googleId,
    identified:
      row.email !== null ||
      row.emailVerifiedAt !== null ||
      row.appleId !== null ||
      row.googleId !== null,
  };
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

// See ADR-0089: an identified requester switches, an anonymous one merges.
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
  if (holder === undefined) {
    if (requester.googleId !== null) {
      return { outcome: "conflict" };
    }
    return (await linkGoogle(db, requesterId, sub))
      ? { outcome: "ok", userId: requesterId }
      : { outcome: "conflict" };
  }

  if (requester.identified) {
    return { outcome: "switched", userId: holder };
  }
  const { winnerId } = await mergeAccounts(db, requesterId, holder);
  return { outcome: "ok", userId: winnerId };
}

export async function readGoogleLink(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ googleId: users.googleId })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0]?.googleId != null;
}
