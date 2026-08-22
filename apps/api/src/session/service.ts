import type { SessionResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { recordSeenDay } from "@miolos/db/user";

import { hashSessionToken } from "./token";

/**
 * Session service. Three functions record the DB clock's SP today in
 * `user_seen_days`, awaited rather than fire-and-forget (an error is the
 * request's 500, never a silently unrecorded day): `resolveSession` (every
 * authenticated request), `mintSession` (first visit), and
 * `createSessionForUser` (attach-confirm's direct mint). Deliberately not
 * gated on the staleness send-gate below — see ADR-0066 decision 4 for why.
 */

const STALE_AFTER_MS = 60 * 60 * 1000; // 1 hour, mirrors the SQL predicate

/**
 * Look up a session by token hash. On a hit, bump `last_seen_at` only when
 * it is more than 1 hour stale (each statement is its own neon-http round
 * trip); the JS comparison is only the send-gate, and the DB-side predicate
 * is the actual guard.
 *
 * `lastSeenAt` is bumped on reads too, cross-site top-level GETs included
 * (GET /streak has no origin guard by design). It must never become
 * security-load-bearing — expiry, re-auth — without revisiting CSRF on
 * GETs first.
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
  // Write point 1: a successful hash lookup is presence, unconditional.
  await recordSeenDay(db, row.userId);
  return { userId: row.userId, created: false };
}

/**
 * Mint a fresh anonymous user and its session. Two sequential inserts: a
 * crash between them leaves an orphan user — the same harmless,
 * unreferenced orphan as a concurrency loser, not worth a transaction
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
  // Write point 2: the mint is the first visit.
  await recordSeenDay(db, user.id);
  return { userId: user.id, created: true };
}

/**
 * A session for an EXISTING user — what `mintSession` cannot do (it always
 * mints a new user). The attach-confirm route is the only caller: the
 * clicking browser is authenticated AS the resolved winner, and never
 * merged into it. The caller generates the raw token, hashes it, and
 * builds the Set-Cookie with `buildSessionCookie`.
 */
export async function createSessionForUser(
  db: Db,
  tokenHash: string,
  userId: string,
): Promise<void> {
  await db.insert(sessions).values({ tokenHash, userId });
  // Write point 3: the click itself proves presence.
  await recordSeenDay(db, userId);
}

/**
 * Resolve the caller's user id for a WRITE. Deliberately never mints:
 * minting on a write would create a phantom user from any stray POST, and
 * identity is minted exactly once, by POST /session. `undefined` means
 * "no caller" — the route answers 401 and the offline queue keeps the
 * completion pending.
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
