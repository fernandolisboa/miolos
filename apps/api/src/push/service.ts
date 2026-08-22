import { eq, pushSubscriptions, sql, users, type Db } from "@miolos/db";

// Per-user ceiling, enforced write-side folded into the subscribe INSERT
// (not a dispatch-side cap, which would bound neither storage nor sends) —
// see ADR-0068 decision 1.
// 10 covers any real device fleet — phone, desktop, tablet, spare browsers
// — with slack. ADR-0068 decision 1 has the threat and the mechanism, not
// this number.
export const PUSH_SUBSCRIPTION_CEILING = 10;

/**
 * Upsert on the endpoint PK: the browser install is the authority for its
 * own capability URL, so a re-subscribe after key rotation updates in
 * place, and an endpoint now carrying a different session cookie follows
 * that user. No transactions over neon-http — the upsert is the
 * race-safety (two concurrent POSTs of one endpoint both land, one row).
 *
 * The ceiling is folded into this INSERT rather than checked beside it —
 * see ADR-0068 decision 1 for why check-then-act was rejected and how the
 * `exists(endpoint, user_id)` disjunct is scoped. Returns whether a row
 * landed, so the route can 429 at the cap.
 *
 * `inserted` distinguishes a genuine first insert from the DO UPDATE arm
 * landing on a row the caller already held — the telemetry seam needs
 * this so `notification_opt_in` does not re-fire on every re-post. The
 * `(xmax = 0)` RETURNING form does not type through the `Db` union, so a
 * pre-read `exists` stands in instead, check-then-act at telemetry grade
 * only — see ADR-0069 decision 6.
 */
export async function upsertSubscription(
  db: Db,
  init: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
  },
): Promise<{ stored: boolean; inserted: boolean }> {
  // Insert-vs-update pre-read, BEFORE the upsert so it reads the world
  // pre-write. `sql` rather than `and(eq, eq)`: @miolos/db re-exports only
  // `eq` and `sql`.
  const held = await db
    .select({ endpoint: pushSubscriptions.endpoint })
    .from(pushSubscriptions)
    .where(
      sql`${pushSubscriptions.endpoint} = ${init.endpoint}
            and ${pushSubscriptions.userId} = ${init.userId}::uuid`,
    )
    .limit(1);

  // Select list order follows the table's column order (drizzle builds the
  // INSERT list from it): endpoint, user_id, p256dh, auth, created_at.
  // `now()` written out because INSERT … SELECT has no DEFAULT keyword.
  const inserted = await db
    .insert(pushSubscriptions)
    .select(
      sql`select ${init.endpoint}::text, ${init.userId}::uuid, ${init.p256dh}::text, ${init.auth}::text, now()
        where (
          select count(*) from ${pushSubscriptions}
          where ${pushSubscriptions.userId} = ${init.userId}::uuid
        ) < ${PUSH_SUBSCRIPTION_CEILING}
        or exists (
          select 1 from ${pushSubscriptions}
          where ${pushSubscriptions.endpoint} = ${init.endpoint}::text
            and ${pushSubscriptions.userId} = ${init.userId}::uuid
        )`,
    )
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId: init.userId,
        p256dh: init.p256dh,
        auth: init.auth,
        // `created_at` is the consent evidence, so it must attest to the
        // current owner: unchanged on a same-user key rotation, refreshed
        // on a cross-user repoint (a new consent by a new owner).
        createdAt: sql`case
          when ${pushSubscriptions.userId} = ${init.userId}
          then ${pushSubscriptions.createdAt}
          else now() end`,
      },
    })
    .returning();
  const stored = inserted.length > 0;
  return { stored, inserted: stored && held.length === 0 };
}

/**
 * The dispatcher's fan-out read: every subscription row a claimed
 * candidate owns, exactly the three fields a web-push send needs.
 * `created_at` deliberately not projected — consent evidence is not send
 * input.
 */
export async function listSubscriptions(
  db: Db,
  userId: string,
): Promise<{ endpoint: string; p256dh: string; auth: string }[]> {
  return db
    .select({
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
}

/**
 * The 404/410 prune: delete by endpoint PK, no user scope. Unlike
 * `deleteSubscription`'s own-rows-only guard (a session boundary), no
 * session is on this path — the dispatcher acts on rows it just read, and
 * a 404/410 is the push service's verdict that the endpoint itself is
 * dead, whoever it belongs to. Idempotent.
 */
export async function pruneSubscription(
  db: Db,
  endpoint: string,
): Promise<void> {
  await db
    .delete(pushSubscriptions)
    .where(eq(pushSubscriptions.endpoint, endpoint));
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
  await db.delete(pushSubscriptions).where(
    sql`${pushSubscriptions.endpoint} = ${endpoint}
          and ${pushSubscriptions.userId} = ${userId}`,
  );
}

/**
 * The account half of GET /notifications/state: the dismissal timestamp,
 * compared to NULL by the route and never shipped to the client.
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
 * The explicit, permanent dismissal — decline and browser denial both
 * land here, once per account: idempotent by the DB-side guard — a
 * re-post matches zero rows, never re-bumps `updated_at` and never moves
 * the recorded moment.
 */
export async function dismissPushPrompt(db: Db, userId: string): Promise<void> {
  await db
    .update(users)
    .set({ pushPromptDismissedAt: sql`now()`, updatedAt: sql`now()` })
    .where(
      sql`${users.id} = ${userId} and ${users.pushPromptDismissedAt} is null`,
    );
}
