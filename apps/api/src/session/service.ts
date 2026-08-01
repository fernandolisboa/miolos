import type { SessionResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";

import { hashSessionToken } from "./token";

/**
 * Session service (ADR-0022). Takes the db, returns plain data — no
 * Response construction here. Every timestamp is DB-side (`now()`,
 * column defaults): no JS-constructed date ever appears in a query, which
 * is the structural AC-5 guarantee.
 */

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour, mirrors the SQL predicate

/**
 * Look up a session by token hash. On a hit, bump `last_seen_at` only when
 * it is more than 1 hour stale (plan 009 D6): staleness granularity is
 * days, so hourly precision is free and a fresh resolve is a single query.
 * The JS comparison below is only a send-gate for the UPDATE statement
 * (each statement is its own neon-http round trip); the DB-side predicate
 * remains the actual guard, so no JS-constructed date ever appears in a
 * query and clock skew can at worst delay a bump by one resolve — harmless
 * at day granularity.
 */
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

/**
 * Resolve the caller's user id for a WRITE (plan 017 D14). Deliberately
 * never mints: minting on a write would create a phantom user from any
 * stray POST, and identity is minted exactly once, by POST /session
 * (ADR-0022). `undefined` means "no caller" — the route answers 401 and
 * the offline queue keeps the completion pending.
 *
 * Takes the raw cookie value rather than a NextRequest, so this module
 * stays framework-free like the rest of it; hashing lives here so no
 * caller ever has to remember that the table stores only the hash.
 */
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
