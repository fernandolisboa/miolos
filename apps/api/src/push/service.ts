import { eq, pushSubscriptions, sql, users, type Db } from "@miolos/db";

/**
 * The push statements (#145, ADR-0064) — the onboarding/service.ts
 * precedent: auth plumbing is the api's; `packages/db` owns tables and
 * cross-table OPERATIONS (the merge — statement 1b lives there), never
 * route-shaped workflows. Takes the db, returns plain data — no Response
 * construction here.
 *
 * NO JS `Date` appears in any statement (the schema.ts law): the stamp and
 * every created_at are DB-side `now()`/defaults.
 */

/**
 * The subscribe write: an upsert on the endpoint PK, because the browser
 * install is the authority for its own capability URL — a re-subscribe
 * after key rotation updates the keys in place, and an endpoint whose
 * browser now carries a different session cookie follows that user (the
 * install IS the device; whoever it authenticates as owns its channel).
 * No transactions over neon-http: the upsert is the race-safety — two
 * concurrent POSTs of one endpoint both land, last write wins, one row.
 */
export async function upsertSubscription(
  db: Db,
  init: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
): Promise<void> {
  await db
    .insert(pushSubscriptions)
    .values({
      endpoint: init.endpoint,
      userId: init.userId,
      p256dh: init.p256dh,
      auth: init.auth,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: init.userId,
        p256dh: init.p256dh,
        auth: init.auth,
        // `created_at` is the consent evidence (ADR-0064 decision 2), so
        // it must attest to the CURRENT owner (#145 step-6 security 3): a
        // same-user re-subscribe after key rotation keeps the original
        // stamp — the consent act is unchanged — but a repoint to a
        // different account is a new consent by a new owner, so the stamp
        // refreshes. DB-side `now()`, per the schema.ts law.
        createdAt: sql`case
          when ${pushSubscriptions.userId} = ${init.userId}
          then ${pushSubscriptions.createdAt}
          else now() end`,
      },
    });
}

/**
 * The unsubscribe write: own rows only — the endpoint AND the caller's
 * user id, so no session can delete another account's channel even by
 * knowing its capability URL. Idempotent: deleting an absent or
 * foreign-owned row removes zero rows, and the route answers
 * `{removed: true}` either way (the browser-side state is what the caller
 * is reconciling, not a row count).
 */
export async function deleteSubscription(
  db: Db,
  userId: string,
  endpoint: string,
): Promise<void> {
  // The compound where rides the sql template (the dismissPushPrompt
  // spelling below): apps/api deliberately takes no direct drizzle-orm
  // dependency — `@miolos/db` re-exports only `eq` and `sql`.
  await db.delete(pushSubscriptions).where(
    sql`${pushSubscriptions.endpoint} = ${endpoint}
          and ${pushSubscriptions.userId} = ${userId}`,
  );
}

/**
 * The account half of GET /notifications/state (the getOnboardingState
 * shape): the dismissal timestamp, compared to NULL by the route and never
 * shipped to the client (ADR-0048 decision 3).
 */
export async function getPushAccountState(
  db: Db,
  userId: string,
): Promise<{ pushPromptDismissedAt: Date | null } | undefined> {
  const rows = await db
    .select({ pushPromptDismissedAt: users.pushPromptDismissedAt })
    .from(users)
    .where(eq(users.id, userId));
  return rows[0];
}

/**
 * The explicit, permanent dismissal (the markOnboardingSeen shape) —
 * decline and browser denial both land here, once per account: idempotent
 * by the DB-side guard — a re-post matches zero rows, never re-bumps
 * `updated_at` (it joins schema.ts's writer list) and never moves the
 * recorded moment.
 */
export async function dismissPushPrompt(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ pushPromptDismissedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      sql`${users.id} = ${userId} and ${users.pushPromptDismissedAt} is null`,
    );
}
