import type { SessionResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";

/**
 * Session service (ADR-0022). Takes the db, returns plain data — no
 * Response construction here. Every timestamp is DB-side (`now()`,
 * column defaults): no JS-constructed date ever appears in a query, which
 * is the structural AC-5 guarantee.
 */

/**
 * Look up a session by token hash. On a hit, bump `last_seen_at` only when
 * it is more than 1 hour stale (plan 009 D6): staleness granularity is
 * days, so hourly precision is free and hot-path resolves stay write-free.
 */
export async function resolveSession(
  db: Db,
  tokenHash: string,
): Promise<SessionResponse | undefined> {
  const rows = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(eq(sessions.tokenHash, tokenHash));
  const row = rows[0];
  if (!row) {
    return undefined;
  }
  await db
    .update(sessions)
    .set({ lastSeenAt: sql`now()` })
    .where(
      sql`${sessions.tokenHash} = ${tokenHash} and ${sessions.lastSeenAt} < now() - interval '1 hour'`,
    );
  return { userId: row.userId, created: false };
}

/**
 * Mint a fresh anonymous user and its session. Two sequential inserts: a
 * crash between them leaves an orphan user — the same harmless, unreferenced
 * orphan as a concurrency loser (plan 009 D11), not worth a transaction
 * neon-http cannot interactively provide.
 */
export async function mintSession(
  db: Db,
  tokenHash: string,
): Promise<SessionResponse> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse; selecting columns is a type-level
  // nicety we can live without.
  const inserted = await db.insert(users).values({}).returning();
  const user = inserted[0];
  if (!user) {
    throw new Error("users insert returned no row");
  }
  await db.insert(sessions).values({ tokenHash, userId: user.id });
  return { userId: user.id, created: true };
}
