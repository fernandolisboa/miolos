import { eq, sessions, sql, users, type Db } from "@miolos/db";
import { attachTokens } from "@miolos/db/user";

/**
 * The attach-flow statements — auth plumbing is the api's; `packages/db`
 * owns tables and cross-table operations (the merge), never route-shaped
 * workflows. Takes the db, returns plain data — no Response construction
 * here.
 *
 * No JS `Date` appears in any statement: every timestamp is DB-side
 * `now()` or a column default, and both the token expiry and the rate
 * window are DB-side predicates.
 *
 * See ADR-0049 and ADR-0050.
 */

/**
 * The rate-window cleanup: delete ALL rows older than the ONE-HOUR rate
 * window — never the 30-minute expiry. Cleanup at expiry would empty the
 * 30–60-minute band the rolling-hour count needs and silently double the
 * limit; expired-but-recent rows stay as the ledger for their remaining
 * half hour. Global on purpose: a row past the hour is invisible to both
 * rolling-hour counts and expired for the claim WHOEVER owns it, so a
 * per-user predicate bought nothing and left abandoned users' rows for a
 * sweep — this way any request sweeps the whole ledger.
 */
export async function cleanupStaleTokens(db: Db): Promise<void> {
  await db
    .delete(attachTokens)
    .where(sql`${attachTokens.createdAt} <= now() - interval '1 hour'`);
}

/** This user's rows inside the rolling hour — the per-user rate count. */
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

/**
 * This EMAIL's rows inside the rolling hour, across all users — the cheap
 * closer for the mint-fresh-users mail-bombing shape: POST /session mints
 * users unthrottled, so a per-user cap alone is per-attacker-unlimited.
 * The email arrives already normalized.
 */
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

/** Mint one token row. The raw token never reaches this module — hash only. */
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

/**
 * The atomic claim: one `DELETE … WHERE hash AND fresh RETURNING`
 * statement IS the single-use semantics — two concurrent confirms of the
 * same token cannot both win even over transactionless neon-http, and the
 * loser (like any expired or unknown token) sees zero rows. The 30-minute
 * expiry is the DB-side predicate; no JS clock.
 */
export async function claimAttachToken(
  db: Db,
  tokenHash: string,
): Promise<
  { userId: string; email: string; reminderConsent: boolean } | undefined
> {
  // Bare .returning(): on the union Db type only the no-argument overload
  // survives TS's union-signature collapse (mintSession's own note).
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

/**
 * The verified holder of an email: a verified identity by definition, and
 * at most one row can match.
 */
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

/**
 * Requester liveness: a requester tombstoned by a concurrent merge owns
 * zero sessions — confirm answers 410 rather than writing to a tombstone.
 * (Deletion is not this case: it cascades the token away.)
 */
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

/**
 * Post-merge session revocation: after a CROSS-ACCOUNT merge at confirm,
 * no PRE-EXISTING session may survive onto the winner — an attacker who
 * requested the token for a victim's verified email holds a cookie that
 * the merge just remapped onto the victim's account, and this one delete
 * retires it (both accounts' old sessions sit on the winner after the
 * remap, so one user_id catches them all). The confirm route mints the
 * clicking browser's fresh session immediately after; the plain-attach
 * no-collision path never calls this. Deliberately NOT inside
 * `mergeAccounts`: remap-never-delete protects crash-recovery
 * resolvability INSIDE the operation — this is an account-security action
 * on a COMPLETED merge, at the confirm seam only.
 */
export async function revokeSessionsForUser(
  db: Db,
  userId: string,
): Promise<void> {
  await db.delete(sessions).where(eq(sessions.userId, userId));
}

/**
 * The one attach UPDATE, on the resolved WINNER at confirm: email +
 * `email_verified_at = now()` (non-null email implies verified),
 * `recovery_consent_at = now()` always (the confirmed attach IS the
 * consent act), `reminder_consent_at = now()` ONLY when the token carries
 * `true` — a `false` leaves any existing value untouched (an unchecked box
 * is the absence of new consent, never a withdrawal). `updated_at` set
 * explicitly (the schema's own law).
 *
 * A `users_verified_email_uq` violation here is the concurrent-confirm
 * window — the route catches it and answers the same 409 as an exhausted
 * merge retry.
 */
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

/**
 * The explicit, permanent dismissal: idempotent by the DB-side guard — a
 * re-post matches zero rows and never re-bumps `updated_at`.
 */
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

/**
 * The account half of GET /attach/state's conjunction: email and dismissal
 * state for the eligibility derivation.
 */
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
