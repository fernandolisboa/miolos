import type { SessionResponse } from "@miolos/core";
import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { recordSeenDay } from "@miolos/db/user";

import { hashSessionToken } from "./token";

/**
 * Session service (ADR-0022). Takes the db, returns plain data — no
 * Response construction here. Every timestamp is DB-side (`now()`,
 * column defaults): no JS-constructed date ever appears in a query, which
 * is the structural AC-5 guarantee.
 *
 * SEEN-DAY WRITE POINTS (#58, ADR-0066; T-API-S140): the three functions
 * below that authenticate a user each record the DB clock's SP today in
 * `user_seen_days` — `resolveSession` (every authenticated request funnels
 * through it, via `requireUserId` or the session routes), `mintSession`
 * (the first visit), and `createSessionForUser` (attach-confirm mints the
 * clicking browser's session directly, bypassing the other two — the click
 * proves presence). Awaited, not fire-and-forget: an error is the
 * request's 500, never a silently unrecorded day. NOT gated on the 1-hour
 * `last_seen_at` staleness send-gate below, deliberately — that gate
 * under-records exactly the 23:58→00:05 persona the credit exists for (a
 * day's requests can all fall within an hour of a pre-midnight bump).
 * One softened edge, accepted in ADR-0066: puzzle pages are served by
 * apps/web's direct DB read (ADR-0014) and the session bootstrap is a
 * separate request, so a page load whose `ensureSession` failed can leave
 * a day unrecorded — the failure direction is the status quo (late), and a
 * later sync needs the cookie anyway.
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
 *
 * `lastSeenAt` is bumped on READS too, cross-site top-level GETs included
 * (GET /streak has no origin guard by design). It must never become
 * security-load-bearing — expiry, re-auth — without revisiting CSRF on
 * GETs first (step-6 finding security LOW 2).
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
  // Seen-day write point 1 (#58, ADR-0066): a successful hash lookup IS
  // presence. Unconditional — see the header on why the staleness gate
  // above must not gate this write.
  await recordSeenDay(db, row.userId);
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
  // Seen-day write point 2 (#58, ADR-0066): the mint is the first visit.
  await recordSeenDay(db, user.id);
  return { userId: user.id, created: true };
}

/**
 * A session for an EXISTING user — what `mintSession` cannot do (it always
 * mints a new user). #21's attach-confirm is the only caller: the clicking
 * browser is authenticated AS the resolved winner, and never merged into
 * it (ADR-0050 decision 4). The caller generates the raw token, hashes it,
 * and builds the Set-Cookie with `buildSessionCookie`.
 */
export async function createSessionForUser(
  db: Db,
  tokenHash: string,
  userId: string,
): Promise<void> {
  await db.insert(sessions).values({ tokenHash, userId });
  // Seen-day write point 3 (#58, ADR-0066): attach-confirm authenticates
  // the clicking browser directly, bypassing resolveSession/mintSession —
  // the click proves presence.
  await recordSeenDay(db, userId);
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
